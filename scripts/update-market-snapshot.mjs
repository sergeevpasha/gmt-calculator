// Refreshes data/gomining-snapshot.json from GoMining's public API.
// Run inside the container: docker compose exec -T dashboard yarn update-snapshot
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const API_URL = 'https://api.gomining.com/api'

async function request (path, body) {
  const response = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { accept: 'application/json', 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20000)
  })
  if (!response.ok) {
    throw new Error(`POST ${path} responded with ${response.status}`)
  }
  return (await response.json()).data
}

const [income, catalogue, upgrades] = await Promise.all([
  request('/nft-income-aggregation/get-last', {}),
  request('/nft-collection/index', { filters: { type: 'generative', saleNftStatus: 'sale' } }),
  request('/nft/get-upgrade-rate', {})
])

// Keep GoMining's own price ladders (mirrors isPrimaryLadder in data/gomining.ts, without the efficiency range,
// so the snapshot stays a raw record and the range rule lives in one place).
const collections = catalogue.array
  .filter(collection => !collection.test && collection.network === null && collection.metaData?.type === 'general')
  .map(collection => ({
    id: collection.id,
    name: collection.name,
    type: collection.type,
    saleNftStatus: collection.saleNftStatus,
    test: collection.test,
    network: collection.network,
    metaData: { type: collection.metaData.type },
    power: collection.power,
    energyEfficiency: collection.energyEfficiency,
    value: collection.value
  }))
  .sort((a, b) => a.energyEfficiency - b.energyEfficiency || a.power - b.power)

const snapshot = {
  fetchedAt: new Date().toISOString(),
  income: {
    createdAt: income.createdAt,
    btcCourseInUsd: income.btcCourseInUsd,
    totalIncomePerThToday: income.totalIncomePerThToday,
    totalIncomePerTh: income.totalIncomePerTh,
    c1ValuePerThPerWtToday: income.c1ValuePerThPerWtToday,
    c2ValuePerThToday: income.c2ValuePerThToday,
    c3ValuePerThToday: income.c3ValuePerThToday ?? 0,
    c4ValuePerThToday: income.c4ValuePerThToday ?? 0
  },
  collections,
  upgrades: { energyEfficiencyUpgradePriceConfig: upgrades.energyEfficiencyUpgradePriceConfig }
}

const file = resolve(fileURLToPath(new URL('..', import.meta.url)), 'data/gomining-snapshot.json')
writeFileSync(file, `${JSON.stringify(snapshot, null, 2)}\n`)
// eslint-disable-next-line no-console
console.log(`Saved ${collections.length} catalogue rows, ${snapshot.upgrades.energyEfficiencyUpgradePriceConfig.length} upgrade steps and the ${income.createdAt.slice(0, 10)} payout to ${file}`)
