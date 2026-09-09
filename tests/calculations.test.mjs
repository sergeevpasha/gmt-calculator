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

const { marketSnapshot, normalizeMarket } = loadModule('data/gomining')
const { useInvest } = loadModule('composables/useInvest')
const { nftProfitCalculator, bestOption, minerPrice, efficiencyUpgrade, baseEfficiencies, minEfficiency, maxPower } = useInvest(() => marketSnapshot)
const round = number => Number(number.toFixed(2))
const BTC_PRICE = 78000
const REWARD = marketSnapshot.rewardSatPerThDay

function assertAccounting (result, btcPrice) {
  const gross = round(result.reward / 100000000 * btcPrice)
  assert.equal(result.profit, round(gross - result.powerCostC1 - result.serviceCostC2))
  Object.values(result).forEach(value => assert.ok(Number.isFinite(value)))
}

test('the bundled GoMining snapshot normalizes into calculator inputs', () => {
  assert.equal(marketSnapshot.source, 'snapshot')
  assert.equal(marketSnapshot.rewardSatPerThDay, round(marketSnapshot.rewardUsdPerThDay / marketSnapshot.btcPriceUsd * 100000000))
  assert.equal(marketSnapshot.kwhPriceUsd, 0.05)
  assert.equal(marketSnapshot.serviceUsdPerThDay, 0.0089)
  // Arrays cross the vm realm boundary, so compare their contents rather than their prototypes.
  assert.equal(baseEfficiencies().join(), '15,12')
  assert.equal(minEfficiency(), 12)
  assert.equal(maxPower(), 5000)
})

test('malformed API responses are rejected instead of producing zero prices', () => {
  const snapshot = JSON.parse(readFileSync(resolve(root, 'data/gomining-snapshot.json'), 'utf8'))
  assert.throws(() => normalizeMarket({ ...snapshot, income: { ...snapshot.income, btcCourseInUsd: 0 } }, 'live'))
  assert.throws(() => normalizeMarket({ ...snapshot, presets: [] }, 'live'))
  assert.throws(() => normalizeMarket({ ...snapshot, upgrades: { energyEfficiencyUpgradePriceConfig: [] } }, 'live'))
  assert.equal(normalizeMarket(snapshot, 'live').source, 'live')
})

test('preset sizes cost exactly the GoMining store price and other sizes interpolate', () => {
  assert.equal(minerPrice(1, 15), 14.99)
  assert.equal(minerPrice(8, 15), 109.99)
  assert.equal(minerPrice(5000, 15), 58333.99)
  assert.equal(minerPrice(2, 12), 37.79)
  assert.equal(minerPrice(3, 15), round(27.99 + (55.99 - 27.99) / 2))
  assert.equal(minerPrice(6000, 15), round(58333.99 * 6000 / 5000))
  assert.ok(Number.isNaN(minerPrice(1, 99)))
})

test('efficiency upgrades sum the per-step prices down to the target level', () => {
  assert.equal(efficiencyUpgrade(15, 15), 0)
  assert.equal(efficiencyUpgrade(15, 12), round(3 * marketSnapshot.efficiencyUpgradePrices[12]))
  assert.equal(efficiencyUpgrade(20, 15), round(5 * marketSnapshot.efficiencyUpgradePrices[15]))
  const result = nftProfitCalculator(12, 10, 0, REWARD, BTC_PRICE, 15)
  assert.equal(result.powerCost, minerPrice(10, 15))
  assert.equal(result.efficiencyCost, round(efficiencyUpgrade(15, 12) * 10))
  assert.equal(result.baseEfficiency, 15)
})

test('daily fees follow the live electricity and service rates', () => {
  const result = nftProfitCalculator(15, 100, 0, REWARD, BTC_PRICE, 15)
  assert.equal(result.powerCostC1, round(marketSnapshot.kwhPriceUsd * 24 * 15 / 1000 * 100))
  assert.equal(result.serviceCostC2, round(marketSnapshot.serviceUsdPerThDay * 100))
  assertAccounting(result, BTC_PRICE)
})

test('investment results reconcile with rewards, fees, ROI, and the budget', () => {
  for (const baseEfficiency of [0, 15, 12]) {
    const result = bestOption(1000, BTC_PRICE, REWARD, 10, baseEfficiency)
    assertAccounting(result, BTC_PRICE)
    assert.ok(result.powerCost + result.efficiencyCost <= 1000)
    assert.ok(result.efficiency >= 12 && result.efficiency <= result.baseEfficiency)
    assert.ok(baseEfficiency === 0 || result.baseEfficiency === baseEfficiency)
    assert.ok(Math.abs(result.rateOfInvestment - result.profit * 365 / 1000 * 100) < 0.011)
  }
})

test('comparing every efficiency is at least as profitable as fixing one', () => {
  const best = bestOption(2500, BTC_PRICE, REWARD, 10, 0).profit
  for (const baseEfficiency of baseEfficiencies()) {
    assert.ok(best >= bestOption(2500, BTC_PRICE, REWARD, 10, baseEfficiency).profit)
  }
})

test('recommended profit matches an exhaustive affordable-miner comparison', () => {
  let expectedProfit = -Infinity
  for (const baseEfficiency of baseEfficiencies()) {
    for (let efficiency = 12; efficiency <= baseEfficiency; efficiency++) {
      for (let power = 1; power <= 30; power++) {
        const candidate = nftProfitCalculator(efficiency, power, 10, REWARD, BTC_PRICE, baseEfficiency)
        if (candidate.powerCost + candidate.efficiencyCost <= 300) {
          expectedProfit = Math.max(expectedProfit, candidate.profit)
        }
      }
    }
  }
  assert.equal(bestOption(300, BTC_PRICE, REWARD, 10, 0).profit, expectedProfit)
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
  assert.equal(result.powerCost, 0)
  assert.equal(result.profit, 0)
  assert.equal(result.rateOfInvestment, 0)
})

test('a full maintenance discount removes both operating fees', () => {
  const result = nftProfitCalculator(12, 50, 100, REWARD, BTC_PRICE, 12)
  assert.equal(result.powerCostC1, 0)
  assert.equal(result.serviceCostC2, 0)
  assertAccounting(result, BTC_PRICE)
})

test('zero mining rewards still account for operating costs', () => {
  const result = nftProfitCalculator(15, 25, 10, 0, BTC_PRICE, 15)
  assert.equal(result.reward, 0)
  assert.ok(result.profit < 0)
  assertAccounting(result, BTC_PRICE)
})

test('large budgets respect the largest GoMining preset and return finite values', () => {
  const result = bestOption(1000000, BTC_PRICE, REWARD, 10, 0)
  assert.equal(result.power, 5000)
  assert.equal(result.efficiency, 12)
  assertAccounting(result, BTC_PRICE)
})
