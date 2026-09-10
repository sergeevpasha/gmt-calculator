<script setup lang="ts">
import { useInvest } from '~/composables/useInvest'
import type { MiningEstimate } from '~/composables/useInvest'
import type { MarketData } from '~/data/gomining'

// `reward` is null while its field is empty, which is not the same as a reward of zero.
const props = defineProps<{ btcPrice: number, reward: number | null, market: MarketData }>()
const { bestOption, minerPrice, minEfficiency, maxEfficiency } = useInvest(() => props.market)
const moneyToSpend = ref<number | ''>(1000)
const userDiscount = ref<number | ''>(10)
// 0 compares every efficiency level and picks the most profitable miner.
const efficiency = ref(0)
const efficiencyLevels = computed(() => Array.from({ length: maxEfficiency() - minEfficiency() + 1 }, (_, index) => minEfficiency() + index))
const efficiencyOptions = computed(() => [{ value: 0, label: 'Best value for the budget' }, ...efficiencyLevels.value])
const cheapestTerahash = computed(() => Math.min(...efficiencyLevels.value.map(level => minerPrice(1, level))))
const result = ref<MiningEstimate | null>(null)
const calculatedInvestment = ref(1000)
const error = ref('')
const calculatedBtcPrice = ref(props.btcPrice)

// Inputs that cannot be estimated, such as a field halfway through being retyped, keep the last estimate on screen
// and say what to fix.
function calculate () {
  const investment = moneyToSpend.value
  const discount = userDiscount.value
  if (investment === '' || investment < 1 || investment > 1000000 || discount === '' || discount < 0 || discount > 100) {
    error.value = 'Enter an investment from $1 to $1,000,000 and a discount from 0 to 100%.'
    return
  }
  if (props.btcPrice <= 0 || props.btcPrice > 10000000 || props.reward === null || props.reward < 0 || props.reward > 1000000) {
    error.value = 'Check your Bitcoin price and daily mining reward above.'
    return
  }
  const estimate = bestOption(investment, props.btcPrice, props.reward, discount, efficiency.value)
  if (estimate.power === 0) {
    error.value = `This budget is below the price of 1 TH ($${cheapestTerahash.value.toFixed(2)}). Increase it to see returns.`
    return
  }
  error.value = ''
  calculatedBtcPrice.value = props.btcPrice
  calculatedInvestment.value = investment
  result.value = estimate
}

// Recalculates whenever anything it reads changes: the fields above, the market assumptions or GoMining's data.
watchEffect(calculate)
</script>
<template>
  <div class="grid grid-cols-[355px_minmax(0,1fr)] gap-6 [align-items:start] to-1100:grid-cols-[310px_minmax(0,1fr)] to-1100:gap-[18px] to-800:grid-cols-[1fr]">
    <form class="rounded-2xl border border-border bg-panel p-[26px] to-1100:p-[22px] to-480:p-5">
      <div class="mb-[7px] flex items-center gap-2.5">
        <AppIcon name="settings" class="h-[19px] w-[19px] text-purple" /><h2 class="text-[17px] font-[550] tracking-[-.3px]">
          Set up your investment
        </h2>
      </div>
      <p class="text-[16px] leading-[1.6] text-muted">
        A few details. A clearer picture.
      </p>
      <div class="mb-6 mt-[26px] flex flex-col gap-[23px] to-800:grid to-800:grid-cols-[1fr_1fr] to-800:gap-5 to-480:grid-cols-[1fr] to-480:gap-x-[13px] to-480:gap-y-[19px]">
        <div class="to-800:col-span-full">
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
          <div class="mt-2.5 grid grid-cols-[repeat(4,1fr)] gap-[7px]" aria-label="Investment presets">
            <button
              v-for="amount in [500, 1000, 5000, 10000]"
              :key="amount"
              type="button"
              class="transition-control focus-ring min-h-[34px] rounded-md border py-[7px] text-[12px] hover:border-[#684d9c] hover:bg-[#27203b] hover:text-[#c2acff]"
              :class="moneyToSpend === amount ? 'border-[#684d9c] bg-[#27203b] text-[#c2acff]' : 'border-border bg-[#1c1e2b] text-muted'"
              :aria-pressed="moneyToSpend === amount"
              @click="moneyToSpend = amount"
            >
              ${{ amount.toLocaleString('en-US') }}
            </button>
          </div>
        </div>
        <BaseSelect id="investment-efficiency" v-model="efficiency" label="Miner efficiency" :options="efficiencyOptions" unit="W / TH" />
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
            <span class="rounded bg-[#a68aff12] px-1.5 py-0.5 text-[12px] text-[#b4a1e0] to-480:hidden">On maintenance</span>
          </template>
        </BaseInput>
      </div>
      <p v-if="error" class="mb-[15px] text-[14px] leading-[1.5] text-[#ffb0b6]" role="alert">
        {{ error }}
      </p>
      <div class="mt-[23px] flex gap-[11px] border-t border-border pt-[19px] to-800:mt-[18px] to-800:pt-4">
        <AppIcon name="bolt" class="mt-0.5 h-[17px] w-[17px] shrink-0 text-purple" /><p class="text-[12px] leading-[1.7] text-muted">
          <strong class="mb-[3px] block font-medium text-[#d0cddd]">Make every terahash count.</strong>We price every efficiency from {{ minEfficiency() }} to {{ maxEfficiency() }} W / TH with GoMining's own valuation formula, then pick the best daily return for your budget.
        </p>
      </div>
    </form>
    <CalculatorResults
      :result="result"
      :investment="calculatedInvestment"
      :btc-price="calculatedBtcPrice"
      :stale="error !== ''"
      id-prefix="investment"
    />
  </div>
</template>
