// GoMining market data used by both calculators.
//
// The values come from GoMining's public API (the same endpoints app.gomining.com calls, no token required):
//   POST https://api.gomining.com/api/nft-income-aggregation/get-last  daily pool payout, fees and BTC rate
//   POST https://api.gomining.com/api/nft-collection/index             primary-market miner catalogue with prices
//   POST https://api.gomining.com/api/nft/get-upgrade-rate             energy efficiency upgrade prices
//
// Only GoMining's own primary-market price ladders between 12 and 20 W/TH are used. Secondary-market listings,
// promo collections and legacy ladders above 20 W/TH are ignored.
// `gomining-snapshot.json` stores the last raw responses and is the fallback when the API is unreachable.
// Refresh it with: docker compose exec -T dashboard yarn update-snapshot
import raw from './gomining-snapshot.json'

// W/TH range GoMining sells and upgrades to on the primary market: 20 W/TH is the least efficient miner
// you can configure, 12 W/TH the best upgrade level.
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

// One row of GoMining's collection catalogue (nft-collection/index).
export interface CatalogueCollection {
  id: number
  name: string
  type: string
  saleNftStatus: string
  test?: boolean
  network: string | null
  metaData?: { type?: string } | null
  power: number
  energyEfficiency: number
  value: number
}

export interface UpgradeRates {
  energyEfficiencyUpgradePriceConfig: { toLevel: number, priceUsd: number }[]
}

export interface GoMiningSnapshot {
  fetchedAt: string
  income: IncomeAggregation
  collections: CatalogueCollection[]
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

// GoMining's own generative miners sold in the app: the "general" rows without a blockchain network are the
// price ladders (1 to 5,000 TH per efficiency); the other rows are promo, gift and per-network variants.
export function isPrimaryLadder (collection: CatalogueCollection) {
  return collection.type === 'generative' &&
    collection.saleNftStatus === 'sale' &&
    !collection.test &&
    collection.network === null &&
    collection.metaData?.type === 'general' &&
    isPositive(collection.power) &&
    isPositive(collection.value) &&
    Number.isInteger(collection.energyEfficiency) &&
    collection.energyEfficiency >= EFFICIENCY_RANGE.min &&
    collection.energyEfficiency <= EFFICIENCY_RANGE.max
}

export function normalizeMarket (snapshot: GoMiningSnapshot, source: MarketData['source']): MarketData {
  const income = snapshot.income
  if (!income || !isPositive(income.btcCourseInUsd) || !isAmount(income.totalIncomePerThToday) || !isAmount(income.c1ValuePerThPerWtToday) || !isAmount(income.c2ValuePerThToday)) {
    throw new Error('GoMining income aggregation is malformed')
  }

  // One price per efficiency and power; keep the cheapest row if the catalogue lists duplicates.
  const ladder = new Map<string, MinerPreset>()
  for (const collection of (snapshot.collections ?? []).filter(isPrimaryLadder)) {
    const key = `${collection.energyEfficiency}:${collection.power}`
    const current = ladder.get(key)
    if (!current || collection.value < current.priceUsd) {
      ladder.set(key, { power: collection.power, efficiency: collection.energyEfficiency, priceUsd: collection.value })
    }
  }
  const miners = [...ladder.values()].sort((a, b) => b.efficiency - a.efficiency || a.power - b.power)
  if (!miners.length) {
    throw new Error('GoMining miner catalogue is empty')
  }

  const efficiencyUpgradePrices: Record<number, number> = {}
  for (const step of snapshot.upgrades?.energyEfficiencyUpgradePriceConfig ?? []) {
    if (Number.isInteger(step.toLevel) && step.toLevel >= EFFICIENCY_RANGE.min && step.toLevel < EFFICIENCY_RANGE.max && isAmount(step.priceUsd)) {
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
