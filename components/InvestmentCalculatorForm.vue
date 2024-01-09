<script setup lang="ts">
import { defineComponent } from 'vue'
import { useInvest } from '~/composables/useInvest'
import ResultColumn from '~/components/ResultColumn.vue'
import BaseInput from '~/components/forms/BaseInput.vue'

defineComponent({
  name: 'InvestmentCalculatorForm'
})

const { bestOption } = useInvest()

const moneyToSpend = ref(1000)
const btcPrice = ref(44000)
const todayReward = ref(195)
const userDiscount = ref(10)

const baseEfficiency = ref(50)
const efficiencyToUpgrade = ref(0)
const powerToUpgrade = ref(0)
const potentialReward = ref(0)
const potentialProfit = ref(0)
const powerC1Cost = ref(0)
const serviceC2Cost = ref(0)
const efficiencyCostUpgrade = ref(0)
const powerCostUpgrade = ref(0)
const potentialRateOfInvestment = ref(0)

function calculate () {
  const { powerCostC1, serviceCostC2, power, powerCost, efficiency, efficiencyCost, reward, profit, rateOfInvestment } = bestOption(moneyToSpend.value, btcPrice.value, todayReward.value, userDiscount.value, baseEfficiency.value)
  powerCostUpgrade.value = powerCost
  efficiencyCostUpgrade.value = efficiencyCost
  powerC1Cost.value = powerCostC1
  serviceC2Cost.value = serviceCostC2
  efficiencyToUpgrade.value = efficiency
  powerToUpgrade.value = power
  potentialReward.value = convertSatoshiToUsd(reward)
  potentialProfit.value = profit
  potentialRateOfInvestment.value = rateOfInvestment
}

function convertSatoshiToUsd (satoshi: number) {
  return parseFloat((satoshi / 100000000 * btcPrice.value).toFixed(2))
}
</script>
<template>
  <div class="w-full p-4 text-center bg-gray-100 rounded-lg shadow sm:p-8 dark:bg-gray-800 dark:border-gray-700">
    <h5 class="mb-2 text-3xl font-bold text-gray-900 dark:text-white">
      Invest calculator
    </h5>
    <p class="mb-5 text-base text-gray-500 sm:text-lg dark:text-gray-400">
      Calculate your potential profit and ROI by specifying your investment amount and NFT efficiency level.
    </p>
    <div class="grid md:grid-cols-4 gap-3 items-stretch mt-10 m-auto">
      <BaseInput v-model="baseEfficiency" type="number" placeholder="0.00" label="Base NFT Efficiency Level" />
      <BaseInput v-model="moneyToSpend" type="number" placeholder="0.00" label="Investment">
        <template #symbol>
          <div class="absolute inset-y-0 end-0 top-0 flex items-center pe-3.5 pointer-events-none text-gray-500">
            <span class="mr-2">USDT</span>
            <TetherIcon class="w-5" />
          </div>
        </template>
      </BaseInput>
      <BaseInput v-model="userDiscount" type="number" placeholder="0.00" label="GoMining Discount">
        <template #symbol>
          <div class="absolute inset-y-0 end-0 top-0 flex items-center pe-3.5 pointer-events-none text-gray-500">
            <span>%</span>
          </div>
        </template>
      </BaseInput>
      <div class="flex flex-col justify-end align-bottom">
        <BaseButton label="Calculate" @click="calculate" />
      </div>
    </div>
    <div class="grid md:grid-cols-4 gap-3 items-stretch mt-10 m-auto">
      <ResultColumn v-model="powerC1Cost" label="C1">
        <template #symbol>
          <div class="text-gray-500 mr-2">
            <TetherIcon class="w-5 h-5" />
          </div>
        </template>
      </ResultColumn>
      <ResultColumn v-model="serviceC2Cost" label="C2">
        <template #symbol>
          <div class="text-gray-500 mr-2">
            <TetherIcon class="w-5 h-5" />
          </div>
        </template>
      </ResultColumn>
      <ResultColumn v-model="efficiencyToUpgrade" label="Efficiency Level">
        <template #symbol>
          <div class="text-gray-500 mr-2">
            <EfficiencyIcon class="w-5 h-5" />
          </div>
        </template>
        <template #converted>
          <span class="ml-2 text-sm text-gray-500 mr-2">
            (${{ efficiencyCostUpgrade }})
          </span>
        </template>
      </ResultColumn>
      <ResultColumn v-model="powerToUpgrade" label="Power Level">
        <template #symbol>
          <div class="text-gray-500 mr-2">
            <PowerIcon class="w-5 h-5" />
          </div>
        </template>
        <template #converted>
          <span class="ml-2 text-sm text-gray-500 mr-2">
            (${{ powerCostUpgrade }})
          </span>
        </template>
      </ResultColumn>
      <ResultColumn v-model="potentialReward" label="Reward">
        <template #symbol>
          <div class="text-gray-500 mr-2">
            <TetherIcon class="w-5 h-5" />
          </div>
        </template>
      </ResultColumn>
      <ResultColumn v-model="potentialProfit" label="Profit">
        <template #symbol>
          <div class="text-gray-500 mr-2">
            <TetherIcon class="w-5 h-5" />
          </div>
        </template>
      </ResultColumn>
      <ResultColumn v-model="potentialRateOfInvestment" label="ROI">
        <template #converted>
          <div class="font-bold ml-1">
            %
          </div>
        </template>
      </resultcolumn>
    </div>
  </div>
</template>
