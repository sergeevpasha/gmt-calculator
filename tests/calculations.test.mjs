import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import vm from 'node:vm'
import typescript from 'typescript'

// The installed TypeScript version exposes its compiler through CommonJS.
// eslint-disable-next-line import/no-named-as-default-member
const { transpileModule, ModuleKind, ScriptTarget } = typescript
const root = resolve(fileURLToPath(new URL('..', import.meta.url)))

// Load Nuxt's TypeScript modules without starting a browser or Nuxt server.
function loadModule (filename) {
  const source = readFileSync(resolve(root, `${filename}.ts`), 'utf8')
  const { outputText } = transpileModule(source, { compilerOptions: { module: ModuleKind.CommonJS, target: ScriptTarget.ES2022, esModuleInterop: true } })
  const exports = {}
  const require = (name) => {
    if (name.endsWith('.json')) { return JSON.parse(readFileSync(resolve(root, dirname(filename), name), 'utf8')) }
    return loadModule(name.startsWith('~/') ? name.slice(2) : join(dirname(filename), name))
  }
  vm.runInNewContext(outputText, { exports, require })
  return exports
}

const { EFFICIENCY_RANGE, marketSnapshot, normalizeMarket } = loadModule('data/gomining')
const { useInvest } = loadModule('composables/useInvest')
const { nftProfitCalculator, bestOption, minerPrice, marginalPrice, priceAt, energyBonus, priceBreakdown, publishedEfficiencies, minEfficiency, maxEfficiency, maxPower } = useInvest(() => marketSnapshot)
const round = number => Number(number.toFixed(2))
const BTC_PRICE = 78000
const REWARD = marketSnapshot.rewardSatPerThDay
const rawSnapshot = () => JSON.parse(readFileSync(resolve(root, 'data/gomining-snapshot.json'), 'utf8'))

function assertAccounting (result, btcPrice) {
  const gross = round(result.reward / 100000000 * btcPrice)
  assert.equal(result.profit, round(gross - result.powerCostC1 - result.serviceCostC2))
  assert.equal(result.price, round(result.listedPrice + result.efficiencyAdjustment))
  Object.values(result).forEach(value => assert.ok(Number.isFinite(value)))
}

test('every calculator input comes from the fetched snapshot, nothing is hardcoded', () => {
  assert.equal(marketSnapshot.source, 'snapshot')
  assert.equal(marketSnapshot.rewardSatPerThDay, round(marketSnapshot.rewardUsdPerThDay / marketSnapshot.btcPriceUsd * 100000000))
  assert.equal(marketSnapshot.referenceEfficiency, 12)
  assert.equal(marketSnapshot.basePriceUsd, marketSnapshot.miners.find(miner => miner.power === 1).priceUsd)
  assert.ok(marketSnapshot.powerUpgradeSteps.length > 0)
  assert.equal(minEfficiency(), EFFICIENCY_RANGE.min)
  assert.equal(maxEfficiency(), EFFICIENCY_RANGE.max)
  assert.equal(maxPower(), 5000)
  // No fitted or pinned constant may reappear in the data module.
  const source = readFileSync(resolve(root, 'data/gomining.ts'), 'utf8')
  assert.ok(!/BAND_DECAY|bandDecay/.test(source), 'a pinned decay constant is back in data/gomining.ts')
  const model = readFileSync(resolve(root, 'composables/useInvest.ts'), 'utf8')
  assert.ok(!/0\.99\d{6}/.test(model), 'a hardcoded decay literal is back in composables/useInvest.ts')
})

test('malformed API responses are rejected instead of producing zero prices', () => {
  const snapshot = rawSnapshot()
  assert.throws(() => normalizeMarket({ ...snapshot, income: { ...snapshot.income, btcCourseInUsd: 0 } }, 'live'))
  assert.throws(() => normalizeMarket({ ...snapshot, presets: [] }, 'live'))
  assert.throws(() => normalizeMarket({ ...snapshot, presets: snapshot.presets.filter(preset => preset.power !== 1) }, 'live'))
  assert.throws(() => normalizeMarket({ ...snapshot, upgrades: { ...snapshot.upgrades, powerUpgradePriceConfig: [] } }, 'live'))
  assert.equal(normalizeMarket(snapshot, 'live').source, 'live')
})

test('every listed size on every published ladder costs exactly what GoMining charges', () => {
  const snapshot = rawSnapshot()
  for (const efficiency of publishedEfficiencies()) {
    const listed = snapshot.presets.filter(preset => preset.energyEfficiency === efficiency)
    assert.ok(listed.length >= 3, `no listed sizes at ${efficiency} W/TH`)
    for (const preset of listed) {
      assert.equal(minerPrice(preset.power, efficiency), round(preset.priceUsdt), `${preset.power} TH at ${efficiency} W/TH`)
    }
  }
})

test('GoMining publishes more than one ladder and both are used', () => {
  assert.ok(publishedEfficiencies().length >= 2, 'expected at least two published ladders')
  assert.equal(publishedEfficiencies()[0], marketSnapshot.referenceEfficiency)
})

test('levels between two published ladders interpolate between their real prices', () => {
  const [low, high] = publishedEfficiencies()
  const power = 128
  const a = priceAt(power, low)
  const b = priceAt(power, high)
  for (let efficiency = low + 1; efficiency < high; efficiency++) {
    const price = priceAt(power, efficiency)
    assert.ok(price < a && price > b, `${efficiency} W/TH must sit between the two ladders`)
  }
  const mid = low + (high - low) / 2
  if (Number.isInteger(mid)) {
    assert.ok(Math.abs(priceAt(power, mid) - (a + b) / 2) < 0.01)
  }
})

test('sizes between listed ones interpolate along the ladder', () => {
  const two = marketSnapshot.miners.find(miner => miner.power === 2).priceUsd
  const four = marketSnapshot.miners.find(miner => miner.power === 4).priceUsd
  assert.equal(round(priceAt(3, 12)), round(two + (four - two) / 2))
})

test('energy value per TH comes from GoMinings own step table', () => {
  assert.equal(energyBonus(12), 0)
  assert.equal(round(energyBonus(20)), -10.15)
  for (let efficiency = 13; efficiency <= 20; efficiency++) {
    assert.ok(energyBonus(efficiency) < energyBonus(efficiency - 1), 'a worse efficiency must be worth less')
  }
})

test('a worse efficiency costs less up front at every size', () => {
  for (const power of [1, 16, 128, 5000]) {
    for (let efficiency = 13; efficiency <= 20; efficiency++) {
      assert.ok(minerPrice(power, efficiency) < minerPrice(power, efficiency - 1))
    }
  }
  assert.ok(Number.isNaN(minerPrice(1, 21)))
  assert.ok(Number.isNaN(minerPrice(1, 11)))
  assert.ok(Number.isNaN(minerPrice(1, 12.5)))
})

test('price breakdown adds up and the marginal follows the curve at that efficiency', () => {
  const breakdown = priceBreakdown(128, 20)
  assert.equal(breakdown.price, round(breakdown.listedPrice + breakdown.efficiencyAdjustment))
  assert.equal(breakdown.listedPrice, round(marketSnapshot.miners.find(miner => miner.power === 128).priceUsd))
  for (const efficiency of [12, 15, 20]) {
    assert.equal(marginalPrice(128, efficiency), round(priceAt(129, efficiency) - priceAt(128, efficiency)))
    assert.ok(marginalPrice(128, efficiency) > 0)
  }
  // A worse efficiency must always make the next TH cheaper.
  assert.ok(marginalPrice(128, 20) < marginalPrice(128, 15))
  assert.ok(marginalPrice(128, 15) < marginalPrice(128, 12))
})

test('daily fees follow the live electricity and service rates', () => {
  const result = nftProfitCalculator(15, 100, 0, REWARD, BTC_PRICE)
  assert.equal(result.powerCostC1, round(marketSnapshot.kwhPriceUsd * 24 * 15 / 1000 * 100))
  assert.equal(result.serviceCostC2, round(marketSnapshot.serviceUsdPerThDay * 100))
  assertAccounting(result, BTC_PRICE)
})

test('investment results reconcile with rewards, fees, ROI, and the budget', () => {
  for (const efficiency of [0, 12, 15, 17, 20]) {
    const result = bestOption(1000, BTC_PRICE, REWARD, 10, efficiency)
    assertAccounting(result, BTC_PRICE)
    assert.ok(result.price <= 1000)
    assert.ok(result.efficiency >= EFFICIENCY_RANGE.min && result.efficiency <= EFFICIENCY_RANGE.max)
    assert.ok(efficiency === 0 || result.efficiency === efficiency)
    assert.ok(Math.abs(result.rateOfInvestment - result.profit * 365 / 1000 * 100) < 0.011)
  }
})

test('comparing every efficiency is at least as profitable as fixing one', () => {
  const best = bestOption(2500, BTC_PRICE, REWARD, 10, 0).profit
  for (let efficiency = EFFICIENCY_RANGE.min; efficiency <= EFFICIENCY_RANGE.max; efficiency++) {
    assert.ok(best >= bestOption(2500, BTC_PRICE, REWARD, 10, efficiency).profit)
  }
})

test('unprofitable scenarios report the actual loss', () => {
  const result = bestOption(1000, 10000, REWARD, 10, 0)
  assert.ok(result.profit < 0)
  assert.ok(result.rateOfInvestment < 0)
  assertAccounting(result, 10000)
})

test('budgets below the first TH price do not fabricate a free miner', () => {
  const result = bestOption(1, BTC_PRICE, REWARD, 10, 0)
  assert.equal(result.power, 0)
  assert.equal(result.reward, 0)
  assert.equal(result.price, 0)
  assert.equal(result.profit, 0)
  assert.equal(result.rateOfInvestment, 0)
})

test('a full maintenance discount removes both operating fees', () => {
  const result = nftProfitCalculator(12, 50, 100, REWARD, BTC_PRICE)
  assert.equal(result.powerCostC1, 0)
  assert.equal(result.serviceCostC2, 0)
  assertAccounting(result, BTC_PRICE)
})

test('zero mining rewards still account for operating costs', () => {
  const result = nftProfitCalculator(15, 25, 10, 0, BTC_PRICE)
  assert.equal(result.reward, 0)
  assert.ok(result.profit < 0)
  assertAccounting(result, BTC_PRICE)
})

test('large budgets respect the largest GoMining size and return finite values', () => {
  const result = bestOption(1000000, BTC_PRICE, REWARD, 10, 0)
  assert.equal(result.power, 5000)
  assertAccounting(result, BTC_PRICE)
})
