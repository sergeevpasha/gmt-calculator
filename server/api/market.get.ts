import { isPrimaryLadder, marketSnapshot, normalizeMarket } from '~/data/gomining'
import type { CatalogueCollection, IncomeAggregation, MarketData, UpgradeRates } from '~/data/gomining'

const API_URL = 'https://api.gomining.com/api'
const CACHE_TTL = 10 * 60 * 1000
const UPSTREAM_TIMEOUT = 8000

let cache: { data: MarketData, expiresAt: number } | undefined
let inflight: Promise<MarketData> | undefined

async function fetchMarket (): Promise<MarketData> {
  const signal = AbortSignal.timeout(UPSTREAM_TIMEOUT)
  const [income, catalogue, upgrades] = await Promise.all([
    $fetch<{ data: IncomeAggregation }>(`${API_URL}/nft-income-aggregation/get-last`, { method: 'POST', body: {}, signal }),
    $fetch<{ data: { array: CatalogueCollection[] } }>(`${API_URL}/nft-collection/index`, { method: 'POST', body: { filters: { type: 'generative', saleNftStatus: 'sale' } }, signal }),
    $fetch<{ data: UpgradeRates }>(`${API_URL}/nft/get-upgrade-rate`, { method: 'POST', body: {}, signal })
  ])

  return normalizeMarket({
    fetchedAt: new Date().toISOString(),
    income: income.data,
    collections: catalogue.data.array.filter(isPrimaryLadder),
    upgrades: upgrades.data
  }, 'live')
}

export default defineEventHandler(async (event) => {
  const now = Date.now()
  if (cache && cache.expiresAt > now) {
    setResponseHeader(event, 'Cache-Control', 'public, max-age=300, s-maxage=600, stale-while-revalidate=3600')
    return cache.data
  }

  try {
    inflight = inflight ?? fetchMarket().finally(() => { inflight = undefined })
    const data = await inflight
    cache = { data, expiresAt: now + CACHE_TTL }
    setResponseHeader(event, 'Cache-Control', 'public, max-age=300, s-maxage=600, stale-while-revalidate=3600')
    return data
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('GoMining market data is unavailable', error)
    setResponseHeader(event, 'Cache-Control', 'no-store')
    // Serve the last successful response while GoMining is down, otherwise the bundled snapshot.
    return cache ? cache.data : marketSnapshot
  }
})
