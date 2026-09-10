// Refreshes data/gomining-snapshot.json from GoMining's public API.
// Run inside the container: docker compose exec -T dashboard yarn update-snapshot
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const API_URL = 'https://api.gomining.com/api'

async function request (path, method = 'GET') {
  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers: { accept: 'application/json', ...(method === 'POST' ? { 'content-type': 'application/json' } : {}) },
    body: method === 'POST' ? '{}' : undefined,
    signal: AbortSignal.timeout(20000)
  })
  if (!response.ok) {
    throw new Error(`${method} ${path} responded with ${response.status}`)
  }
  return (await response.json()).data
}

const [income, presets, upgrades] = await Promise.all([
  request('/nft-income-aggregation/get-last', 'POST'),
  request('/nft-collection/find-all-generative'),
  request('/nft/get-upgrade-rate', 'POST')
])

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
  presets: presets.array
    .map(preset => ({ power: preset.power, energyEfficiency: preset.energyEfficiency, priceUsdt: preset.priceUsdt }))
    .sort((a, b) => a.energyEfficiency - b.energyEfficiency || a.power - b.power),
  upgrades: {
    powerUpgradePriceConfig: upgrades.powerUpgradePriceConfig,
    energyEfficiencyUpgradePriceConfig: upgrades.energyEfficiencyUpgradePriceConfig
  }
}

const file = resolve(fileURLToPath(new URL('..', import.meta.url)), 'data/gomining-snapshot.json')
writeFileSync(file, `${JSON.stringify(snapshot, null, 2)}\n`)
// eslint-disable-next-line no-console
console.log(`Saved ${snapshot.presets.length} miner presets, ${snapshot.upgrades.powerUpgradePriceConfig.length} valuation steps and the ${income.createdAt.slice(0, 10)} payout to ${file}`)
