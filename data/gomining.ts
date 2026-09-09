// GoMining market data used by both calculators.
//
// Read from GoMining's public API (the same endpoints app.gomining.com calls, no token required):
//   POST https://api.gomining.com/api/nft-income-aggregation/get-last    daily pool payout, fees and BTC rate
//   GET  https://api.gomining.com/api/nft-collection/find-all-generative  miners GoMining sells, with prices
//   POST https://api.gomining.com/api/nft/get-upgrade-rate                the W/TH step tables
//
// Every number the calculators use is fetched. Miner prices combine GoMining's published price ladder for the
// efficiency it sells with the per-W/TH valuation steps from get-upgrade-rate. Nothing is fitted or hardcoded,
// and nothing comes from the secondary market. See composables/useInvest.ts for how the two are combined.
// `gomining-snapshot.json` stores the last raw responses and is the fallback when the API is unreachable.
// Refresh it with: docker compose exec -T dashboard yarn update-snapshot
import raw from './gomining-snapshot.json'

// W/TH range the calculators cover: 12 is the best level GoMining sells, 20 the least efficient it still upgrades.
export const EFFICIENCY_RANGE = { min: 12, max: 20 }

export interface IncomeAggregation {
  createdAt: string
  btcCourseInUsd: number
  // Gross pool payout, USD per TH per day.
  totalIncomePerThToday: number
  // Gross pool payout over the last 365 days, USD per TH.
  totalIncomePerTh: number
  // Electricity, USD per TH per W/TH per day (kWh price * 24 / 1000).
  c1ValuePerThPerWtToday: number
  // Service fee, USD per TH per day.
  c2ValuePerThToday: number
  c3ValuePerThToday?: number
  c4ValuePerThToday?: number
}

export interface GenerativePreset {
  id?: number
  power: number
  energyEfficiency: number
  priceUsdt: number
  level?: number
}

export interface UpgradeStep { toLevel: number, priceUsd: number }

export interface UpgradeRates {
  // Sets what one TH is worth at each W/TH level, so it prices the efficiencies GoMining does not list.
  powerUpgradePriceConfig: UpgradeStep[]
  // What GoMining charges an owner to improve a miner by one W/TH. Reference only.
  energyEfficiencyUpgradePriceConfig: UpgradeStep[]
}

export interface GoMiningSnapshot {
  fetchedAt: string
  income: IncomeAggregation
  presets: GenerativePreset[]
  upgrades: UpgradeRates
}

export interface MinerPreset {
  power: number
  priceUsd: number
}

// A full price ladder GoMining publishes for one efficiency.
export interface EfficiencyLadder {
  efficiency: number
  presets: MinerPreset[]
}

export interface MarketData {
  source: 'live' | 'snapshot'
  fetchedAt: string
  incomeDate: string
  btcPriceUsd: number
  rewardUsdPerThDay: number
  rewardSatPerThDay: number
  averageRewardUsdPerThDay: number
  kwhPriceUsd: number
  serviceUsdPerThDay: number
  // The efficiency GoMining sells; its listed ladder is in `miners`.
  referenceEfficiency: number
  // Listed price of 1 TH at the reference efficiency.
  basePriceUsd: number
  // Full step table that values a TH at each W/TH level; every level matters, not just 12 to 19.
  powerUpgradeSteps: UpgradeStep[]
  // Per-TH cost of upgrading an owned miner one W/TH, keyed by target level. Reference only.
  efficiencyUpgradePrices: Record<number, number>
  // Every price ladder GoMining publishes, best efficiency first. Prices for the efficiencies it does not
  // publish are interpolated between these, or stepped down from the least efficient one.
  ladders: EfficiencyLadder[]
  // The reference ladder, kept for display.
  miners: MinerPreset[]
}

const isPositive = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0
const isAmount = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0
const round = (value: number, digits: number) => Number(value.toFixed(digits))
const isStep = (step: unknown): step is UpgradeStep =>
  !!step && typeof step === 'object' && Number.isInteger((step as UpgradeStep).toLevel) && isAmount((step as UpgradeStep).priceUsd)

export function normalizeMarket (snapshot: GoMiningSnapshot, source: MarketData['source']): MarketData {
  const income = snapshot.income
  if (!income || !isPositive(income.btcCourseInUsd) || !isAmount(income.totalIncomePerThToday) || !isAmount(income.c1ValuePerThPerWtToday) || !isAmount(income.c2ValuePerThToday)) {
    throw new Error('GoMining income aggregation is malformed')
  }

  const presets = (snapshot.presets ?? []).filter(preset => isPositive(preset.power) && isPositive(preset.priceUsdt) && isPositive(preset.energyEfficiency))
  if (!presets.length) {
    throw new Error('GoMining miner presets are empty')
  }
  const referenceEfficiency = Math.min(...presets.map(preset => preset.energyEfficiency))
  // One ladder per efficiency GoMining publishes; keep the cheapest row if a size is listed twice.
  const byEfficiency = new Map<number, Map<number, number>>()
  for (const preset of presets) {
    const sizes = byEfficiency.get(preset.energyEfficiency) ?? new Map<number, number>()
    const current = sizes.get(preset.power)
    if (current === undefined || preset.priceUsdt < current) {
      sizes.set(preset.power, preset.priceUsdt)
    }
    byEfficiency.set(preset.energyEfficiency, sizes)
  }
  const ladders: EfficiencyLadder[] = [...byEfficiency.entries()]
    .map(([efficiency, sizes]) => ({
      efficiency,
      presets: [...sizes.entries()].map(([power, priceUsd]) => ({ power, priceUsd })).sort((a, b) => a.power - b.power)
    }))
    .filter(ladder => ladder.presets.length >= 3)
    .sort((a, b) => a.efficiency - b.efficiency)
  if (!ladders.length || ladders[0].efficiency !== referenceEfficiency) {
    throw new Error('GoMining price ladders are missing or too short')
  }
  const miners = ladders[0].presets
  const base = miners.find(miner => miner.power === 1)
  if (!base) {
    throw new Error('GoMining does not list a 1 TH miner to anchor prices on')
  }

  const powerUpgradeSteps = (snapshot.upgrades?.powerUpgradePriceConfig ?? []).filter(isStep).sort((a, b) => a.toLevel - b.toLevel)
  if (!powerUpgradeSteps.some(step => step.toLevel === referenceEfficiency) || !powerUpgradeSteps.some(step => step.toLevel === EFFICIENCY_RANGE.max - 1)) {
    throw new Error('GoMining valuation steps do not cover the supported efficiency range')
  }

  const efficiencyUpgradePrices: Record<number, number> = {}
  for (const step of (snapshot.upgrades?.energyEfficiencyUpgradePriceConfig ?? []).filter(isStep)) {
    if (step.toLevel >= referenceEfficiency && step.toLevel < EFFICIENCY_RANGE.max) {
      efficiencyUpgradePrices[step.toLevel] = step.priceUsd
    }
  }

  return {
    source,
    fetchedAt: snapshot.fetchedAt,
    incomeDate: income.createdAt,
    btcPriceUsd: income.btcCourseInUsd,
    rewardUsdPerThDay: income.totalIncomePerThToday,
    rewardSatPerThDay: round(income.totalIncomePerThToday / income.btcCourseInUsd * 100000000, 2),
    averageRewardUsdPerThDay: isAmount(income.totalIncomePerTh) ? round(income.totalIncomePerTh / 365, 6) : income.totalIncomePerThToday,
    kwhPriceUsd: round(income.c1ValuePerThPerWtToday * 1000 / 24, 6),
    serviceUsdPerThDay: round(income.c2ValuePerThToday + (income.c3ValuePerThToday ?? 0) + (income.c4ValuePerThToday ?? 0), 6),
    referenceEfficiency,
    basePriceUsd: base.priceUsd,
    powerUpgradeSteps,
    efficiencyUpgradePrices,
    ladders,
    miners
  }
}

export const marketSnapshot: MarketData = normalizeMarket(raw as GoMiningSnapshot, 'snapshot')
