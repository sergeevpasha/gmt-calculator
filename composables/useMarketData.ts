import { marketSnapshot } from '~/data/gomining'
import type { MarketData } from '~/data/gomining'

export type MarketStatus = 'loading' | 'live' | 'snapshot'

// GoMining prices, fees and the daily payout, shared by the page and both calculators.
export const useMarketData = () => {
  // Shallow, because one estimate reads thousands of prices and a deep reactive copy sends each read through a
  // proxy. The object is only ever replaced whole, so nothing inside it needs tracking.
  const market = useState<MarketData>('market', () => shallowRef(marketSnapshot))
  const status = useState<MarketStatus>('market-status', () => 'loading')
  const pending = useState('market-pending', () => false)

  async function refresh () {
    if (pending.value) { return }
    pending.value = true
    // If the request fails the page keeps the data it already shows, and the status says which that is.
    market.value = await $fetch('/api/market', { signal: AbortSignal.timeout(10000) }).catch(() => market.value)
    status.value = market.value.source
    pending.value = false
  }

  return { market, status, pending, refresh }
}
