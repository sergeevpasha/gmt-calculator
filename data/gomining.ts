// GoMining market data used by both calculators.
//
// The values come from GoMining's public API (the same endpoints app.gomining.com calls, no token required):
//   POST https://api.gomining.com/api/nft-income-aggregation/get-last    daily pool payout, fees and BTC rate
//   GET  https://api.gomining.com/api/nft-collection/find-all-generative  miner presets with prices
//   POST https://api.gomining.com/api/nft/get-upgrade-rate                energy efficiency upgrade prices
//
// `gomining-snapshot.json` stores the last raw responses and is the fallback when the API is unreachable.
// Refresh it with: docker compose exec -T dashboard node scripts/update-market-snapshot.mjs
import raw from './gomining-snapshot.json'

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

  const miners = (snapshot.presets ?? [])
    .filter(preset => isPositive(preset.power) && isPositive(preset.energyEfficiency) && isPositive(preset.priceUsdt))
    .map(preset => ({ power: preset.power, efficiency: preset.energyEfficiency, priceUsd: preset.priceUsdt }))
    .sort((a, b) => b.efficiency - a.efficiency || a.power - b.power)
  if (!miners.length) {
    throw new Error('GoMining miner presets are empty')
  }

  const efficiencyUpgradePrices: Record<number, number> = {}
  for (const step of snapshot.upgrades?.energyEfficiencyUpgradePriceConfig ?? []) {
    if (Number.isInteger(step.toLevel) && isAmount(step.priceUsd)) {
      efficiencyUpgradePrices[step.toLevel] = step.priceUsd
    }
  }
  if (!Object.keys(efficiencyUpgradePrices).length) {
    throw new Error('GoMining upgrade prices are empty')
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
    efficiencyUpgradePrices,
    miners
  }
}

export const marketSnapshot: MarketData = normalizeMarket(raw as GoMiningSnapshot, 'snapshot')
