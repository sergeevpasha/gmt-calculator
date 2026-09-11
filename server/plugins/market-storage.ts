import vercelKVDriver from 'unstorage/drivers/vercel-kv'

// Mounts the Upstash Redis store the daily cron writes to. Done here rather than in nitro.storage
// because the credentials only exist at runtime, and because the two ways they reach us are named
// differently: Vercel's own KV integration sets KV_REST_API_*, while adding Upstash straight from the
// Marketplace sets UPSTASH_REDIS_REST_*. Accepting both means the store works either way round.
//
// With neither pair present — local dev, or before the store is attached — nothing is mounted and
// `market` stays on Nitro's default memory storage: the cron's writes are dropped, reads miss, and
// /api/market falls through to the snapshot bundled at build time.
export default defineNitroPlugin(() => {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN

  if (!url || !token) {
    // eslint-disable-next-line no-console
    console.warn('No Upstash credentials found, market readings will not be stored')
    return
  }

  useStorage().mount('market', vercelKVDriver({ url, token, base: 'market' }))
})
