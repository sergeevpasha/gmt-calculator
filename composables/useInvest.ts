import { EFFICIENCY_RANGE } from '~/data/gomining'
import type { EfficiencyLadder, MarketData, MinerPreset } from '~/data/gomining'

export interface UpgradeOption {
  // Target W/TH level.
  efficiency: number
  // What GoMining charges for the upgrade, USD.
  cost: number
  // Electricity saved per day at the current discount, USD.
  savingPerDay: number
  // Days for the saving to repay the upgrade, or null when it never does.
  paybackDays: number | null
}

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
  // Annual return on the investment, %.
  rateOfInvestment: number
  power: number
  efficiency: number
}

export const useInvest = (getMarket: () => MarketData) => {
  const round = (value: number) => parseFloat(value.toFixed(2))

  function minEfficiency () {
    return EFFICIENCY_RANGE.min
  }

  function maxEfficiency () {
    return EFFICIENCY_RANGE.max
  }

  function ladders () {
    return getMarket().ladders
  }

  // Efficiencies GoMining publishes a full price ladder for.
  function publishedEfficiencies () {
    return ladders().map(ladder => ladder.efficiency)
  }

  function maxPower () {
    return Math.max(...ladders().map(ladder => ladder.presets[ladder.presets.length - 1].power))
  }

  // Price of `power` TH on one published ladder, interpolated between the sizes GoMining lists so that every
  // listed size costs exactly what GoMining charges for it.
  function priceOnLadder (ladder: EfficiencyLadder, power: number) {
    const presets: MinerPreset[] = ladder.presets
    const first = presets[0]
    const last = presets[presets.length - 1]
    if (power <= first.power) {
      return first.priceUsd * power / first.power
    }
    if (power >= last.power) {
      return last.priceUsd * power / last.power
    }
    const index = presets.findIndex(preset => preset.power >= power)
    const lower = presets[index - 1]
    const upper = presets[index]
    return lower.priceUsd + (upper.priceUsd - lower.priceUsd) * (power - lower.power) / (upper.power - lower.power)
  }

  // Sum of the per-TH valuation steps between two W/TH levels, from GoMining's powerUpgradePriceConfig.
  function stepSum (fromEfficiency: number, toEfficiency: number) {
    const steps = getMarket().powerUpgradeSteps
    let total = 0
    for (let level = fromEfficiency; level < toEfficiency; level++) {
      total += steps.find(step => step.toLevel === level)?.priceUsd ?? 0
    }
    return total
  }

  // GoMining publishes ladders for a couple of efficiencies only. A level it publishes is priced from that
  // ladder exactly. A level between two published ones is interpolated between them at the same power. A level
  // worse than every published one steps down from the least efficient ladder using GoMining's valuation steps.
  function priceAt (power: number, efficiency: number) {
    const list = ladders()
    const exact = list.find(ladder => ladder.efficiency === efficiency)
    if (exact) {
      return priceOnLadder(exact, power)
    }
    const lower = [...list].reverse().find(ladder => ladder.efficiency < efficiency)
    const upper = list.find(ladder => ladder.efficiency > efficiency)
    if (lower && upper) {
      const a = priceOnLadder(lower, power)
      const b = priceOnLadder(upper, power)
      return a + (b - a) * (efficiency - lower.efficiency) / (upper.efficiency - lower.efficiency)
    }
    if (lower) {
      return priceOnLadder(lower, power) - stepSum(lower.efficiency, efficiency) * power
    }
    return priceOnLadder(list[0], power) + stepSum(efficiency, list[0].efficiency) * power
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

  function minerPrice (power: number, efficiency: number) {
    return round(priceAt(power, efficiency))
  }

  // GoMining's published cost to improve a miner's efficiency, summed over the W/TH steps crossed.
  function efficiencyUpgradeCost (fromEfficiency: number, toEfficiency: number, power: number) {
    const perTerahash = getMarket().efficiencyUpgradeSteps
      .filter(step => step.toLevel >= toEfficiency && step.toLevel < fromEfficiency)
      .reduce((total, step) => total + step.priceUsd, 0)
    return round(perTerahash * power)
  }

  // Every efficiency upgrade open to this miner, what GoMining charges, and what it saves each day.
  function upgradeOptions (efficiency: number, power: number, userDiscount: number) {
    const options: UpgradeOption[] = []
    for (let target = efficiency - 1; target >= minEfficiency(); target--) {
      const cost = efficiencyUpgradeCost(efficiency, target, power)
      const savingPerDay = round(powerCost(efficiency, power, userDiscount) - powerCost(target, power, userDiscount))
      options.push({
        efficiency: target,
        cost,
        savingPerDay,
        paybackDays: savingPerDay > 0 && cost > 0 ? Math.ceil(cost / savingPerDay) : null
      })
    }
    return options
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
    return round(365 / (moneyToSpend / potentialProfit) * 100)
  }

  function estimate (efficiency: number, power: number, userDiscount: number, satoshiReward: number, btcPrice: number, investment?: number): MiningEstimate {
    const price = minerPrice(power, efficiency)
    const potentialProfit = profit(satoshiReward * power, btcPrice, powerCost(efficiency, power, userDiscount), serviceCost(userDiscount, power))

    return {
      reward: satoshiReward * power,
      profit: potentialProfit,
      powerCostC1: powerCost(efficiency, power, userDiscount),
      serviceCostC2: serviceCost(userDiscount, power),
      price,
      rateOfInvestment: rateOfInvestment(investment ?? price, potentialProfit),
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
        if (cost > moneyToSpend) {
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
      rateOfInvestment: 0,
      power: 0,
      efficiency: efficiencies[0]
    }
  }

  return { nftProfitCalculator, bestOption, minerPrice, priceAt, energyBonus, efficiencyUpgradeCost, upgradeOptions, publishedEfficiencies, minEfficiency, maxEfficiency, maxPower }
}
