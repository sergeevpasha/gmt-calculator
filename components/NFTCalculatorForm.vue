<script setup lang="ts">
import { useInvest } from '~/composables/useInvest'
import type { MiningEstimate, UpgradeOption } from '~/composables/useInvest'
import type { MarketData } from '~/data/gomining'

// `reward` is null while its field is empty, which is not the same as a reward of zero.
const props = defineProps<{ btcPrice: number, reward: number | null, market: MarketData }>()
const { nftProfitCalculator, upgradeOptions, minEfficiency, maxEfficiency, maxPower } = useInvest(() => props.market)
const lowestEfficiency = computed(() => minEfficiency())
const highestEfficiency = computed(() => maxEfficiency())
const powerLimit = computed(() => maxPower())
const soldEfficiency = computed(() => props.market.referenceEfficiency)
const selectedNftEfficiency = ref<number | ''>(15)
const selectedNftPower = ref<number | ''>(1)
const nftUserDiscount = ref<number | ''>(10)
const result = ref<MiningEstimate | null>(null)
const upgrades = ref<UpgradeOption[]>([])
const investment = computed(() => result.value ? result.value.price : 0)
const error = ref('')
const calculatedBtcPrice = ref(props.btcPrice)

// Inputs that cannot be estimated, such as a field halfway through being retyped, keep the last estimate on screen
// and say what to fix.
function calculate () {
  const efficiency = selectedNftEfficiency.value
  const power = selectedNftPower.value
  const discount = nftUserDiscount.value
  if (efficiency === '' || !Number.isInteger(efficiency) || efficiency < lowestEfficiency.value || efficiency > highestEfficiency.value || power === '' || !Number.isInteger(power) || power < 1 || power > powerLimit.value || discount === '' || discount < 0 || discount > 100) {
    error.value = `Use a whole-number efficiency from ${lowestEfficiency.value} to ${highestEfficiency.value} W / TH, power from 1 to ${powerLimit.value.toLocaleString('en-US')} TH, and a discount from 0 to 100%.`
    return
  }
  if (props.btcPrice <= 0 || props.btcPrice > 10000000 || props.reward === null || props.reward < 0 || props.reward > 1000000) {
    error.value = 'Check your Bitcoin price and daily mining reward above.'
    return
  }
  error.value = ''
  calculatedBtcPrice.value = props.btcPrice
  result.value = nftProfitCalculator(efficiency, power, discount, props.reward, props.btcPrice)
  upgrades.value = upgradeOptions(efficiency, power, discount)
}

// Recalculates whenever anything it reads changes: the fields above, the market assumptions or GoMining's data.
watchEffect(calculate)
</script>
<template>
  <div class="grid grid-cols-[355px_minmax(0,1fr)] gap-6 [align-items:start] to-1100:grid-cols-[310px_minmax(0,1fr)] to-1100:gap-[18px] to-800:grid-cols-[1fr]">
    <form class="rounded-2xl border border-border bg-panel p-[26px] to-1100:p-[22px] to-480:p-5">
      <div class="mb-[7px] flex items-center gap-2.5">
        <AppIcon name="chip" class="h-[19px] w-[19px] text-purple" /><h2 class="text-[17px] font-[550] tracking-[-.3px]">
          Check a miner you own
        </h2>
      </div>
      <p class="text-[16px] leading-[1.6] text-muted">
        Enter its efficiency, power and discount to see what it earns and what upgrades cost.
      </p>
      <div class="mb-6 mt-[26px] flex flex-col gap-[23px] to-800:grid to-800:grid-cols-[1fr_1fr] to-800:gap-5 to-480:grid-cols-[1fr] to-480:gap-x-[13px] to-480:gap-y-[19px]">
        <BaseInput
          id="nft-efficiency"
          v-model="selectedNftEfficiency"
          label="Energy efficiency"
          :min="lowestEfficiency"
          :max="highestEfficiency"
          step="1"
          unit="W / TH"
          :hint="`Any whole number from ${lowestEfficiency} to ${highestEfficiency}`"
        />
        <BaseInput
          id="nft-power"
          v-model="selectedNftPower"
          label="Mining power"
          min="1"
          :max="powerLimit"
          step="1"
          unit="TH"
        />
        <BaseInput
          id="nft-discount"
          v-model="nftUserDiscount"
          label="GoMining discount"
          min="0"
          max="100"
          step="any"
          unit="%"
        />
      </div>
      <p v-if="error" class="mb-[15px] text-[14px] leading-[1.5] text-[#ffb0b6]" role="alert">
        {{ error }}
      </p>
      <div class="mt-[23px] flex gap-[11px] border-t border-border pt-[19px] to-800:mt-[18px] to-800:pt-4">
        <AppIcon name="bolt" class="mt-0.5 h-[17px] w-[17px] shrink-0 text-purple" /><p class="text-[12px] leading-[1.7] text-muted">
          <strong class="mb-[3px] block font-medium text-[#d0cddd]">What W / TH means</strong>A lower W / TH rating means your miner uses less electricity for the same mining power. GoMining sells {{ soldEfficiency }} W / TH miners. Every level is priced with GoMining's own valuation formula, so a worse W / TH costs less up front but more to run.
        </p>
      </div>
    </form>
    <CalculatorResults
      :result="result"
      :investment="investment"
      :btc-price="calculatedBtcPrice"
      :stale="error !== ''"
      :upgrades="upgrades"
      id-prefix="nft"
      nft
    />
  </div>
</template>
