import { EFFICIENCY_RANGE } from '~/data/gomining'
import type { MarketData } from '~/data/gomining'

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
  // The three terms of GoMining's valuation, for display.
  basePrice: number
  energyBonus: number
  powerBonus: number
  // Price of adding one more TH at this size and efficiency, USD.
  marginalPrice: number
  // Annual return on the investment, %.
  rateOfInvestment: number
  power: number
  efficiency: number
}

interface Band { power: number, level: number }

const bandCache = new WeakMap<MarketData, Band[]>()

export const useInvest = (getMarket: () => MarketData) => {
  const round = (value: number) => parseFloat(value.toFixed(2))

  function minEfficiency () {
    return EFFICIENCY_RANGE.min
  }

  function maxEfficiency () {
    return EFFICIENCY_RANGE.max
  }

  function maxPower () {
    return Math.max(...getMarket().powersByLevel)
  }

  // GoMining drops the first and last entry of powersByLevel and numbers the rest from 1.
  function bands () {
    const market = getMarket()
    let list = bandCache.get(market)
    if (!list) {
      list = market.powersByLevel.slice(1, market.powersByLevel.length - 1).map((power, index) => ({ power, level: index + 1 }))
      bandCache.set(market, list)
    }
    return list
  }

  function bandFor (power: number): Band {
    const list = bands()
    return list.find((band, index) => {
      const next = list[index + 1]
      return band.power <= power && (!next || next.power > power)
    }) ?? list[0]
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

  // GoMining's getPowerUpgradePrice: every TH above the base one, charged at its band's decayed price.
  function powerBonus (power: number, bonus: number) {
    const market = getMarket()
    const list = bands()
    const current = bandFor(power)
    return list.filter(band => band.level <= current.level).reduce((total, band, index) => {
      const next = list[index + 1]
      const terahashes = !next || next.power > power ? power - band.power : next.power - band.power
      if (terahashes <= 0) {
        return total
      }
      return total + terahashes * market.basePriceUsd * Math.pow(market.bandDecay, band.level - 1) + terahashes * bonus
    }, 0)
  }

  // The three terms are rounded first so the breakdown shown to the reader always adds up to the price.
  function priceBreakdown (power: number, efficiency: number) {
    const market = getMarket()
    const bonus = energyBonus(efficiency)
    const energy = round(bonus)
    const power_ = round(powerBonus(power, bonus))
    return {
      basePrice: market.basePriceUsd,
      energyBonus: energy,
      powerBonus: power_,
      price: round(market.basePriceUsd + energy + power_)
    }
  }

  function minerPrice (power: number, efficiency: number) {
    if (!(power > 0) || !Number.isInteger(efficiency) || efficiency < minEfficiency() || efficiency > maxEfficiency()) {
      return NaN
    }
    const price = priceBreakdown(power, efficiency).price
    return price > 0 ? price : NaN
  }

  // What GoMining charges for the next TH at this size and efficiency.
  function marginalPrice (power: number, efficiency: number) {
    const market = getMarket()
    return round(market.basePriceUsd * Math.pow(market.bandDecay, bandFor(power).level - 1) + energyBonus(efficiency))
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
      basePrice: breakdown.basePrice,
      energyBonus: breakdown.energyBonus,
      powerBonus: breakdown.powerBonus,
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
      basePrice: 0,
      energyBonus: 0,
      powerBonus: 0,
      marginalPrice: 0,
      rateOfInvestment: 0,
      power: 0,
      efficiency: efficiencies[0]
    }
  }

  return { nftProfitCalculator, bestOption, minerPrice, marginalPrice, energyBonus, priceBreakdown, minEfficiency, maxEfficiency, maxPower }
}
