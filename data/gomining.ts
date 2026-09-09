// GoMining market data used by both calculators.
//
// Read from GoMining's public API (the same endpoints app.gomining.com calls, no token required):
//   POST https://api.gomining.com/api/nft-income-aggregation/get-last    daily pool payout, fees and BTC rate
//   GET  https://api.gomining.com/api/nft-collection/find-all-generative  miners GoMining sells, with prices
//   POST https://api.gomining.com/api/nft/get-upgrade-rate                the W/TH step tables
//
// Miner prices follow GoMining's own valuation function (its `NftPriceCalculator`), which prices any power and
// efficiency as `base price + energy bonus + power bonus`. See `composables/useInvest.ts` for the transcription.
// Nothing here comes from the secondary market.
// `gomining-snapshot.json` stores the last raw responses and is the fallback when the API is unreachable.
// Refresh it with: docker compose exec -T dashboard yarn update-snapshot
import raw from './gomining-snapshot.json'

// W/TH range the calculators cover: 12 is the best level GoMining sells, 20 the least efficient it still upgrades.
export const EFFICIENCY_RANGE = { min: 12, max: 20 }

// GoMining's valuation charges each power band at `basePrice * BAND_DECAY^(level - 1)`, where the decay is
// `1 - discount * discountCoefficient` from `nft/get-power-upgrade-info`. That endpoint needs a signed-in account,
// so the constant is calibrated instead: it is the value that reproduces GoMining's own quote of $7.35581583 for
// the next TH on a 128 TH miner at 20 W/TH, and it tracks the published 12 W/TH ladder to within 0.5% up to 128 TH.
export const BAND_DECAY = 0.9910237628

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
  // Drives GoMining's valuation function, so it sets what each W/TH level is worth.
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
  // The efficiency GoMining sells, and the reference point of its valuation function.
  referenceEfficiency: number
  // Listed price of 1 TH at the reference efficiency; the valuation function's base price.
  basePriceUsd: number
  // Per-band decay applied to the base price.
  bandDecay: number
  // The power levels, ascending, as GoMining lists them.
  powersByLevel: number[]
  // Full step table feeding the valuation function; every level matters, not just 12 to 19.
  powerUpgradeSteps: UpgradeStep[]
  // Per-TH cost of upgrading an owned miner one W/TH, keyed by target level. Reference only.
  efficiencyUpgradePrices: Record<number, number>
  // GoMining's published ladder at the reference efficiency.
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
  const ladder = new Map<number, number>()
  for (const preset of presets.filter(preset => preset.energyEfficiency === referenceEfficiency)) {
    const current = ladder.get(preset.power)
    if (current === undefined || preset.priceUsdt < current) {
      ladder.set(preset.power, preset.priceUsdt)
    }
  }
  const miners = [...ladder.entries()].map(([power, priceUsd]) => ({ power, priceUsd })).sort((a, b) => a.power - b.power)
  if (miners.length < 3) {
    throw new Error('GoMining price ladder is too short')
  }
  // The valuation function's base price is the listed price of exactly 1 TH.
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
    bandDecay: BAND_DECAY,
    powersByLevel: miners.map(miner => miner.power),
    powerUpgradeSteps,
    efficiencyUpgradePrices,
    miners
  }
}

export const marketSnapshot: MarketData = normalizeMarket(raw as GoMiningSnapshot, 'snapshot')
