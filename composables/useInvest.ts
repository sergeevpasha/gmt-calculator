import { efficiencyUpgrades } from '~/data/efficiencyUpgrades'
import { powerUpgrades } from '~/data/powerUpgrades'

export const useInvest = () => {
  const kwhPrice = ref(0.05)
  const baseServiceCost = ref(0.0089)

  function nftProfitCalculator (efficiency: number, power: number, userDiscount: number, satoshiReward: number, btcPrice: number, baseEfficiency: number = 50) {
    const potentialProfit = profit(satoshiReward * power, btcPrice, powerCost(efficiency, power, userDiscount), serviceCost(userDiscount, power))
    const potentialPowerCost = powerUpgrade(power, baseEfficiency)
    const potentialEfficiencyCost = parseFloat((efficiencyUpgrade(efficiency, baseEfficiency) * power).toFixed(2))

    return {
      reward: satoshiReward * power,
      profit: potentialProfit,
      powerCostC1: powerCost(efficiency, power, userDiscount),
      serviceCostC2: serviceCost(userDiscount, power),
      efficiencyCost: potentialEfficiencyCost,
      powerCost: potentialPowerCost,
      rateOfInvestment: rateOfInvestment(potentialPowerCost + potentialEfficiencyCost, potentialProfit)
    }
  }
  function bestOption (moneyToSpend: number, btcPrice: number, satoshiReward: number, userDiscount: number, baseEfficiency: number = 50) {
    let bestProfit = 0
    let lastEfficiency = baseEfficiency
    let lastPower = 1

    for (let i = baseEfficiency; i > 19; i--) {
      if (efficiencyUpgrade(i, baseEfficiency) > moneyToSpend) {
        break
      }

      for (let j = 1; j <= 5000; j++) {
        if (efficiencyUpgrade(i, baseEfficiency) * j + powerUpgrade(j, baseEfficiency) > moneyToSpend) {
          break
        }

        const currentProfit = profit(satoshiReward * j, btcPrice, powerCost(i, j, userDiscount), serviceCost(userDiscount, j))
        if (currentProfit > bestProfit) {
          bestProfit = currentProfit
          lastEfficiency = i
          lastPower = j
        }
      }
    }

    return {
      reward: satoshiReward * lastPower,
      profit: bestProfit,
      efficiency: lastEfficiency,
      efficiencyCost: parseFloat((efficiencyUpgrade(lastEfficiency, baseEfficiency) * lastPower).toFixed(2)),
      power: lastPower,
      powerCost: powerUpgrade(lastPower, baseEfficiency),
      powerCostC1: powerCost(lastEfficiency, lastPower, userDiscount),
      serviceCostC2: serviceCost(userDiscount, lastPower),
      rateOfInvestment: rateOfInvestment(moneyToSpend, bestProfit)
    }
  }

  function efficiencyUpgrade (efficiency: number, baseEfficiency: number = 50) {
    let efficiencyCost = 0
    for (let i = baseEfficiency - 1; i >= efficiency; i--) {
      efficiencyCost += efficiencyUpgrades[i]
    }

    return parseFloat(efficiencyCost.toFixed(2))
  }

  function powerUpgrade (power: number, baseEfficiency: number = 50) {
    let powerCost = 0
    let lastPrice = 0
    for (let i = 0; i < power; i++) {
      if (powerUpgrades[i]) {
        lastPrice = powerUpgrades[i] + efficiencyUpgrade(baseEfficiency)
      }

      powerCost += lastPrice
    }

    return parseFloat(powerCost.toFixed(2))
  }

  function powerCost (energyEfficiency: number, power: number, userDiscount: number) {
    const mainExpressionResult = kwhPrice.value * 24 * energyEfficiency / 1000
    return parseFloat(((mainExpressionResult - (mainExpressionResult / 100 * userDiscount)) * power).toFixed(2))
  }

  function serviceCost (userDiscount: number, power: number) {
    return parseFloat(((baseServiceCost.value - (baseServiceCost.value / 100 * userDiscount)) * power).toFixed(2))
  }

  function profit (satoshiReward: number, btcPrice: number, powerCost: number, serviceCost: number) {
    const usdReward = parseFloat((satoshiReward / 100000000 * btcPrice).toFixed(2))
    return parseFloat((usdReward - powerCost - serviceCost).toFixed(2))
  }

  function rateOfInvestment (moneyToSpend: number, potentialProfit: number) {
    if (moneyToSpend === 0) {
      return 0
    }

    return parseFloat((365 / (moneyToSpend / potentialProfit) * 100).toFixed(2))
  }

  return { nftProfitCalculator, bestOption }
}
