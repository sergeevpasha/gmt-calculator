<script setup lang="ts">
import type { MiningEstimate, UpgradeOption } from '~/composables/useInvest'

const props = defineProps<{ result: MiningEstimate | null, investment: number, btcPrice: number, stale: boolean, idPrefix: string, upgrades?: UpgradeOption[], nft?: boolean }>()
const formatPrecise = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(value)
const period = ref(30)
const periods = [{ label: 'Day', days: 1 }, { label: 'Month', days: 30 }, { label: 'Year', days: 365 }]
const formatMoney = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(value)
const profit = computed(() => props.result?.profit ?? 0)
const annualProfit = computed(() => profit.value * 365)
const dailyReward = computed(() => Number(((props.result?.reward ?? 0) / 100000000 * props.btcPrice).toFixed(2)))
const payback = computed(() => profit.value > 0 ? Math.ceil(props.investment / profit.value) : null)
const graphMaximum = computed(() => Math.max(10, Math.ceil(Math.abs(annualProfit.value) / 4 / 10) * 10 * 4))
const graphEnd = computed(() => 151 - Math.abs(annualProfit.value) / graphMaximum.value * 123)
const graphPath = computed(() => annualProfit.value >= 0 ? `M 0 151 L 600 ${graphEnd.value}` : `M 0 28 L 600 ${179 - graphEnd.value}`)
const graphArea = computed(() => `${graphPath.value} L 600 160 L 0 160 Z`)
// Compact labels are built by hand because Node and browsers format compact currency differently, which breaks hydration.
const formatTick = (value: number) => {
  const magnitude = Math.abs(value)
  const compact = magnitude >= 1000000 ? `${(magnitude / 1000000).toFixed(1)}M` : magnitude >= 1000 ? `${(magnitude / 1000).toFixed(1)}K` : String(Math.round(magnitude))
  return `${value < 0 ? '-' : ''}$${compact.replace(/\.0(?=[KM]$)/, '')}`
}
const graphTicks = computed(() => [1, 0.75, 0.5, 0.25, 0].map((fraction) => {
  const value = annualProfit.value < 0 ? -graphMaximum.value * (1 - fraction) : graphMaximum.value * fraction
  return formatTick(value)
}))
// Class groups for the elements the template repeats.
const negative = computed(() => profit.value < 0)
const metricLabel = 'mb-[7px] flex flex-wrap items-center gap-[7px] text-[12px] text-[#b1a3c2]'
const metricIcon = 'h-[13px] w-[13px] text-[#917da7] to-1100:hidden'
const metricValue = 'block font-display text-[21px] font-[650] tracking-[-.6px] tabular-nums [overflow-wrap:anywhere] to-1100:text-[18px] to-800:text-[22px]'
const metricUnit = 'ml-1 font-sans text-[12px] font-normal to-480:ml-0.5'
const detailHeading = 'mb-[15px] flex items-center gap-2'
const detailTitle = 'text-[12px] font-medium to-480:text-[14px]'
const detailLine = 'mt-[9px] flex flex-wrap items-baseline justify-between gap-2.5 text-[12px] to-480:text-[14px]'
const detailValue = 'whitespace-nowrap font-[550] tabular-nums'
const detailUnit = 'ml-[3px] text-[12px] font-normal text-dim'
const tableHead = 'sticky top-0 border-b border-border bg-panel pb-1.5 font-normal text-dim'
const tableValue = 'border-b border-[#22252f] px-0 py-1.5 text-right text-muted'
</script>
<template>
  <section class="to-800:mt-2" :aria-label="nft ? 'NFT profitability results' : 'Investment results'">
    <div class="mb-[15px] flex items-center justify-between gap-3 to-480:flex-wrap to-480:gap-1.5">
      <h2 class="text-[16px] font-medium to-480:text-[14px]">
        Your estimated returns
      </h2><span class="flex items-center gap-1.5 text-[12px] text-dim"><span class="inline-block h-[5px] w-[5px] shrink-0 rounded-[50%] bg-[#9d8fc1]" />{{ stale ? 'Previous estimate' : 'Based on your inputs' }}</span>
    </div>
    <template v-if="result">
      <div class="rounded-[14px] border border-[#423155] bg-[radial-gradient(ellipse_at_88%_4%,#7950ad28,transparent_66%),linear-gradient(110deg,#201b32,#191827)] px-[25px] pb-[23px] pt-[21px] to-1100:p-5 to-480:p-[18px]">
        <div class="flex items-center justify-between gap-3.5 text-[14px] text-[#d5cce9] to-480:flex-wrap to-480:gap-2.5">
          <span>Net mining profit</span><div class="flex rounded-[7px] border border-[#41334f] bg-[#17132090] p-[3px]" role="group" aria-label="Profit period">
            <button
              v-for="item in periods"
              :key="item.days"
              class="transition-control focus-ring min-h-[28px] min-w-[45px] rounded border-0 px-[9px] py-[5px] text-[12px] hover:text-white to-480:min-w-[38px] to-480:px-1.5"
              :class="period === item.days ? 'bg-[#514164] text-[#f1e9ff] [box-shadow:0_1px_3px_#0002]' : 'bg-transparent text-[#a79ab8]'"
              type="button"
              :aria-pressed="period === item.days"
              @click="period = item.days"
            >
              {{ item.label }}
            </button>
          </div>
        </div>
        <div class="mt-[15px] flex items-center justify-between gap-2.5">
          <div>
            <div class="font-display text-[length:clamp(30px,3.6vw,45px)] font-[650] leading-[1.2] tracking-[-1.9px] tabular-nums [overflow-wrap:anywhere] to-800:text-[44px] to-480:text-[38px]" :class="{ 'text-[#f3a2aa]': negative }">
              {{ formatMoney(profit * period) }}<span class="ml-[9px] font-sans text-[14px] font-normal tracking-normal text-[#ac9fbf] to-480:ml-[7px] to-480:text-[12px]">/ {{ period === 1 ? 'day' : period === 30 ? 'month' : 'year' }}</span>
            </div><p class="mt-2 text-[12px] text-[#a698b9]">
              After electricity and service costs
            </p>
          </div><div class="grid h-[53px] w-[53px] shrink-0 place-items-center rounded-[15px] border border-[#a37bf032] bg-[#a37bf017] text-[#c4a0ff] to-1100:hidden to-800:grid to-480:hidden" aria-hidden="true">
            <AppIcon name="chart" class="h-[26px] w-[26px]" />
          </div>
        </div>
        <div class="mb-[18px] mt-[23px] h-px bg-[#9a78bd26]" />
        <div class="grid grid-cols-[1fr_1fr_1.1fr] gap-3.5 to-480:grid-cols-[1fr_1fr] to-480:gap-x-[9px] to-480:gap-y-4">
          <div class="min-w-0">
            <span :class="metricLabel">Annual ROI <AppIcon name="chart" :class="metricIcon" /></span><strong :class="[metricValue, 'to-480:text-[18px]', { 'text-green': result.rateOfInvestment > 0 }]">{{ result.rateOfInvestment.toLocaleString('en-US', { maximumFractionDigits: 2 }) }}<small :class="[metricUnit, result.rateOfInvestment > 0 ? 'text-green' : 'text-[#b5a8c4]']">%</small></strong>
          </div>
          <div class="min-w-0 border-l border-[#9a78bd26] pl-[22px] to-1100:pl-[13px] to-480:pl-2.5">
            <span :class="metricLabel">Est. payback <AppIcon name="clock" :class="metricIcon" /></span><strong :class="[metricValue, 'to-480:text-[18px]']">{{ payback ? payback.toLocaleString('en-US') : '—' }}<small v-if="payback" :class="[metricUnit, 'text-[#b5a8c4]']">days</small></strong>
          </div>
          <div class="min-w-0 border-l border-[#9a78bd26] pl-[22px] to-1100:pl-[13px] to-480:col-span-full to-480:border-l-0 to-480:border-t to-480:pb-0 to-480:pl-0 to-480:pr-0 to-480:pt-3">
            <span :class="metricLabel">{{ nft ? 'Est. miner value' : 'Investment' }} <AppIcon name="chip" :class="metricIcon" /></span><strong :class="[metricValue, 'to-480:text-[20px]']">{{ formatMoney(investment) }}</strong>
          </div>
        </div>
      </div>
      <div class="mt-[17px] overflow-hidden rounded-[14px] border border-border bg-panel px-[23px] pb-0 pt-5 to-480:px-4 to-480:pt-[19px]">
        <div class="flex items-center justify-between gap-3 to-480:flex-col to-480:items-start to-480:gap-2">
          <h3 class="text-[14px] font-medium">
            See the bigger picture
          </h3><span class="flex items-center gap-[7px] text-[12px] text-dim"><i class="inline-block h-1.5 w-1.5 rounded-sm bg-[#ad8aee]" /> Cumulative net profit</span>
        </div>
        <div class="mt-2 flex gap-2.5">
          <div class="flex h-[170px] w-[47px] shrink-0 flex-col justify-between pb-3 pt-[22px] text-[12px] text-dim to-800:h-[185px]">
            <span v-for="(tick, index) in graphTicks" :key="index">{{ tick }}</span>
          </div>
          <div class="min-w-0 flex-1">
            <svg
              class="block h-[170px] w-full overflow-visible to-800:h-[185px]"
              :class="negative ? 'text-[#f3a2aa]' : 'text-[#ad8aee]'"
              viewBox="0 0 600 170"
              preserveAspectRatio="none"
              role="img"
              :aria-label="`Estimated cumulative net profit over 12 months: ${formatMoney(annualProfit)}. Assumes constant daily returns.`"
            >
              <defs><linearGradient :id="`${idPrefix}-chart-fill`" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="currentColor" stop-opacity=".2" /><stop offset="100%" stop-color="currentColor" stop-opacity="0" /></linearGradient></defs>
              <path
                v-for="line in [28, 58.75, 89.5, 120.25, 151]"
                :key="line"
                :d="`M 0 ${line} H 600`"
                stroke="#2b2b3d"
                stroke-width="1"
                stroke-dasharray="3 5"
              />
              <path :d="graphArea" :fill="`url(#${idPrefix}-chart-fill)`" />
              <path :d="graphPath" fill="none" stroke="currentColor" stroke-width="2.5" vector-effect="non-scaling-stroke" />
              <circle cx="599" :cy="annualProfit >= 0 ? graphEnd : 179 - graphEnd" r="4" fill="currentColor" />
            </svg>
            <div class="flex justify-between pb-[18px] text-[12px] text-dim">
              <span>Today</span><span>3 mo</span><span>6 mo</span><span>9 mo</span><span>12 mo</span>
            </div>
          </div>
        </div>
        <div class="-mx-[23px] flex items-center justify-between gap-3 border-t border-border px-[23px] py-[13px] to-480:-mx-4 to-480:flex-wrap to-480:px-4">
          <span class="text-[12px] text-muted">12 months of potential</span><strong class="flex items-center gap-2 text-[14px] font-medium" :class="negative ? 'text-[#f3a2aa]' : 'text-[#c3a4ff]'">{{ formatMoney(annualProfit) }} <AppIcon name="arrow" class="h-3.5 w-3.5 -rotate-[40deg]" /></strong>
        </div>
      </div>
      <div class="mt-[17px] grid grid-cols-[1fr_1fr] gap-4 to-1100:gap-3 to-480:grid-cols-[1fr]">
        <div class="min-w-0 rounded-[14px] border border-border bg-panel px-5 py-[17px] to-1100:p-4">
          <div :class="detailHeading">
            <span class="text-[#ae93e8]"><AppIcon name="chip" class="h-4 w-4" /></span><h3 :class="detailTitle">
              {{ nft ? 'Your miner' : 'Optimal configuration' }}
            </h3>
          </div><div :class="detailLine">
            <span class="text-muted">Mining power</span><strong :class="detailValue">{{ result.power.toLocaleString('en-US') }} <small :class="detailUnit">TH</small></strong>
          </div><div :class="detailLine">
            <span class="text-muted">Energy efficiency</span><strong :class="detailValue">{{ result.efficiency }} <small :class="detailUnit">W / TH</small></strong>
          </div><div class="mt-[13px] flex flex-wrap items-baseline justify-between gap-1 border-t border-border pt-2.5 text-[12px] text-muted">
            <span class="text-muted">Miner price</span><strong :class="detailValue">{{ formatMoney(result.price) }}</strong>
          </div>
        </div>
        <div class="min-w-0 rounded-[14px] border border-border bg-panel px-5 py-[17px] to-1100:p-4">
          <div :class="detailHeading">
            <span class="text-[#8bbfaf]"><AppIcon name="bolt" class="h-4 w-4" /></span><h3 :class="detailTitle">
              The daily breakdown
            </h3>
          </div><div :class="detailLine">
            <span class="text-muted">Mining reward</span><strong :class="detailValue">{{ formatMoney(dailyReward) }}</strong>
          </div><div :class="detailLine">
            <span class="text-muted">Electricity <small :class="detailUnit">C1</small></span><span class="tabular-nums">−{{ formatMoney(result.powerCostC1) }}</span>
          </div><div :class="detailLine">
            <span class="text-muted">Service fee <small :class="detailUnit">C2</small></span><span class="tabular-nums">−{{ formatMoney(result.serviceCostC2) }}</span>
          </div>
        </div>
      </div>
      <div v-if="upgrades?.length" class="mt-[17px] rounded-[14px] border border-border bg-panel px-5 py-[17px]">
        <div :class="detailHeading">
          <span class="text-[#ae93e8]"><AppIcon name="bolt" class="h-4 w-4" /></span><h3 :class="detailTitle">
            Worth upgrading?
          </h3>
        </div>
        <p class="mb-[13px] text-[12px] leading-[1.6] text-dim">
          GoMining's price to improve this miner's efficiency, and how long the electricity saving takes to repay it.
        </p>
        <div class="max-h-[220px] overflow-auto">
          <table class="w-full min-w-[280px] border-collapse text-[12px] tabular-nums">
            <thead>
              <tr>
                <th scope="col" :class="[tableHead, 'text-left']">
                  To
                </th>
                <th scope="col" :class="[tableHead, 'text-right']">
                  Upgrade cost
                </th>
                <th scope="col" :class="[tableHead, 'text-right']">
                  Saves / day
                </th>
                <th scope="col" :class="[tableHead, 'text-right']">
                  Pays back in
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="option in upgrades" :key="option.efficiency">
                <td class="border-b border-[#22252f] px-0 py-1.5 text-label">
                  {{ option.efficiency }} W / TH
                </td>
                <td :class="tableValue">
                  {{ formatMoney(option.cost) }}
                </td>
                <td :class="tableValue">
                  {{ formatPrecise(option.savingPerDay) }}
                </td>
                <td :class="tableValue">
                  {{ option.paybackDays ? option.paybackDays.toLocaleString('en-US') + ' days' : '—' }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <p class="mt-3 text-[12px] text-dim">
        {{ period === 30 ? 'Monthly estimates use 30 days. ' : '' }}Annual estimates use 365 days, without reinvestment.
      </p>
    </template>
    <div v-else class="flex flex-col items-center rounded-[14px] border border-border bg-panel px-[30px] py-[90px] text-center">
      <span class="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-[11px] bg-[#202030] text-[#ada1cc]"><AppIcon name="chart" class="h-5 w-5" /></span><h3 class="mb-2 mt-5 text-[18px]">
        A clearer outlook starts here.
      </h3><p class="max-w-[320px] text-[14px] leading-[1.7] text-muted">
        Check your inputs, then calculate to see your estimated returns.
      </p>
    </div>
  </section>
</template>
