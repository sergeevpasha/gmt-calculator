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
  // Price of the miner at its base efficiency, USD.
  powerCost: number
  // Price of upgrading the efficiency from the base level, USD.
  efficiencyCost: number
  // Annual return on the investment, %.
  rateOfInvestment: number
  power: number
  efficiency: number
  baseEfficiency: number
}

const presetCache = new WeakMap<MarketData, Map<number, MinerPreset[]>>()

export const useInvest = (getMarket: () => MarketData) => {
  const round = (value: number) => parseFloat(value.toFixed(2))

  // Efficiencies GoMining sells on the primary market, least efficient first.
  function baseEfficiencies () {
    return [...new Set(getMarket().miners.map(miner => miner.efficiency))].sort((a, b) => b - a)
  }

  function minEfficiency () {
    return Math.min(...baseEfficiencies(), ...Object.keys(getMarket().efficiencyUpgradePrices).map(Number))
  }

  function maxEfficiency () {
    return Math.max(...baseEfficiencies())
  }

  function maxPower () {
    return Math.max(...getMarket().miners.map(miner => miner.power))
  }

  function presets (baseEfficiency: number): MinerPreset[] {
    const market = getMarket()
    let byEfficiency = presetCache.get(market)
    if (!byEfficiency) {
      byEfficiency = new Map()
      presetCache.set(market, byEfficiency)
    }
    let list = byEfficiency.get(baseEfficiency)
    if (!list) {
      list = market.miners.filter(miner => miner.efficiency === baseEfficiency).sort((a, b) => a.power - b.power)
      byEfficiency.set(baseEfficiency, list)
    }
    return list
  }

  // Price of a new miner, interpolated between GoMining's presets so preset sizes cost exactly the store price.
  function minerPrice (power: number, baseEfficiency: number) {
    const list = presets(baseEfficiency)
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

  function estimate (efficiency: number, power: number, userDiscount: number, satoshiReward: number, btcPrice: number, baseEfficiency: number, investment?: number): MiningEstimate {
    const potentialPowerCost = minerPrice(power, baseEfficiency)
    const potentialEfficiencyCost = round(efficiencyUpgrade(baseEfficiency, efficiency) * power)
    const potentialProfit = profit(satoshiReward * power, btcPrice, powerCost(efficiency, power, userDiscount), serviceCost(userDiscount, power))

    return {
      reward: satoshiReward * power,
      profit: potentialProfit,
      powerCostC1: powerCost(efficiency, power, userDiscount),
      serviceCostC2: serviceCost(userDiscount, power),
      powerCost: potentialPowerCost,
      efficiencyCost: potentialEfficiencyCost,
      rateOfInvestment: rateOfInvestment(investment ?? potentialPowerCost + potentialEfficiencyCost, potentialProfit),
      power,
      efficiency,
      baseEfficiency
    }
  }

  function nftProfitCalculator (efficiency: number, power: number, userDiscount: number, satoshiReward: number, btcPrice: number, baseEfficiency: number = maxEfficiency()) {
    return estimate(efficiency, power, userDiscount, satoshiReward, btcPrice, baseEfficiency)
  }

  // Finds the miner with the highest daily profit for the budget. A base efficiency of 0 compares every efficiency
  // GoMining sells, including buying a cheaper base level and upgrading it. Equal profits prefer the cheaper setup.
  function bestOption (moneyToSpend: number, btcPrice: number, satoshiReward: number, userDiscount: number, baseEfficiency: number = 0): MiningEstimate {
    const bases = baseEfficiency ? [baseEfficiency] : baseEfficiencies()
    const lowestEfficiency = minEfficiency()
    const powerLimit = maxPower()
    let best: MiningEstimate | null = null

    for (const base of bases) {
      for (let efficiency = base; efficiency >= lowestEfficiency; efficiency--) {
        const upgradePerTerahash = efficiencyUpgrade(base, efficiency)
        if (minerPrice(1, base) + upgradePerTerahash > moneyToSpend) {
          break
        }

        for (let power = 1; power <= powerLimit; power++) {
          const cost = minerPrice(power, base) + round(upgradePerTerahash * power)
          if (cost > moneyToSpend) {
            break
          }

          const candidate = estimate(efficiency, power, userDiscount, satoshiReward, btcPrice, base, moneyToSpend)
          if (!best || candidate.profit > best.profit || (candidate.profit === best.profit && cost < best.powerCost + best.efficiencyCost)) {
            best = candidate
          }
        }
      }
    }

    return best ?? {
      reward: 0,
      profit: 0,
      powerCostC1: 0,
      serviceCostC2: 0,
      powerCost: 0,
      efficiencyCost: 0,
      rateOfInvestment: 0,
      power: 0,
      efficiency: bases[0],
      baseEfficiency: bases[0]
    }
  }

  return { nftProfitCalculator, bestOption, minerPrice, efficiencyUpgrade, baseEfficiencies, minEfficiency, maxEfficiency, maxPower }
}
