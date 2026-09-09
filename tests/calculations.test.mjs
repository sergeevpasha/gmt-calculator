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

const { EFFICIENCY_RANGE, BAND_DECAY, marketSnapshot, normalizeMarket } = loadModule('data/gomining')
const { useInvest } = loadModule('composables/useInvest')
const { nftProfitCalculator, bestOption, minerPrice, marginalPrice, energyBonus, priceBreakdown, minEfficiency, maxEfficiency, maxPower } = useInvest(() => marketSnapshot)
const round = number => Number(number.toFixed(2))
const BTC_PRICE = 78000
const REWARD = marketSnapshot.rewardSatPerThDay
const rawSnapshot = () => JSON.parse(readFileSync(resolve(root, 'data/gomining-snapshot.json'), 'utf8'))

function assertAccounting (result, btcPrice) {
  const gross = round(result.reward / 100000000 * btcPrice)
  assert.equal(result.profit, round(gross - result.powerCostC1 - result.serviceCostC2))
  assert.equal(result.price, round(result.basePrice + result.energyBonus + result.powerBonus))
  Object.values(result).forEach(value => assert.ok(Number.isFinite(value)))
}

test('the bundled GoMining snapshot normalizes into calculator inputs', () => {
  assert.equal(marketSnapshot.source, 'snapshot')
  assert.equal(marketSnapshot.rewardSatPerThDay, round(marketSnapshot.rewardUsdPerThDay / marketSnapshot.btcPriceUsd * 100000000))
  assert.equal(marketSnapshot.kwhPriceUsd, 0.05)
  assert.equal(marketSnapshot.serviceUsdPerThDay, 0.0089)
  assert.equal(marketSnapshot.referenceEfficiency, 12)
  assert.equal(marketSnapshot.basePriceUsd, 18.99)
  assert.equal(marketSnapshot.bandDecay, BAND_DECAY)
  assert.equal(minEfficiency(), EFFICIENCY_RANGE.min)
  assert.equal(maxEfficiency(), EFFICIENCY_RANGE.max)
  assert.equal(maxPower(), 5000)
})

test('malformed API responses are rejected instead of producing zero prices', () => {
  const snapshot = rawSnapshot()
  assert.throws(() => normalizeMarket({ ...snapshot, income: { ...snapshot.income, btcCourseInUsd: 0 } }, 'live'))
  assert.throws(() => normalizeMarket({ ...snapshot, presets: [] }, 'live'))
  assert.throws(() => normalizeMarket({ ...snapshot, presets: snapshot.presets.filter(preset => preset.power !== 1) }, 'live'))
  assert.throws(() => normalizeMarket({ ...snapshot, upgrades: { ...snapshot.upgrades, powerUpgradePriceConfig: [] } }, 'live'))
  assert.equal(normalizeMarket(snapshot, 'live').source, 'live')
})

test('reproduces GoMinings own quote for the next TH on a 128 TH miner at 20 W/TH', () => {
  assert.equal(marginalPrice(128, 20), 7.36)
  const exact = marketSnapshot.basePriceUsd * Math.pow(marketSnapshot.bandDecay, 9) + energyBonus(20)
  assert.ok(Math.abs(exact - 7.35581583) < 0.0000001, `expected 7.35581583, got ${exact}`)
})

test('energy value per TH follows GoMinings power upgrade steps', () => {
  assert.equal(energyBonus(12), 0)
  assert.equal(round(energyBonus(20)), -10.15)
  for (let efficiency = 13; efficiency <= 20; efficiency++) {
    assert.ok(energyBonus(efficiency) < energyBonus(efficiency - 1), 'a worse efficiency must be worth less')
  }
})

test('the base price is GoMinings listed 1 TH price and the ladder is tracked closely', () => {
  assert.equal(minerPrice(1, 12), 18.99)
  for (const preset of marketSnapshot.miners.filter(miner => miner.power >= 1 && miner.power <= 128)) {
    const error = Math.abs(minerPrice(preset.power, 12) - preset.priceUsd) / preset.priceUsd
    assert.ok(error < 0.01, `${preset.power} TH is ${(error * 100).toFixed(2)}% off the listed price`)
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

test('price breakdown adds up', () => {
  const breakdown = priceBreakdown(128, 20)
  assert.equal(breakdown.basePrice, 18.99)
  assert.equal(round(breakdown.energyBonus), -10.15)
  assert.equal(breakdown.price, round(breakdown.basePrice + breakdown.energyBonus + breakdown.powerBonus))
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
