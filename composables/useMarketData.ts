import { marketSnapshot } from '~/data/gomining'
import type { MarketData } from '~/data/gomining'

export type MarketStatus = 'loading' | 'live' | 'snapshot'

// GoMining prices, fees and the daily payout, shared by the page and both calculators.
export const useMarketData = () => {
  const market = useState<MarketData>('market', () => marketSnapshot)
  const status = useState<MarketStatus>('market-status', () => 'loading')
  const pending = useState('market-pending', () => false)

  async function refresh () {
    if (pending.value) { return }
    pending.value = true
    try {
      const response = await fetch('/api/market', { signal: AbortSignal.timeout(10000) })
      if (!response.ok) { throw new Error('Market data unavailable') }
      const data: MarketData = await response.json()
      if (!Number.isFinite(data.rewardSatPerThDay) || !data.miners?.length) { throw new Error('Invalid market data') }
      market.value = data
      status.value = data.source === 'live' ? 'live' : 'snapshot'
    } catch {
      status.value = market.value.source === 'live' ? 'live' : 'snapshot'
    } finally {
      pending.value = false
    }
  }

  return { market, status, pending, refresh }
}
