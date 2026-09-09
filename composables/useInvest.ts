import { EFFICIENCY_RANGE } from '~/data/gomining'
import type { MarketData, MinerPreset } from '~/data/gomining'

export interface MiningEstimate {
  // Satoshi per day.
  reward: number
  // USD per day after electricity and service fees.
  profit: number
  // Electricity, USD per day.
  powerCostC1: number
  // Service fee, USD per day.
  serviceCostC2: number
  // Price of the same power at GoMining's reference efficiency, USD.
  referencePrice: number
  // GoMining's upgrade cost from this efficiency back to the reference level, USD. Deducted from the reference price.
  efficiencyDiscount: number
  // Price of the miner at its efficiency, USD.
  price: number
  // Annual return on the investment, %.
  rateOfInvestment: number
  power: number
  efficiency: number
}

const ladderCache = new WeakMap<MarketData, MinerPreset[]>()

export const useInvest = (getMarket: () => MarketData) => {
  const round = (value: number) => parseFloat(value.toFixed(2))

  // Efficiency GoMining sells new miners at.
  function referenceEfficiency () {
    return getMarket().referenceEfficiency
  }

  function minEfficiency () {
    return Math.max(EFFICIENCY_RANGE.min, referenceEfficiency())
  }

  function maxEfficiency () {
    return EFFICIENCY_RANGE.max
  }

  function maxPower () {
    return Math.max(...getMarket().miners.map(miner => miner.power))
  }

  function ladder () {
    const market = getMarket()
    let list = ladderCache.get(market)
    if (!list) {
      list = [...market.miners].sort((a, b) => a.power - b.power)
      ladderCache.set(market, list)
    }
    return list
  }

  // Price of a new miner at the reference efficiency, interpolated between GoMining's presets so preset sizes cost
  // exactly the store price.
  function referencePrice (power: number) {
    const list = ladder()
    if (!list.length || !(power > 0)) {
      return NaN
    }
    const first = list[0]
    const last = list[list.length - 1]
    if (power <= first.power) {
      return round(first.priceUsd * power / first.power)
    }
    if (power >= last.power) {
      return round(last.priceUsd * power / last.power)
    }
    const next = list.findIndex(preset => preset.power >= power)
    const lower = list[next - 1]
    const upper = list[next]
    return round(lower.priceUsd + (upper.priceUsd - lower.priceUsd) * (power - lower.power) / (upper.power - lower.power))
  }

  // Price per TH for upgrading from one W/TH level down to another.
  function efficiencyUpgrade (fromEfficiency: number, toEfficiency: number) {
    const prices = getMarket().efficiencyUpgradePrices
    let cost = 0
    for (let level = fromEfficiency - 1; level >= toEfficiency; level--) {
      cost += prices[level] ?? 0
    }
    return round(cost)
  }

  // GoMining sells one efficiency; a miner at another level is worth the reference price minus GoMining's cost of
  // upgrading it back to the reference level.
  function minerPrice (power: number, efficiency: number) {
    if (!Number.isInteger(efficiency) || efficiency < minEfficiency() || efficiency > maxEfficiency()) {
      return NaN
    }
    const price = round(referencePrice(power) - efficiencyUpgrade(efficiency, referenceEfficiency()) * power)
    return price > 0 ? price : NaN
  }

  function powerCost (energyEfficiency: number, power: number, userDiscount: number) {
    const perTerahash = getMarket().kwhPriceUsd * 24 * energyEfficiency / 1000
    return round((perTerahash - (perTerahash / 100 * userDiscount)) * power)
  }

  function serviceCost (userDiscount: number, power: number) {
    const perTerahash = getMarket().serviceUsdPerThDay
    return round((perTerahash - (perTerahash / 100 * userDiscount)) * power)
  }

  function profit (satoshiReward: number, btcPrice: number, powerCost: number, serviceCost: number) {
    const usdReward = round(satoshiReward / 100000000 * btcPrice)
    return round(usdReward - powerCost - serviceCost)
  }

  function rateOfInvestment (moneyToSpend: number, potentialProfit: number) {
    if (moneyToSpend === 0) {
      return 0
    }
    return round(365 / (moneyToSpend / potentialProfit) * 100)
  }

  function estimate (efficiency: number, power: number, userDiscount: number, satoshiReward: number, btcPrice: number, investment?: number): MiningEstimate {
    const potentialReferencePrice = referencePrice(power)
    const price = minerPrice(power, efficiency)
    const potentialProfit = profit(satoshiReward * power, btcPrice, powerCost(efficiency, power, userDiscount), serviceCost(userDiscount, power))

    return {
      reward: satoshiReward * power,
      profit: potentialProfit,
      powerCostC1: powerCost(efficiency, power, userDiscount),
      serviceCostC2: serviceCost(userDiscount, power),
      referencePrice: potentialReferencePrice,
      efficiencyDiscount: round(potentialReferencePrice - price),
      price,
      rateOfInvestment: rateOfInvestment(investment ?? price, potentialProfit),
      power,
      efficiency
    }
  }

  function nftProfitCalculator (efficiency: number, power: number, userDiscount: number, satoshiReward: number, btcPrice: number) {
    return estimate(efficiency, power, userDiscount, satoshiReward, btcPrice)
  }

  // Finds the miner with the highest daily profit for the budget. An efficiency of 0 compares every level from the
  // reference efficiency to the least efficient one. Equal profits prefer the cheaper miner.
  function bestOption (moneyToSpend: number, btcPrice: number, satoshiReward: number, userDiscount: number, efficiency: number = 0): MiningEstimate {
    const efficiencies = efficiency ? [efficiency] : Array.from({ length: maxEfficiency() - minEfficiency() + 1 }, (_, index) => maxEfficiency() - index)
    const powerLimit = maxPower()
    let best: MiningEstimate | null = null

    for (const level of efficiencies) {
      for (let power = 1; power <= powerLimit; power++) {
        const cost = minerPrice(power, level)
        if (Number.isNaN(cost) || cost > moneyToSpend) {
          break
        }

        const candidate = estimate(level, power, userDiscount, satoshiReward, btcPrice, moneyToSpend)
        if (!best || candidate.profit > best.profit || (candidate.profit === best.profit && cost < best.price)) {
          best = candidate
        }
      }
    }

    return best ?? {
      reward: 0,
      profit: 0,
      powerCostC1: 0,
      serviceCostC2: 0,
      referencePrice: 0,
      efficiencyDiscount: 0,
      price: 0,
      rateOfInvestment: 0,
      power: 0,
      efficiency: efficiencies[0]
    }
  }

  return { nftProfitCalculator, bestOption, minerPrice, referencePrice, efficiencyUpgrade, referenceEfficiency, minEfficiency, maxEfficiency, maxPower }
}
