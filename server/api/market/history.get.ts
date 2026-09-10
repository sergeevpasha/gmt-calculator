// The daily payout series recorded by /api/cron/refresh-market.
export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'no-store')
  return { points: await readMarketHistory() }
})
