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
  // Price of the miner, USD.
  price: number
  // GoMining's listed price for this power at the efficiency it sells.
  listedPrice: number
  // What this efficiency subtracts from the listed price, USD (negative below the reference efficiency).
  efficiencyAdjustment: number
  // Price of adding one more TH at this size and efficiency, USD.
  marginalPrice: number
  // Annual return on the investment, %.
  rateOfInvestment: number
  power: number
  efficiency: number
}

const ladderCache = new WeakMap<MarketData, MinerPreset[]>()

export const useInvest = (getMarket: () => MarketData) => {
  const round = (value: number) => parseFloat(value.toFixed(2))

  function minEfficiency () {
    return EFFICIENCY_RANGE.min
  }

  function maxEfficiency () {
    return EFFICIENCY_RANGE.max
  }

  // GoMining's published price ladder for the efficiency it sells, ascending by power.
  function ladder () {
    const market = getMarket()
    let list = ladderCache.get(market)
    if (!list) {
      list = [...market.miners].sort((a, b) => a.power - b.power)
      ladderCache.set(market, list)
    }
    return list
  }

  function maxPower () {
    const list = ladder()
    return list[list.length - 1].power
  }

  // GoMining's listed price for this power, interpolated between the sizes it publishes so that every listed
  // size costs exactly what GoMining charges for it.
  function listedPrice (power: number) {
    const list = ladder()
    const first = list[0]
    const last = list[list.length - 1]
    if (power <= first.power) {
      return first.priceUsd * power / first.power
    }
    if (power >= last.power) {
      return last.priceUsd * power / last.power
    }
    const index = list.findIndex(preset => preset.power >= power)
    const lower = list[index - 1]
    const upper = list[index]
    return lower.priceUsd + (upper.priceUsd - lower.priceUsd) * (power - lower.power) / (upper.power - lower.power)
  }

  // GoMining's listed price for one more TH at this size, from the slope of its own ladder.
  function listedMarginal (power: number) {
    const list = ladder()
    const index = list.findIndex(preset => preset.power > power)
    if (index <= 0) {
      const last = list[list.length - 1]
      const previous = list[list.length - 2]
      return (last.priceUsd - previous.priceUsd) / (last.power - previous.power)
    }
    const lower = list[index - 1]
    const upper = list[index]
    return (upper.priceUsd - lower.priceUsd) / (upper.power - lower.power)
  }

  // GoMining's getUpgradeEEPrice: what one TH is worth at `efficiency` relative to the efficiency it sells.
  // Negative for a worse (higher W/TH) miner. Fractional levels are interpolated the way GoMining does.
  function energyBonus (efficiency: number) {
    const market = getMarket()
    if (efficiency === market.referenceEfficiency) {
      return 0
    }
    const steps = market.powerUpgradeSteps
    const reference = steps.filter(step => step.toLevel >= market.referenceEfficiency).reduce((total, step) => total + step.priceUsd, 0)
    const atEfficiency = steps.filter(step => step.toLevel >= Math.floor(efficiency)).reduce((total, step) => {
      if (step.toLevel < efficiency) {
        return total + step.priceUsd * (1 - (efficiency - step.toLevel))
      }
      return total + step.priceUsd
    }, 0)
    return atEfficiency - reference
  }

  // The two terms are rounded first so the breakdown shown to the reader always adds up to the price.
  function priceBreakdown (power: number, efficiency: number) {
    const listed = round(listedPrice(power))
    const adjustment = round(energyBonus(efficiency) * power)
    return { listedPrice: listed, efficiencyAdjustment: adjustment, price: round(listed + adjustment) }
  }

  function minerPrice (power: number, efficiency: number) {
    if (!(power > 0) || !Number.isInteger(efficiency) || efficiency < minEfficiency() || efficiency > maxEfficiency()) {
      return NaN
    }
    const price = priceBreakdown(power, efficiency).price
    return price > 0 ? price : NaN
  }

  function marginalPrice (power: number, efficiency: number) {
    return round(listedMarginal(power) + energyBonus(efficiency))
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
    const breakdown = priceBreakdown(power, efficiency)
    const potentialProfit = profit(satoshiReward * power, btcPrice, powerCost(efficiency, power, userDiscount), serviceCost(userDiscount, power))

    return {
      reward: satoshiReward * power,
      profit: potentialProfit,
      powerCostC1: powerCost(efficiency, power, userDiscount),
      serviceCostC2: serviceCost(userDiscount, power),
      price: breakdown.price,
      listedPrice: breakdown.listedPrice,
      efficiencyAdjustment: breakdown.efficiencyAdjustment,
      marginalPrice: marginalPrice(power, efficiency),
      rateOfInvestment: rateOfInvestment(investment ?? breakdown.price, potentialProfit),
      power,
      efficiency
    }
  }

  function nftProfitCalculator (efficiency: number, power: number, userDiscount: number, satoshiReward: number, btcPrice: number) {
    return estimate(efficiency, power, userDiscount, satoshiReward, btcPrice)
  }

  // Finds the miner with the highest daily profit for the budget. An efficiency of 0 compares 12 to 20 W/TH.
  // Equal profits prefer the cheaper miner.
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
      price: 0,
      listedPrice: 0,
      efficiencyAdjustment: 0,
      marginalPrice: 0,
      rateOfInvestment: 0,
      power: 0,
      efficiency: efficiencies[0]
    }
  }

  return { nftProfitCalculator, bestOption, minerPrice, marginalPrice, listedPrice, energyBonus, priceBreakdown, minEfficiency, maxEfficiency, maxPower }
}
