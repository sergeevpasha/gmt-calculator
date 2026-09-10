// Daily job declared in nuxt.config.ts. Reads GoMining once and stores the result, so the site has
// a durable last-known-good reading instead of the snapshot frozen into the bundle at build time.
//
// Vercel sends `Authorization: Bearer $CRON_SECRET` when CRON_SECRET is set on the project. Without
// that variable the route stays closed rather than open, so a missing secret cannot expose it.
export default defineEventHandler(async (event) => {
  const secret = process.env.CRON_SECRET
  if (!secret || getHeader(event, 'authorization') !== `Bearer ${secret}`) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  setResponseHeader(event, 'Cache-Control', 'no-store')

  const snapshot = await readGoMining()
  const market = await storeGoMining(snapshot)

  return {
    stored: true,
    fetchedAt: snapshot.fetchedAt,
    payoutDate: market.incomeDate,
    presets: snapshot.presets.length,
    btcPriceUsd: market.btcPriceUsd
  }
})
