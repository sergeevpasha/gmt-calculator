<script setup lang="ts">
import { useInvest } from '~/composables/useInvest'
import type { MarketData } from '~/data/gomining'

const props = defineProps<{ btcPrice: number, reward: number, market: MarketData }>()
const { bestOption, baseEfficiencies, minerPrice } = useInvest(() => props.market)
const moneyToSpend = ref<number | string>(1000)
const userDiscount = ref<number | string>(10)
// 0 compares every efficiency GoMining sells and picks the most profitable miner.
const baseEfficiency = ref(0)
const efficiencyOptions = computed(() => [{ value: 0, label: 'Best value for the budget' }, ...baseEfficiencies()])
const cheapestTerahash = computed(() => Math.min(...baseEfficiencies().map(base => minerPrice(1, base))))
const result = ref<ReturnType<typeof bestOption> | null>(null)
const calculatedInvestment = ref(1000)
const error = ref('')
const isStale = ref(false)
const calculatedBtcPrice = ref(props.btcPrice)

function calculate () {
  const investment = Number(moneyToSpend.value)
  const discount = Number(userDiscount.value)
  if (!Number.isFinite(investment) || investment < 1 || investment > 1000000 || userDiscount.value === '' || !Number.isFinite(discount) || discount < 0 || discount > 100) {
    error.value = 'Enter an investment from $1 to $1,000,000 and a discount from 0 to 100%.'
    return
  }
  if (!Number.isFinite(props.btcPrice) || props.btcPrice <= 0 || props.btcPrice > 10000000 || !Number.isFinite(props.reward) || props.reward < 0 || props.reward > 1000000) {
    error.value = 'Check your Bitcoin price and daily mining reward above.'
    result.value = null
    return
  }
  error.value = ''
  calculatedBtcPrice.value = props.btcPrice
  calculatedInvestment.value = investment
  result.value = bestOption(investment, props.btcPrice, props.reward, discount, baseEfficiency.value)
  if (result.value.power === 0) {
    error.value = `This budget is below the price of 1 TH ($${cheapestTerahash.value.toFixed(2)}). Increase it to calculate returns.`
    result.value = null
  }
  isStale.value = false
}

watch([moneyToSpend, userDiscount, baseEfficiency], () => { isStale.value = true })
watch(() => props.market, () => {
  if (baseEfficiency.value && !baseEfficiencies().includes(baseEfficiency.value)) { baseEfficiency.value = 0 }
  calculate()
})
watch(() => [props.btcPrice, props.reward], calculate, { immediate: true })
</script>
<template>
  <div class="calculator-workspace">
    <form class="setup-panel" @submit.prevent="calculate">
      <div class="panel-heading">
        <AppIcon name="settings" /><h2>Set up your investment</h2>
      </div>
      <p class="panel-description">
        A few details. A clearer picture.
      </p>
      <div class="form-fields">
        <div class="investment-amount">
          <BaseInput
            id="investment-amount"
            v-model="moneyToSpend"
            label="Investment amount"
            min="1"
            max="1000000"
            step="any"
            unit="USDT"
          >
            <template #prefix>
              $
            </template>
          </BaseInput>
          <div class="amount-presets" aria-label="Investment presets">
            <button
              v-for="amount in [500, 1000, 5000, 10000]"
              :key="amount"
              type="button"
              :class="{ selected: moneyToSpend === amount }"
              :aria-pressed="moneyToSpend === amount"
              @click="moneyToSpend = amount"
            >
              ${{ amount.toLocaleString('en-US') }}
            </button>
          </div>
        </div>
        <BaseSelect id="investment-efficiency" v-model="baseEfficiency" label="Miner efficiency" :options="efficiencyOptions" unit="W / TH" />
        <BaseInput
          id="investment-discount"
          v-model="userDiscount"
          label="GoMining discount"
          min="0"
          max="100"
          step="any"
          unit="%"
        >
          <template #label-extra>
            <span class="discount-badge">On maintenance</span>
          </template>
        </BaseInput>
      </div>
      <p v-if="error" class="form-error" role="alert">
        {{ error }}
      </p>
      <BaseButton type="submit" label="Calculate returns" />
      <p class="setup-footnote" aria-live="polite">
        <AppIcon :name="error ? 'info' : isStale ? 'refresh' : 'check'" />{{ error ? 'Check your inputs to calculate.' : isStale ? 'Inputs changed. Calculate to update.' : 'Your estimate is up to date' }}
      </p>
      <div class="calculation-tip">
        <AppIcon name="bolt" /><p><strong>Make every terahash count.</strong>We compare GoMining's current miner prices and efficiency upgrades to find the best daily return for your budget.</p>
      </div>
    </form>
    <CalculatorResults :result="result" :investment="calculatedInvestment" :btc-price="calculatedBtcPrice" :stale="isStale" id-prefix="investment" />
  </div>
</template>
