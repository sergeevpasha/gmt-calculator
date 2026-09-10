<script setup lang="ts">
import type { HistoryPoint } from '~/data/gomining'

const points = ref<HistoryPoint[]>([])
const status = ref<'loading' | 'ready' | 'error'>('loading')

const isPoint = (value: unknown): value is HistoryPoint => {
  const point = value as HistoryPoint
  return !!point && typeof point.date === 'string' && Number.isFinite(point.rewardUsdPerThDay) && Number.isFinite(point.rewardSatPerThDay) && Number.isFinite(point.btcPriceUsd)
}

// Loaded after the page renders, like the market data: the calculators never wait on it.
onMounted(async () => {
  try {
    const response = await fetch('/api/market/history', { signal: AbortSignal.timeout(10000) })
    if (!response.ok) { throw new Error('Market history unavailable') }
    const data = await response.json()
    points.value = (Array.isArray(data?.points) ? data.points : []).filter(isPoint)
    status.value = 'ready'
  } catch {
    status.value = 'error'
  }
})

const money = (value: number, digits = 4) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value)
const number = (value: number, digits = 2) => new Intl.NumberFormat('en-US', { maximumFractionDigits: digits }).format(value)
const day = (value: string) => new Date(`${value}T00:00:00Z`).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })

const latest = computed(() => points.value[points.value.length - 1])
const lowest = computed(() => points.value.reduce((low, point) => point.rewardUsdPerThDay < low.rewardUsdPerThDay ? point : low, points.value[0]))
const highest = computed(() => points.value.reduce((high, point) => point.rewardUsdPerThDay > high.rewardUsdPerThDay ? point : high, points.value[0]))
const newestFirst = computed(() => [...points.value].reverse())

// Same geometry as the projection chart: a 600 × 170 box plotted between y = 28 and y = 151.
const TOP = 28
const BOTTOM = 151
const bounds = computed(() => {
  const values = points.value.map(point => point.rewardUsdPerThDay)
  const min = Math.min(...values)
  const max = Math.max(...values)
  // Pad so the line never rides the frame, and give a perfectly flat series some room to sit in.
  const pad = (max - min) * 0.2 || max * 0.05 || 0.0001
  return { low: min - pad, high: max + pad }
})
const x = (index: number) => index / (points.value.length - 1) * 600
const y = (value: number) => BOTTOM - (value - bounds.value.low) / (bounds.value.high - bounds.value.low) * (BOTTOM - TOP)
const linePath = computed(() => points.value.map((point, index) => `${index ? 'L' : 'M'} ${x(index)} ${y(point.rewardUsdPerThDay)}`).join(' '))
const areaPath = computed(() => `${linePath.value} L 600 170 L 0 170 Z`)
const ticks = computed(() => [0, 0.25, 0.5, 0.75, 1].map(fraction => money(bounds.value.high - (bounds.value.high - bounds.value.low) * fraction)))
const axisDates = computed(() => {
  const list = points.value
  const middle = list[Math.floor((list.length - 1) / 2)]
  return [list[0], middle, list[list.length - 1]].map(point => day(point.date))
})
</script>

<template>
  <section class="history-panel" aria-labelledby="history-title">
    <div class="history-heading">
      <span class="small-icon"><AppIcon name="clock" /></span>
      <div>
        <h2 id="history-title">
          Payout history
        </h2>
        <p>GoMining's daily pool payout per TH, recorded once a day after it publishes.</p>
      </div>
      <span v-if="points.length" class="history-stamp"><span class="status-dot" />{{ points.length }} {{ points.length === 1 ? 'day' : 'days' }} since {{ day(points[0].date) }}</span>
    </div>

    <p v-if="status === 'loading'" class="history-empty">
      Loading the recorded payouts…
    </p>
    <p v-else-if="status === 'error'" class="history-empty">
      The payout history is unavailable right now. The calculators above are unaffected.
    </p>
    <p v-else-if="!points.length" class="history-empty">
      Recording starts with the next daily reading, shortly after GoMining publishes its payout around 03:30 UTC.
    </p>

    <template v-else>
      <div class="history-stats" :class="{ 'is-single': points.length === 1 }">
        <article>
          <span>Latest payout</span>
          <strong>{{ money(latest.rewardUsdPerThDay) }} <small>/ TH / day</small></strong>
          <p>{{ day(latest.date) }} · {{ number(latest.rewardSatPerThDay) }} sat / TH at {{ money(latest.btcPriceUsd, 0) }} BTC</p>
        </article>
        <template v-if="points.length > 1">
          <article>
            <span>Lowest recorded</span>
            <strong>{{ money(lowest.rewardUsdPerThDay) }}</strong>
            <p>{{ day(lowest.date) }}</p>
          </article>
          <article>
            <span>Highest recorded</span>
            <strong>{{ money(highest.rewardUsdPerThDay) }}</strong>
            <p>{{ day(highest.date) }}</p>
          </article>
        </template>
      </div>

      <div v-if="points.length > 1" class="chart-layout">
        <div class="chart-axis">
          <span v-for="(tick, index) in ticks" :key="index">{{ tick }}</span>
        </div>
        <div class="chart-plot">
          <svg class="history-chart" viewBox="0 0 600 170" preserveAspectRatio="none" role="img" :aria-label="`Daily payout per TH over ${points.length} recorded days, from ${money(points[0].rewardUsdPerThDay)} on ${day(points[0].date)} to ${money(latest.rewardUsdPerThDay)} on ${day(latest.date)}.`">
            <defs><linearGradient id="history-chart-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="currentColor" stop-opacity=".18" /><stop offset="100%" stop-color="currentColor" stop-opacity="0" /></linearGradient></defs>
            <path
              v-for="line in [28, 58.75, 89.5, 120.25, 151]"
              :key="line"
              :d="`M 0 ${line} H 600`"
              stroke="#2b2b3d"
              stroke-width="1"
              stroke-dasharray="3 5"
            />
            <path :d="areaPath" fill="url(#history-chart-fill)" />
            <path
              :d="linePath"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linejoin="round"
              vector-effect="non-scaling-stroke"
            />
            <circle :cx="x(points.length - 1)" :cy="y(latest.rewardUsdPerThDay)" r="4" fill="currentColor" />
          </svg>
          <div class="chart-dates">
            <span v-for="(label, index) in axisDates" :key="index">{{ label }}</span>
          </div>
        </div>
      </div>
      <p v-else class="history-note">
        One reading so far. The chart draws itself once a second day is recorded. GoMining publishes no earlier daily history, so the series grows from here rather than being filled in.
      </p>

      <details class="history-detail">
        <summary><AppIcon name="chevron" />Every recorded day</summary>
        <div class="table-scroll">
          <table>
            <thead>
              <tr>
                <th scope="col">
                  Payout date
                </th>
                <th scope="col">
                  Per TH
                </th>
                <th scope="col">
                  sat / TH
                </th>
                <th scope="col">
                  BTC price
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="point in newestFirst" :key="point.date">
                <td>{{ day(point.date) }}</td>
                <td>{{ money(point.rewardUsdPerThDay, 6) }}</td>
                <td>{{ number(point.rewardSatPerThDay) }}</td>
                <td>{{ money(point.btcPriceUsd, 0) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </details>
    </template>
  </section>
</template>

<style scoped>
.history-panel { margin-top: 24px; border: 1px solid var(--border); border-radius: 16px; background: var(--panel); padding: 23px 26px; }
.history-heading { display: flex; align-items: center; gap: 13px; }
.history-heading h2 { font-size: 14px; font-weight: 550; }
.history-heading > div:nth-child(2) { flex: 1; min-width: 0; }
.history-heading p { color: var(--dim); font-size: 12px; margin-top: 4px; }
.history-stamp { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--green); flex-shrink: 0; }
.history-stamp .status-dot { width: 5px; height: 5px; background: var(--green); }
.history-empty, .history-note { margin-top: 18px; font-size: 12px; line-height: 1.6; color: var(--dim); }
.history-stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin-top: 20px; }
.history-stats.is-single { grid-template-columns: minmax(0, 1fr); max-width: 420px; }
.history-stats article { border: 1px solid var(--border); border-radius: 12px; background: #0f111a80; padding: 15px 17px; min-width: 0; }
.history-stats span { display: block; font-size: 12px; color: var(--muted); }
.history-stats strong { display: block; margin: 7px 0 8px; font-family: 'Manrope', sans-serif; font-size: 20px; font-weight: 650; letter-spacing: -.5px; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.history-stats small { font-family: 'DM Sans', sans-serif; font-size: 12px; font-weight: 400; color: var(--dim); letter-spacing: 0; }
.history-stats p { font-size: 12px; color: var(--dim); line-height: 1.6; }
.chart-layout { display: flex; gap: 10px; margin-top: 20px; }
.chart-axis { width: 62px; height: 170px; display: flex; flex-shrink: 0; flex-direction: column; justify-content: space-between; padding: 22px 0 12px; font-size: 11px; color: var(--dim); font-variant-numeric: tabular-nums; }
.chart-plot { flex: 1; min-width: 0; }
.history-chart { width: 100%; height: 170px; color: var(--green); overflow: visible; display: block; }
.chart-dates { display: flex; justify-content: space-between; margin-top: 8px; font-size: 12px; color: var(--dim); }
.history-detail { margin-top: 18px; border-top: 1px solid var(--border); padding-top: 15px; }
.history-detail summary { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--muted); cursor: pointer; list-style: none; }
.history-detail summary::-webkit-details-marker { display: none; }
.history-detail summary:hover { color: var(--text); }
.history-detail summary svg { width: 15px; height: 15px; transition: transform .2s; }
.history-detail[open] summary svg { transform: rotate(180deg); }
.table-scroll { max-height: 260px; overflow: auto; margin-top: 14px; }
table { width: 100%; min-width: 360px; border-collapse: collapse; font-size: 12px; font-variant-numeric: tabular-nums; }
th { text-align: left; font-weight: 400; color: var(--dim); padding-bottom: 6px; border-bottom: 1px solid var(--border); position: sticky; top: 0; background: var(--panel); }
td { padding: 5px 0; color: var(--muted); border-bottom: 1px solid #22252f; }
td:first-child { color: #cccadb; }
td + td, th + th { text-align: right; }
@media (max-width: 800px) {
  .history-panel { padding: 20px; }
  .history-heading { flex-wrap: wrap; }
  .history-stamp { width: 100%; }
  .history-stats { grid-template-columns: minmax(0, 1fr); }
}
@media (max-width: 480px) {
  .history-panel { padding: 17px; }
  .chart-axis { width: 54px; font-size: 10px; }
}
</style>
