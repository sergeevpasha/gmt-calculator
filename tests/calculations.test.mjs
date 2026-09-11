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

const { EFFICIENCY_RANGE, marketSnapshot, normalizeMarket, parseSnapshot } = loadModule('data/gomining')
const { useInvest } = loadModule('composables/useInvest')
const { nftProfitCalculator, bestOption, cheapestTerahash, minerPrice, priceAt, energyBonus, efficiencyUpgradeCost, upgradeOptions, publishedEfficiencies, minEfficiency, maxEfficiency, maxPower } = useInvest(() => marketSnapshot)
const round = number => Number(number.toFixed(2))
const BTC_PRICE = 78000
const REWARD = marketSnapshot.rewardSatPerThDay
const rawSnapshot = () => JSON.parse(readFileSync(resolve(root, 'data/gomining-snapshot.json'), 'utf8'))

function assertAccounting (result, btcPrice) {
  const gross = round(result.reward / 100000000 * btcPrice)
  assert.equal(result.profit, round(gross - result.powerCostC1 - result.serviceCostC2))
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
  const read = value => normalizeMarket(parseSnapshot(value), 'live')
  assert.throws(() => read({ ...snapshot, income: { ...snapshot.income, btcCourseInUsd: 0 } }))
  assert.throws(() => read({ ...snapshot, income: { ...snapshot.income, createdAt: undefined } }))
  assert.throws(() => read({ ...snapshot, presets: [] }))
  assert.throws(() => read({ ...snapshot, presets: snapshot.presets.filter(preset => preset.power !== 1) }))
  assert.throws(() => read({ ...snapshot, upgrades: { ...snapshot.upgrades, powerUpgradePriceConfig: [] } }))
  assert.equal(read(snapshot).source, 'live')
})

test('unusable rows are dropped and the rest of a response still reads', () => {
  const snapshot = rawSnapshot()
  const parsed = parseSnapshot({ ...snapshot, presets: [...snapshot.presets, { power: '1', energyEfficiency: 12, priceUsdt: 5 }, null] })
  assert.equal(parsed.presets.length, snapshot.presets.length)
  assert.deepEqual(normalizeMarket(parsed, 'live').ladders, marketSnapshot.ladders)
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
})

test('efficiency upgrade costs match GoMinings own quotes for a 128 TH miner at 20 W/TH', () => {
  // Measured in the GoMining app on 2026-09-09, upgrade dialog on miner #3876.
  const quoted = { 19: 140.8, 18: 281.6, 17: 422.4, 16: 563.2, 15: 704, 14: 1045.376, 13: 1386.752, 12: 1728.128 }
  for (const [target, total] of Object.entries(quoted)) {
    assert.ok(Math.abs(efficiencyUpgradeCost(20, Number(target), 128) - total) < 0.01,
      `20 -> ${target} W/TH should cost ${total}, got ${efficiencyUpgradeCost(20, Number(target), 128)}`)
  }
  assert.equal(efficiencyUpgradeCost(20, 20, 128), 0)
})

test('upgrade options list every better level with a payback', () => {
  const options = upgradeOptions(20, 128, 0)
  assert.equal(options.length, 8)
  assert.equal(options[0].efficiency, 19)
  assert.equal(options[options.length - 1].efficiency, 12)
  for (const option of options) {
    assert.ok(option.cost > 0)
    assert.ok(option.savingPerDay > 0, 'a better efficiency must save electricity')
    assert.ok(option.paybackDays > 0)
  }
  // Cost and saving both grow as the target improves.
  for (let i = 1; i < options.length; i++) {
    assert.ok(options[i].cost > options[i - 1].cost)
    assert.ok(options[i].savingPerDay > options[i - 1].savingPerDay)
  }
  // A miner already at the best level has nothing to upgrade to.
  assert.equal(upgradeOptions(12, 128, 0).length, 0)
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

test('the 1 TH price quoted for a small budget is where the search starts buying', () => {
  const choices = [0, ...Array.from({ length: EFFICIENCY_RANGE.max - EFFICIENCY_RANGE.min + 1 }, (_, index) => EFFICIENCY_RANGE.min + index)]
  for (const efficiency of choices) {
    const cheapest = cheapestTerahash(efficiency)
    assert.ok(efficiency === 0 || cheapest.efficiency === efficiency, `${efficiency} W/TH must quote its own price`)
    assert.equal(cheapest.price, minerPrice(1, cheapest.efficiency))
    assert.equal(bestOption(cheapest.price - 0.01, BTC_PRICE, REWARD, 10, efficiency).power, 0)
    assert.equal(bestOption(cheapest.price, BTC_PRICE, REWARD, 10, efficiency).power, 1)
  }
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
