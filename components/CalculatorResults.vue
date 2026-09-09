<script setup lang="ts">
interface MiningResult {
  reward: number
  profit: number
  powerCostC1: number
  serviceCostC2: number
  price: number
  basePrice: number
  energyBonus: number
  powerBonus: number
  marginalPrice: number
  rateOfInvestment: number
  power: number
  efficiency: number
}
const props = defineProps<{ result: MiningResult | null, investment: number, btcPrice: number, stale: boolean, idPrefix: string, referenceEfficiency: number, nft?: boolean }>()
const formatPrecise = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(value)
const period = ref(30)
const periods = [{ label: 'Day', days: 1 }, { label: 'Month', days: 30 }, { label: 'Year', days: 365 }]
const formatMoney = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(value)
const profit = computed(() => props.result?.profit ?? 0)
const annualProfit = computed(() => profit.value * 365)
const dailyReward = computed(() => Number(((props.result?.reward ?? 0) / 100000000 * props.btcPrice).toFixed(2)))
const payback = computed(() => profit.value > 0 && props.investment > 0 ? Math.ceil(props.investment / profit.value) : null)
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
</script>
<template>
  <section class="results-panel" :class="{ 'negative-result': profit < 0 }" :aria-label="nft ? 'NFT profitability results' : 'Investment results'">
    <div class="results-topline">
      <h2>Your estimated returns</h2><span class="estimate-tag"><span class="status-dot" />{{ stale ? 'Previous estimate' : 'Based on your inputs' }}</span>
    </div>
    <template v-if="result">
      <div class="profit-card">
        <div class="profit-topline">
          <span>Net mining profit</span><div class="period-switch" role="group" aria-label="Profit period">
            <button
              v-for="item in periods"
              :key="item.days"
              type="button"
              :aria-pressed="period === item.days"
              :class="{ active: period === item.days }"
              @click="period = item.days"
            >
              {{ item.label }}
            </button>
          </div>
        </div>
        <div class="profit-summary">
          <div>
            <div class="profit-value">
              {{ formatMoney(profit * period) }}<span>/ {{ period === 1 ? 'day' : period === 30 ? 'month' : 'year' }}</span>
            </div><p>After electricity and service costs</p>
          </div><div class="profit-glyph" aria-hidden="true">
            <AppIcon name="chart" />
          </div>
        </div>
        <div class="profit-divider" />
        <div class="key-metrics">
          <div><span>Annual ROI <AppIcon name="chart" /></span><strong :class="{ 'positive-text': result.rateOfInvestment > 0 }">{{ result.rateOfInvestment.toLocaleString('en-US', { maximumFractionDigits: 2 }) }}<small>%</small></strong></div>
          <div><span>Est. payback <AppIcon name="clock" /></span><strong>{{ payback ? payback.toLocaleString('en-US') : '—' }}<small v-if="payback">days</small></strong></div>
          <div><span>{{ nft ? 'Est. miner value' : 'Investment' }} <AppIcon name="chip" /></span><strong>{{ formatMoney(investment) }}</strong></div>
        </div>
      </div>
      <div class="projection-card">
        <div class="section-heading">
          <h3>See the bigger picture</h3><span><i /> Cumulative net profit</span>
        </div>
        <div class="chart-layout">
          <div class="chart-axis">
            <span v-for="(tick, index) in graphTicks" :key="index">{{ tick }}</span>
          </div>
          <div class="chart-plot">
            <svg class="projection-chart" viewBox="0 0 600 170" preserveAspectRatio="none" role="img" :aria-label="`Estimated cumulative net profit over 12 months: ${formatMoney(annualProfit)}. Assumes constant daily returns.`">
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
            <div class="chart-months">
              <span>Today</span><span>3 mo</span><span>6 mo</span><span>9 mo</span><span>12 mo</span>
            </div>
          </div>
        </div>
        <div class="projection-total">
          <span>12 months of potential</span><strong>{{ formatMoney(annualProfit) }} <AppIcon name="arrow" /></strong>
        </div>
      </div>
      <div class="detail-grid">
        <div class="detail-card">
          <div class="detail-heading">
            <span class="detail-icon"><AppIcon name="chip" /></span><h3>{{ nft ? 'Your miner' : 'Optimal configuration' }}</h3>
          </div><div class="detail-line">
            <span>Mining power</span><strong>{{ result.power.toLocaleString('en-US') }} <small>TH</small></strong>
          </div><div class="detail-line">
            <span>Energy efficiency</span><strong>{{ result.efficiency }} <small>W / TH</small></strong>
          </div><div class="detail-line muted-detail">
            <span>Miner price</span><strong>{{ formatMoney(result.price) }}</strong>
          </div><div class="detail-line muted-detail">
            <span>Next TH costs</span><span>{{ formatPrecise(result.marginalPrice) }}</span>
          </div>
        </div>
        <div class="detail-card">
          <div class="detail-heading">
            <span class="detail-icon mint-icon"><AppIcon name="bolt" /></span><h3>The daily breakdown</h3>
          </div><div class="detail-line">
            <span>Mining reward</span><strong>{{ formatMoney(dailyReward) }}</strong>
          </div><div class="detail-line">
            <span>Electricity <small>C1</small></span><span>−{{ formatMoney(result.powerCostC1) }}</span>
          </div><div class="detail-line">
            <span>Service fee <small>C2</small></span><span>−{{ formatMoney(result.serviceCostC2) }}</span>
          </div>
        </div>
      </div>
      <p class="results-assumption">
        {{ period === 30 ? 'Monthly estimates use 30 days. ' : '' }}Annual estimates use 365 days, without reinvestment.
      </p>
    </template>
    <div v-else class="results-empty">
      <span class="small-icon"><AppIcon name="chart" /></span><h3>A clearer outlook starts here.</h3><p>Check your inputs, then calculate to see your estimated returns.</p>
    </div>
  </section>
</template>
<style scoped>
.results-topline { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin: 0 0 15px; }
.results-topline h2 { font-size: 16px; font-weight: 500; }
.estimate-tag { color: var(--dim); display: flex; gap: 6px; align-items: center; font-size: 12px; }
.estimate-tag .status-dot { width: 5px; height: 5px; background: #9d8fc1; }
.profit-card { padding: 21px 25px 23px; background: radial-gradient(ellipse at 88% 4%, #7950ad28, transparent 66%), linear-gradient(110deg, #201b32, #191827); border: 1px solid #423155; border-radius: 14px; }
.profit-topline { display: flex; align-items: center; justify-content: space-between; gap: 14px; color: #d5cce9; font-size: 14px; }
.period-switch { display: flex; padding: 3px; border: 1px solid #41334f; background: #17132090; border-radius: 7px; }
.period-switch button { min-width: 45px; padding: 5px 9px; border: 0; border-radius: 4px; background: transparent; color: #a79ab8; font-size: 12px; }
.period-switch button.active { background: #514164; color: #f1e9ff; box-shadow: 0 1px 3px #0002; }
.period-switch button:hover { color: white; }
.profit-summary { display: flex; align-items: center; justify-content: space-between; margin-top: 15px; gap: 10px; }
.profit-value { font-family: 'Manrope', sans-serif; font-size: clamp(30px, 3.6vw, 45px); line-height: 1.2; font-weight: 650; letter-spacing: -1.9px; font-variant-numeric: tabular-nums; }
.profit-value > span { margin-left: 9px; font-family: 'DM Sans', sans-serif; font-size: 14px; font-weight: 400; letter-spacing: 0; color: #ac9fbf; }
.profit-summary p { margin-top: 8px; font-size: 12px; color: #a698b9; }
.profit-glyph { display: grid; place-items: center; width: 53px; height: 53px; flex-shrink: 0; background: #a37bf017; border: 1px solid #a37bf032; border-radius: 15px; color: #c4a0ff; }
.profit-glyph svg { width: 26px; height: 26px; }
.profit-divider { height: 1px; background: #9a78bd26; margin: 23px 0 18px; }
.key-metrics { display: grid; grid-template-columns: 1fr 1fr 1.1fr; gap: 14px; }
.key-metrics > div + div { border-left: 1px solid #9a78bd26; padding-left: 22px; }
.key-metrics > div > span { display: flex; align-items: center; gap: 7px; font-size: 12px; color: #b1a3c2; margin-bottom: 7px; }
.key-metrics svg { width: 13px; height: 13px; color: #917da7; }
.key-metrics strong { font-family: 'Manrope', sans-serif; font-size: 21px; letter-spacing: -.6px; font-weight: 650; font-variant-numeric: tabular-nums; }
.key-metrics small { margin-left: 4px; font-family: 'DM Sans', sans-serif; font-weight: 400; font-size: 12px; color: #b5a8c4; }
.key-metrics .positive-text, .key-metrics .positive-text small { color: var(--green); }
.projection-card { margin-top: 17px; border: 1px solid var(--border); border-radius: 14px; background: var(--panel); padding: 20px 23px 0; overflow: hidden; }
.section-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.section-heading h3 { font-size: 14px; font-weight: 500; }
.section-heading > span { color: var(--dim); font-size: 12px; display: flex; align-items: center; gap: 7px; }
.section-heading i { display: inline-block; width: 6px; height: 6px; border-radius: 2px; background: #ad8aee; }
.chart-layout { display: flex; gap: 10px; margin-top: 8px; }
.chart-axis { width: 47px; height: 170px; display: flex; flex-shrink: 0; flex-direction: column; justify-content: space-between; padding: 22px 0 12px; font-size: 12px; color: var(--dim); }
.chart-plot { flex: 1; min-width: 0; }
.projection-chart { width: 100%; height: 170px; color: #ad8aee; overflow: visible; display: block; }
.chart-months { display: flex; justify-content: space-between; font-size: 12px; color: var(--dim); padding: 0 0 18px; }
.projection-total { margin: 0 -23px; padding: 13px 23px; border-top: 1px solid var(--border); display: flex; justify-content: space-between; gap: 12px; align-items: center; }
.projection-total > span { font-size: 12px; color: var(--muted); }
.projection-total strong { font-size: 14px; color: #c3a4ff; font-weight: 500; display: flex; align-items: center; gap: 8px; }
.projection-total svg { width: 14px; height: 14px; transform: rotate(-40deg); }
.detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 17px; }
.detail-card { min-width: 0; border: 1px solid var(--border); background: var(--panel); border-radius: 14px; padding: 17px 20px; }
.detail-heading { display: flex; gap: 8px; align-items: center; margin-bottom: 15px; }
.detail-heading h3 { font-size: 12px; font-weight: 500; }
.detail-icon { color: #ae93e8; }
.detail-icon svg { width: 16px; height: 16px; }
.mint-icon { color: #8bbfaf; }
.detail-line { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; margin-top: 9px; font-size: 12px; }
.detail-line > span:first-child { color: var(--muted); }
.detail-line > span:last-child { font-variant-numeric: tabular-nums; }
.detail-line strong { font-weight: 550; font-variant-numeric: tabular-nums; white-space: nowrap; }
.detail-line small { color: var(--dim); font-weight: 400; font-size: 12px; margin-left: 3px; }
.muted-detail { border-top: 1px solid var(--border); margin-top: 13px; padding-top: 10px; flex-wrap: wrap; gap: 4px; font-size: 12px; color: var(--muted); }
.results-assumption { font-size: 12px; color: var(--dim); margin-top: 12px; }
.results-empty { display: flex; flex-direction: column; align-items: center; text-align: center; padding: 90px 30px; border: 1px solid var(--border); border-radius: 14px; background: var(--panel); }
.results-empty h3 { font-size: 18px; margin: 20px 0 8px; }
.results-empty p { max-width: 320px; color: var(--muted); font-size: 14px; line-height: 1.7; }
.negative-result .profit-value, .negative-result .projection-chart, .negative-result .projection-total strong { color: #f3a2aa; }
@media (max-width: 1100px) {
  .profit-card { padding: 20px; }
  .key-metrics strong { font-size: 18px; }
  .key-metrics > div + div { padding-left: 13px; }
  .key-metrics > div > span { font-size: 12px; }
  .key-metrics svg { display: none; }
  .profit-glyph { display: none; }
  .detail-grid { gap: 12px; }
  .detail-card { padding: 16px; }
}
@media (max-width: 800px) {
  .results-panel { margin-top: 8px; }
  .profit-value { font-size: 44px; }
  .profit-glyph { display: grid; }
  .key-metrics strong { font-size: 22px; }
  .key-metrics > div > span { font-size: 12px; }
  .projection-chart, .chart-axis { height: 185px; }
}
@media (max-width: 480px) {
  .results-topline h2 { font-size: 14px; }
  .estimate-tag { font-size: 12px; }
  .profit-card { padding: 18px; }
  .profit-value { font-size: 38px; }
  .profit-value > span { font-size: 12px; margin-left: 7px; }
  .profit-glyph { display: none; }
  .key-metrics { gap: 9px; grid-template-columns: 1fr 1fr 1.15fr; }
  .key-metrics > div + div { padding-left: 10px; }
  .key-metrics strong { font-size: 18px; }
  .key-metrics small { font-size: 12px; margin-left: 2px; }
  .key-metrics > div > span { font-size: 12px; }
  .period-switch button { min-width: 38px; padding: 5px 6px; }
  .projection-card { padding: 19px 16px 0; }
  .section-heading { align-items: flex-start; flex-direction: column; gap: 8px; }
  .projection-total { margin: 0 -16px; padding: 13px 16px; }
  .detail-grid { grid-template-columns: 1fr; }
  .detail-line { font-size: 14px; }
  .detail-heading h3 { font-size: 14px; }
  .muted-detail { flex-direction: row; font-size: 12px; }
}
.profit-value { overflow-wrap: anywhere; }
.key-metrics > div { min-width: 0; }
.key-metrics strong { display: block; overflow-wrap: anywhere; }
.key-metrics > div > span { flex-wrap: wrap; }
.detail-line { flex-wrap: wrap; }
.period-switch button { min-height: 28px; }
@media (max-width: 480px) {
  .profit-topline { flex-wrap: wrap; gap: 10px; }
  .results-topline { flex-wrap: wrap; gap: 6px; }
  .key-metrics { grid-template-columns: 1fr 1fr; row-gap: 16px; }
  .key-metrics > div:last-child { grid-column: 1 / -1; border-left: 0; border-top: 1px solid #9a78bd26; padding: 12px 0 0; }
  .key-metrics > div:last-child strong { font-size: 20px; }
  .projection-total { flex-wrap: wrap; }
}
</style>
