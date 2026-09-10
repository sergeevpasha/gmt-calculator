import { normalizeMarket } from '~/data/gomining'
import type { GenerativePreset, GoMiningSnapshot, IncomeAggregation, MarketData, UpgradeRates } from '~/data/gomining'

const API_URL = 'https://api.gomining.com/api'
const UPSTREAM_TIMEOUT = 8000

// Where the cron writes the last good reading and where /api/market falls back to when GoMining is
// unreachable. Backed by whatever driver nitro.storage mounts at `market`; with none mounted this is
// per-instance memory, so reads simply miss and the bundled snapshot answers instead.
const STORAGE_KEY = 'snapshot'
const HISTORY_PREFIX = 'history:'
const store = () => useStorage<GoMiningSnapshot>('market')

// The three public endpoints the calculators run on, trimmed to the shape gomining-snapshot.json holds
// so the stored document, the bundled file and scripts/update-market-snapshot.mjs stay interchangeable.
export async function readGoMining (): Promise<GoMiningSnapshot> {
  const signal = AbortSignal.timeout(UPSTREAM_TIMEOUT)
  const [income, presets, upgrades] = await Promise.all([
    $fetch<{ data: IncomeAggregation }>(`${API_URL}/nft-income-aggregation/get-last`, { method: 'POST', body: {}, signal }),
    $fetch<{ data: { array: GenerativePreset[] } }>(`${API_URL}/nft-collection/find-all-generative`, { signal }),
    $fetch<{ data: UpgradeRates }>(`${API_URL}/nft/get-upgrade-rate`, { method: 'POST', body: {}, signal })
  ])

  return {
    fetchedAt: new Date().toISOString(),
    income: income.data,
    presets: presets.data.array
      .map(preset => ({ id: preset.id, power: preset.power, energyEfficiency: preset.energyEfficiency, priceUsdt: preset.priceUsdt, level: preset.level }))
      .sort((a, b) => a.energyEfficiency - b.energyEfficiency || a.power - b.power),
    upgrades: {
      powerUpgradePriceConfig: upgrades.data.powerUpgradePriceConfig,
      energyEfficiencyUpgradePriceConfig: upgrades.data.energyEfficiencyUpgradePriceConfig
    }
  }
}

// Rejects anything normalizeMarket cannot read, so a bad reading can never replace a good stored one.
// Writes the reading twice: once as the current fallback, once under GoMining's own payout date to
// build a day-by-day series. Keying history by that date rather than by write time means a re-run,
// or a retry after a failure, corrects the day in place instead of adding a duplicate.
export async function storeGoMining (snapshot: GoMiningSnapshot): Promise<MarketData> {
  const market = normalizeMarket(snapshot, 'snapshot')
  const day = market.incomeDate.slice(0, 10)
  await Promise.all([
    store().setItem(STORAGE_KEY, snapshot),
    store().setItem(`${HISTORY_PREFIX}${day}`, snapshot)
  ])
  return market
}

// Never throws: a storage outage must not turn into a failed page render.
export async function readStoredMarket (): Promise<MarketData | undefined> {
  try {
    const snapshot = await store().getItem(STORAGE_KEY)
    return snapshot ? normalizeMarket(snapshot, 'snapshot') : undefined
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Stored market snapshot is unreadable', error)
    return undefined
  }
}
