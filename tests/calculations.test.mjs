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
const { nftProfitCalculator, bestOption, minerPrice, referencePrice, efficiencyUpgrade, referenceEfficiency, minEfficiency, maxEfficiency, maxPower } = useInvest(() => marketSnapshot)
const round = number => Number(number.toFixed(2))
const BTC_PRICE = 78000
const REWARD = marketSnapshot.rewardSatPerThDay
const rawSnapshot = () => JSON.parse(readFileSync(resolve(root, 'data/gomining-snapshot.json'), 'utf8'))

function assertAccounting (result, btcPrice) {
  const gross = round(result.reward / 100000000 * btcPrice)
  assert.equal(result.profit, round(gross - result.powerCostC1 - result.serviceCostC2))
  assert.equal(result.price, round(result.referencePrice - result.efficiencyDiscount))
  Object.values(result).forEach(value => assert.ok(Number.isFinite(value)))
}

test('the bundled GoMining snapshot normalizes into calculator inputs', () => {
  assert.equal(marketSnapshot.source, 'snapshot')
  assert.equal(marketSnapshot.rewardSatPerThDay, round(marketSnapshot.rewardUsdPerThDay / marketSnapshot.btcPriceUsd * 100000000))
  assert.equal(marketSnapshot.kwhPriceUsd, 0.05)
  assert.equal(marketSnapshot.serviceUsdPerThDay, 0.0089)
  assert.equal(marketSnapshot.referenceEfficiency, 12)
  assert.ok(marketSnapshot.miners.every(miner => miner.efficiency === 12))
  assert.equal(referenceEfficiency(), 12)
  assert.equal(minEfficiency(), EFFICIENCY_RANGE.min)
  assert.equal(maxEfficiency(), EFFICIENCY_RANGE.max)
  assert.equal(maxPower(), 5000)
  assert.equal(Object.keys(marketSnapshot.efficiencyUpgradePrices).join(), '12,13,14,15,16,17,18,19')
})

test('malformed API responses are rejected instead of producing zero prices', () => {
  const snapshot = rawSnapshot()
  assert.throws(() => normalizeMarket({ ...snapshot, income: { ...snapshot.income, btcCourseInUsd: 0 } }, 'live'))
  assert.throws(() => normalizeMarket({ ...snapshot, presets: [] }, 'live'))
  assert.throws(() => normalizeMarket({ ...snapshot, upgrades: { energyEfficiencyUpgradePriceConfig: [] } }, 'live'))
  assert.throws(() => normalizeMarket({ ...snapshot, upgrades: { energyEfficiencyUpgradePriceConfig: snapshot.upgrades.energyEfficiencyUpgradePriceConfig.filter(step => step.toLevel !== 16) } }, 'live'))
  assert.equal(normalizeMarket(snapshot, 'live').source, 'live')
})

test('the best efficiency on sale becomes the reference ladder', () => {
  const snapshot = rawSnapshot()
  const market = normalizeMarket({ ...snapshot, presets: snapshot.presets.filter(preset => preset.energyEfficiency === 15) }, 'live')
  assert.equal(market.referenceEfficiency, 15)
  assert.equal(Object.keys(market.efficiencyUpgradePrices).join(), '15,16,17,18,19')
  assert.equal(market.miners.find(miner => miner.power === 1).priceUsd, 14.99)
})

test('preset sizes cost exactly the GoMining store price and other sizes interpolate', () => {
  assert.equal(referencePrice(1), 18.99)
  assert.equal(referencePrice(8), 149.99)
  assert.equal(referencePrice(5000), 86228.99)
  assert.equal(referencePrice(3), round(37.79 + (75.19 - 37.79) / 2))
  assert.equal(referencePrice(6000), round(86228.99 * 6000 / 5000))
  assert.equal(minerPrice(1, 12), 18.99)
})

test('other efficiencies are priced as the reference price minus the official upgrade cost', () => {
  const steps = marketSnapshot.efficiencyUpgradePrices
  assert.equal(efficiencyUpgrade(15, 12), round(steps[14] + steps[13] + steps[12]))
  assert.equal(efficiencyUpgrade(20, 12), round(steps[19] + steps[18] + steps[17] + steps[16] + steps[15] + steps[14] + steps[13] + steps[12]))
  assert.equal(minerPrice(1, 15), round(18.99 - efficiencyUpgrade(15, 12)))
  assert.equal(minerPrice(10, 17), round(referencePrice(10) - efficiencyUpgrade(17, 12) * 10))
  assert.ok(minerPrice(1, 20) < minerPrice(1, 19) && minerPrice(1, 19) < minerPrice(1, 12))
  assert.ok(Number.isNaN(minerPrice(1, 21)))
  assert.ok(Number.isNaN(minerPrice(1, 11)))
  assert.ok(Number.isNaN(minerPrice(1, 12.5)))
  const result = nftProfitCalculator(17, 10, 0, REWARD, BTC_PRICE)
  assert.equal(result.referencePrice, referencePrice(10))
  assert.equal(result.efficiencyDiscount, round(efficiencyUpgrade(17, 12) * 10))
  assert.equal(result.price, minerPrice(10, 17))
  assertAccounting(result, BTC_PRICE)
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

test('recommended profit matches an exhaustive affordable-miner comparison', () => {
  let expectedProfit = -Infinity
  for (let efficiency = EFFICIENCY_RANGE.min; efficiency <= EFFICIENCY_RANGE.max; efficiency++) {
    for (let power = 1; power <= 150; power++) {
      const candidate = nftProfitCalculator(efficiency, power, 10, REWARD, BTC_PRICE)
      if (candidate.price <= 300) {
        expectedProfit = Math.max(expectedProfit, candidate.profit)
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

test('large budgets respect the largest GoMining preset and return finite values', () => {
  const result = bestOption(1000000, BTC_PRICE, REWARD, 10, 0)
  assert.equal(result.power, 5000)
  assertAccounting(result, BTC_PRICE)
})
