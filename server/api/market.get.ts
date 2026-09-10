import { marketSnapshot, normalizeMarket } from '~/data/gomining'
import type { MarketData } from '~/data/gomining'

const CACHE_TTL = 10 * 60 * 1000

let cache: { data: MarketData, expiresAt: number } | undefined
let inflight: Promise<MarketData> | undefined

async function fetchMarket (): Promise<MarketData> {
  return normalizeMarket(await readGoMining(), 'live')
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
    // Fall back in order of freshness: this instance's last good response, then the reading the daily
    // cron stored, then the snapshot frozen into the bundle when the site was built.
    return cache?.data ?? await readStoredMarket() ?? marketSnapshot
  }
})
