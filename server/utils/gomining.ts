import { normalizeMarket, parseSnapshot } from '~/data/gomining'
import type { GoMiningSnapshot, HistoryPoint, MarketData } from '~/data/gomining'
import { isRecord } from '~/utils/isRecord'

const API_URL = 'https://api.gomining.com/api'
const UPSTREAM_TIMEOUT = 8000

// Where the cron writes the last good reading and where /api/market falls back to when GoMining is
// unreachable. Backed by whatever driver nitro.storage mounts at `market`; with none mounted this is
// per-instance memory, so reads simply miss and the bundled snapshot answers instead.
const STORAGE_KEY = 'snapshot'
const HISTORY_PREFIX = 'history:'
// The chart's data: one compact point per payout date in a single key, so drawing it costs one read
// however long the series grows. The full daily readings under history:* stay the complete record,
// and this can be rebuilt from them if the two ever disagree.
const SERIES_KEY = 'series'
// One mount, two kinds of value: readings under STORAGE_KEY and history:*, the series under SERIES_KEY.
// Each gets a handle typed for its own keys, and only this file writes either.
const readingStore = () => useStorage<GoMiningSnapshot>('market')
const seriesStore = () => useStorage<HistoryPoint[]>('market')

// GoMining wraps every response in { data }, and the miner catalogue once more in { array }.
const unwrap = (value: unknown, key: string): unknown => isRecord(value) ? value[key] : undefined

// The three public endpoints the calculators run on, checked and trimmed by parseSnapshot to the shape
// gomining-snapshot.json holds, so the stored document, the bundled file and
// scripts/update-market-snapshot.mjs stay interchangeable.
export async function readGoMining (): Promise<GoMiningSnapshot> {
  const signal = AbortSignal.timeout(UPSTREAM_TIMEOUT)
  const [income, presets, upgrades] = await Promise.all([
    $fetch(`${API_URL}/nft-income-aggregation/get-last`, { method: 'POST', body: {}, signal }),
    $fetch(`${API_URL}/nft-collection/find-all-generative`, { signal }),
    $fetch(`${API_URL}/nft/get-upgrade-rate`, { method: 'POST', body: {}, signal })
  ])

  return parseSnapshot({
    fetchedAt: new Date().toISOString(),
    income: unwrap(income, 'data'),
    presets: unwrap(unwrap(presets, 'data'), 'array'),
    upgrades: unwrap(upgrades, 'data')
  })
}

// Rejects anything normalizeMarket cannot read, so a bad reading can never replace a good stored one.
// Writes the reading twice: once as the current fallback, once under GoMining's own payout date to
// build a day-by-day series. Keying history by that date rather than by write time means a re-run,
// or a retry after a failure, corrects the day in place instead of adding a duplicate.
export async function storeGoMining (snapshot: GoMiningSnapshot): Promise<MarketData> {
  const market = normalizeMarket(snapshot, 'snapshot')
  const day = market.incomeDate.slice(0, 10)
  const point: HistoryPoint = {
    date: day,
    rewardUsdPerThDay: market.rewardUsdPerThDay,
    rewardSatPerThDay: market.rewardSatPerThDay,
    btcPriceUsd: market.btcPriceUsd,
    kwhPriceUsd: market.kwhPriceUsd,
    serviceUsdPerThDay: market.serviceUsdPerThDay
  }
  // The cron is the only writer and runs once a day, so this read-modify-write has nothing to race.
  const series = await seriesStore().getItem(SERIES_KEY) ?? []
  const nextSeries = [...series.filter(entry => entry.date !== day), point].sort((a, b) => a.date.localeCompare(b.date))
  await Promise.all([
    readingStore().setItem(STORAGE_KEY, snapshot),
    readingStore().setItem(`${HISTORY_PREFIX}${day}`, snapshot),
    seriesStore().setItem(SERIES_KEY, nextSeries)
  ])
  return market
}

// Never throws: a storage outage must not turn into a failed page render.
export async function readStoredMarket (): Promise<MarketData | undefined> {
  try {
    const snapshot = await readingStore().getItem(STORAGE_KEY)
    return snapshot ? normalizeMarket(snapshot, 'snapshot') : undefined
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Stored market snapshot is unreadable', error)
    return undefined
  }
}

// The recorded payout series, oldest first. Never throws: the chart shows an empty state instead.
export async function readMarketHistory (): Promise<HistoryPoint[]> {
  try {
    return await seriesStore().getItem(SERIES_KEY) ?? []
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Market history is unreadable', error)
    return []
  }
}
