<script setup lang="ts">
import { defineComponent } from 'vue'
import { useInvest } from '~/composables/useInvest'
import ResultColumn from '~/components/ResultColumn.vue'
import BaseInput from '~/components/forms/BaseInput.vue'

defineComponent({
  name: 'NFTCalculatorForm'
})

const props = defineProps({
  btcPrice: {
    type: Number,
    default: 0
  },
  reward: {
    type: Number,
    default: 0
  }
})

const { nftProfitCalculator } = useInvest()

const baseEfficiency = ref(35)
const selectedNftEfficiency = ref(35)
const selectedNftPower = ref(1)
const nftEfficiency = ref(50)
const nftPower = ref(0)
const nftUserDiscount = ref(10)

const potentialReward = ref(0)
const potentialProfit = ref(0)
const powerC1Cost = ref(0)
const serviceC2Cost = ref(0)
const efficiencyCostUpgrade = ref(0)
const powerCostUpgrade = ref(0)
const potentialRateOfInvestment = ref(0)

function calculateNft () {
  const {
    powerCostC1,
    serviceCostC2,
    reward,
    profit,
    efficiencyCost,
    powerCost,
    rateOfInvestment
  } = nftProfitCalculator(selectedNftEfficiency.value, selectedNftPower.value, nftUserDiscount.value, props.reward, props.btcPrice, baseEfficiency.value)
  powerC1Cost.value = powerCostC1
  serviceC2Cost.value = serviceCostC2
  efficiencyCostUpgrade.value = efficiencyCost
  powerCostUpgrade.value = powerCost
  potentialReward.value = convertSatoshiToUsd(reward)
  potentialProfit.value = profit
  nftEfficiency.value = selectedNftEfficiency.value
  nftPower.value = selectedNftPower.value
  potentialRateOfInvestment.value = rateOfInvestment
}

function convertSatoshiToUsd (satoshi: number) {
  return parseFloat((satoshi / 100000000 * props.btcPrice).toFixed(2))
}
</script>
<template>
  <div class="w-full p-4 text-center bg-gray-100 rounded-lg shadow sm:p-8 dark:bg-gray-800 dark:border-gray-700">
    <h5 class="mb-2 text-3xl font-bold text-gray-900 dark:text-white">
      NFT calculator
    </h5>
    <p class="mb-5 text-base text-gray-500 sm:text-lg dark:text-gray-300">
      Calculate your NFT profitability by specifying your NFT efficiency and power levels.
    </p>
    <div class="grid lg:grid-cols-5 gap-3 items-stretch mt-10 m-auto">
      <BaseSelect v-model="baseEfficiency" label="Base NFT Efficiency Level" :options="[35, 28, 25]" />
      <BaseInput
        v-model="selectedNftEfficiency"
        type="number"
        placeholder="0.00"
        label="NFT Efficiency Level"
      >
        <template #symbol>
          <div class="absolute inset-y-0 end-0 top-0 flex items-center pe-3.5 pointer-events-none text-gray-500">
            <EfficiencyIcon class="w-5 h-5" />
          </div>
        </template>
      </BaseInput>
      <BaseInput v-model="selectedNftPower" type="number" placeholder="0.00" label="NFT Power Level">
        <template #symbol>
          <div class="absolute inset-y-0 end-0 top-0 flex items-center pe-3.5 pointer-events-none text-gray-500">
            <PowerIcon class="w-5 h-5" />
          </div>
        </template>
      </BaseInput>
      <BaseInput v-model="nftUserDiscount" type="number" placeholder="0.00" label="GoMining Discount">
        <template #symbol>
          <div class="absolute inset-y-0 end-0 top-0 flex items-center pe-3.5 pointer-events-none text-gray-500">
            <span class="dark:text-gray-900">%</span>
          </div>
        </template>
      </BaseInput>
      <div class="flex flex-col justify-end align-bottom">
        <BaseButton label="Calculate" @click="calculateNft" />
      </div>
    </div>
    <div class="grid lg:grid-cols-5 gap-3 items-stretch mt-10 m-auto">
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
      <ResultColumn v-model="nftEfficiency" label="Efficiency Level">
        <template #symbol>
          <div class="text-gray-500 mr-2">
            <EfficiencyIcon class="w-5 h-5" />
          </div>
        </template>
        <template #converted>
          <span class="ml-2 text-sm text-gray-500 dark:text-gray-300 mr-2">
            (${{ efficiencyCostUpgrade }})
          </span>
        </template>
      </ResultColumn>
      <ResultColumn v-model="nftPower" label="Power Level">
        <template #symbol>
          <div class="text-gray-500 mr-2">
            <PowerIcon class="w-5 h-5" />
          </div>
        </template>
        <template #converted>
          <span class="ml-2 text-sm text-gray-500 dark:text-gray-300 mr-2">
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
          <div class="font-bold ml-1 dark:text-gray-300">
            %
          </div>
        </template>
      </ResultColumn>
    </div>
  </div>
</template>
