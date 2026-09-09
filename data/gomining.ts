// GoMining market data used by both calculators.
//
// The values come from GoMining's public API (the same endpoints app.gomining.com calls, no token required):
//   POST https://api.gomining.com/api/nft-income-aggregation/get-last    daily pool payout, fees and BTC rate
//   GET  https://api.gomining.com/api/nft-collection/find-all-generative  miners sold in the app, with prices
//   POST https://api.gomining.com/api/nft/get-upgrade-rate                energy efficiency upgrade prices
//
// GoMining sells new miners at one efficiency (12 W/TH today). Any other efficiency between 12 and 20 W/TH is
// priced from the same primary-market data: the 12 W/TH price minus GoMining's official cost of upgrading that
// miner back to 12 W/TH. Secondary-market listings are never used.
// `gomining-snapshot.json` stores the last raw responses and is the fallback when the API is unreachable.
// Refresh it with: docker compose exec -T dashboard yarn update-snapshot
import raw from './gomining-snapshot.json'

// W/TH range covered by the calculators: 12 W/TH is the best level GoMining sells and upgrades to,
// 20 W/TH the least efficient miner GoMining still upgrades.
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

export interface UpgradeRates {
  energyEfficiencyUpgradePriceConfig: { toLevel: number, priceUsd: number }[]
}

export interface GoMiningSnapshot {
  fetchedAt: string
  income: IncomeAggregation
  presets: GenerativePreset[]
  upgrades: UpgradeRates
}

export interface MinerPreset {
  power: number
  efficiency: number
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
  // Efficiency GoMining sells new miners at; the price ladder in `miners` belongs to it.
  referenceEfficiency: number
  // Price per TH for upgrading one W/TH step, keyed by the target W/TH level.
  efficiencyUpgradePrices: Record<number, number>
  miners: MinerPreset[]
}

const isPositive = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0
const isAmount = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0
const round = (value: number, digits: number) => Number(value.toFixed(digits))

export function normalizeMarket (snapshot: GoMiningSnapshot, source: MarketData['source']): MarketData {
  const income = snapshot.income
  if (!income || !isPositive(income.btcCourseInUsd) || !isAmount(income.totalIncomePerThToday) || !isAmount(income.c1ValuePerThPerWtToday) || !isAmount(income.c2ValuePerThToday)) {
    throw new Error('GoMining income aggregation is malformed')
  }

  const presets = (snapshot.presets ?? []).filter(preset => isPositive(preset.power) && isPositive(preset.priceUsdt) &&
    Number.isInteger(preset.energyEfficiency) && preset.energyEfficiency >= EFFICIENCY_RANGE.min && preset.energyEfficiency <= EFFICIENCY_RANGE.max)
  if (!presets.length) {
    throw new Error('GoMining miner presets are empty')
  }
  // The best efficiency on sale is the reference ladder; every other efficiency derives from it.
  const referenceEfficiency = Math.min(...presets.map(preset => preset.energyEfficiency))
  const ladder = new Map<number, MinerPreset>()
  for (const preset of presets.filter(preset => preset.energyEfficiency === referenceEfficiency)) {
    const current = ladder.get(preset.power)
    if (!current || preset.priceUsdt < current.priceUsd) {
      ladder.set(preset.power, { power: preset.power, efficiency: referenceEfficiency, priceUsd: preset.priceUsdt })
    }
  }
  const miners = [...ladder.values()].sort((a, b) => a.power - b.power)

  const efficiencyUpgradePrices: Record<number, number> = {}
  for (const step of snapshot.upgrades?.energyEfficiencyUpgradePriceConfig ?? []) {
    if (Number.isInteger(step.toLevel) && step.toLevel >= referenceEfficiency && step.toLevel < EFFICIENCY_RANGE.max && isAmount(step.priceUsd)) {
      efficiencyUpgradePrices[step.toLevel] = step.priceUsd
    }
  }
  for (let level = referenceEfficiency; level < EFFICIENCY_RANGE.max; level++) {
    if (!(level in efficiencyUpgradePrices)) {
      throw new Error(`GoMining upgrade price for ${level} W/TH is missing`)
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
    efficiencyUpgradePrices,
    miners
  }
}

export const marketSnapshot: MarketData = normalizeMarket(raw as GoMiningSnapshot, 'snapshot')
