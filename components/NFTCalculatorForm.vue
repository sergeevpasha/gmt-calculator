<script setup lang="ts">
import { useInvest } from '~/composables/useInvest'
import type { MarketData } from '~/data/gomining'

const props = defineProps<{ btcPrice: number, reward: number, market: MarketData }>()
const { nftProfitCalculator, upgradeOptions, minEfficiency, maxEfficiency, maxPower } = useInvest(() => props.market)
const lowestEfficiency = computed(() => minEfficiency())
const highestEfficiency = computed(() => maxEfficiency())
const powerLimit = computed(() => maxPower())
const soldEfficiency = computed(() => props.market.referenceEfficiency)
const selectedNftEfficiency = ref<number | string>(15)
const selectedNftPower = ref<number | string>(1)
const nftUserDiscount = ref<number | string>(10)
const result = ref<ReturnType<typeof nftProfitCalculator> | null>(null)
const upgrades = ref<ReturnType<typeof upgradeOptions>>([])
const investment = computed(() => result.value ? result.value.price : 0)
const error = ref('')
const isStale = ref(false)
const calculatedBtcPrice = ref(props.btcPrice)

function calculate () {
  const efficiency = Number(selectedNftEfficiency.value)
  const power = Number(selectedNftPower.value)
  const discount = Number(nftUserDiscount.value)
  if (![efficiency, power, discount].every(Number.isFinite) || !Number.isInteger(efficiency) || efficiency < lowestEfficiency.value || efficiency > highestEfficiency.value || !Number.isInteger(power) || power < 1 || power > powerLimit.value || nftUserDiscount.value === '' || discount < 0 || discount > 100) {
    error.value = `Use a whole-number efficiency from ${lowestEfficiency.value} to ${highestEfficiency.value} W / TH, power from 1 to ${powerLimit.value.toLocaleString('en-US')} TH, and a discount from 0 to 100%.`
    return
  }
  if (!Number.isFinite(props.btcPrice) || props.btcPrice <= 0 || props.btcPrice > 10000000 || !Number.isFinite(props.reward) || props.reward < 0 || props.reward > 1000000) {
    error.value = 'Check your Bitcoin price and daily mining reward above.'
    result.value = null
    return
  }
  const estimate = nftProfitCalculator(efficiency, power, discount, props.reward, props.btcPrice)
  if (!Number.isFinite(estimate.price)) {
    error.value = 'GoMining pricing is unavailable for this efficiency right now.'
    result.value = null
    return
  }
  error.value = ''
  calculatedBtcPrice.value = props.btcPrice
  result.value = estimate
  upgrades.value = upgradeOptions(efficiency, power, discount)
  isStale.value = false
}

watch([selectedNftEfficiency, selectedNftPower, nftUserDiscount], () => { isStale.value = true })
watch(() => [props.btcPrice, props.reward, props.market], calculate, { immediate: true })
</script>
<template>
  <div class="calculator-workspace">
    <form class="setup-panel" @submit.prevent="calculate">
      <div class="panel-heading">
        <AppIcon name="chip" /><h2>Meet your miner's potential</h2>
      </div>
      <p class="panel-description">
        Turn your NFT specs into an outlook.
      </p>
      <div class="form-fields nft-fields">
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
      <p v-if="error" class="form-error" role="alert">
        {{ error }}
      </p>
      <BaseButton type="submit" label="Calculate returns" />
      <p class="setup-footnote" aria-live="polite">
        <AppIcon :name="error ? 'info' : isStale ? 'refresh' : 'check'" />{{ error ? 'Check your inputs to calculate.' : isStale ? 'Inputs changed. Calculate to update.' : 'Your estimate is up to date' }}
      </p>
      <div class="calculation-tip">
        <AppIcon name="bolt" /><p><strong>Lower watts. Greater efficiency.</strong>A lower W / TH rating means your miner uses less electricity for the same mining power. GoMining sells {{ soldEfficiency }} W / TH miners. Every level is priced with GoMining's own valuation formula, so a worse W / TH costs less up front but more to run.</p>
      </div>
    </form>
    <CalculatorResults
      :result="result"
      :investment="investment"
      :btc-price="calculatedBtcPrice"
      :stale="isStale"
      :reference-efficiency="soldEfficiency"
      :upgrades="upgrades"
      id-prefix="nft"
      nft
    />
  </div>
</template>
