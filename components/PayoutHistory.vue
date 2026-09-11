<script setup lang="ts">
import type { HistoryPoint } from '~/data/gomining'

const points = ref<HistoryPoint[]>([])
const status = ref<'loading' | 'ready' | 'error'>('loading')

// Loaded after the page renders, like the market data: the calculators never wait on it.
onMounted(async () => {
  try {
    points.value = (await $fetch('/api/market/history', { signal: AbortSignal.timeout(10000) })).points
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
const tileValue = 'mb-2 mt-[7px] block font-display text-[20px] font-[650] tracking-[-.5px] tabular-nums [overflow-wrap:anywhere]'
const thFirst = 'sticky top-0 border-b border-border bg-panel pb-1.5 text-left font-normal text-dim'
const thRest = 'sticky top-0 border-b border-border bg-panel pb-1.5 text-right font-normal text-dim'
const tdFirst = 'border-b border-[#22252f] px-0 py-[5px] text-label'
const tdRest = 'border-b border-[#22252f] px-0 py-[5px] text-right text-muted'
</script>

<template>
  <section class="mt-6 rounded-2xl border border-border bg-panel px-[26px] py-[23px] to-800:p-5 to-480:p-[17px]" aria-labelledby="history-title">
    <div class="flex items-center gap-[13px] to-800:flex-wrap">
      <span class="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-[11px] bg-[#202030] text-[#ada1cc]"><AppIcon name="clock" class="h-5 w-5" /></span>
      <div class="min-w-0 flex-1">
        <h2 id="history-title" class="text-[14px] font-[550]">
          Payout history
        </h2>
        <p class="mt-1 text-[12px] text-dim">
          GoMining's daily pool payout per TH, recorded once a day after it publishes.
        </p>
      </div>
      <span v-if="points.length" class="flex shrink-0 items-center gap-1.5 text-[12px] text-green to-800:w-full"><span class="inline-block h-[5px] w-[5px] shrink-0 rounded-[50%] bg-green" />{{ points.length }} {{ points.length === 1 ? 'day' : 'days' }} since {{ day(points[0].date) }}</span>
    </div>

    <p v-if="status === 'loading'" class="mt-[18px] text-[12px] leading-[1.6] text-dim">
      Loading the recorded payouts…
    </p>
    <p v-else-if="status === 'error'" class="mt-[18px] text-[12px] leading-[1.6] text-dim">
      The payout history is unavailable right now. The calculators above are unaffected.
    </p>
    <p v-else-if="!points.length" class="mt-[18px] text-[12px] leading-[1.6] text-dim">
      Nothing recorded yet. The first day is added after GoMining's next payout, between 04:00 and 05:00 UTC.
    </p>

    <template v-else>
      <div class="mt-5 grid gap-3 to-800:grid-cols-[minmax(0,1fr)]" :class="points.length === 1 ? 'max-w-[420px] grid-cols-[minmax(0,1fr)]' : 'grid-cols-3'">
        <article class="min-w-0 rounded-xl border border-border bg-[#0f111a80] px-[17px] py-[15px]">
          <span class="block text-[12px] text-muted">Latest payout</span>
          <strong :class="tileValue">{{ money(latest.rewardUsdPerThDay) }} <small class="font-sans text-[12px] font-normal tracking-normal text-dim">/ TH / day</small></strong>
          <p class="text-[12px] leading-[1.6] text-dim">
            {{ day(latest.date) }} · {{ number(latest.rewardSatPerThDay) }} sat / TH at {{ money(latest.btcPriceUsd, 0) }} BTC
          </p>
        </article>
        <template v-if="points.length > 1">
          <article class="min-w-0 rounded-xl border border-border bg-[#0f111a80] px-[17px] py-[15px]">
            <span class="block text-[12px] text-muted">Lowest recorded</span>
            <strong :class="tileValue">{{ money(lowest.rewardUsdPerThDay) }}</strong>
            <p class="text-[12px] leading-[1.6] text-dim">
              {{ day(lowest.date) }}
            </p>
          </article>
          <article class="min-w-0 rounded-xl border border-border bg-[#0f111a80] px-[17px] py-[15px]">
            <span class="block text-[12px] text-muted">Highest recorded</span>
            <strong :class="tileValue">{{ money(highest.rewardUsdPerThDay) }}</strong>
            <p class="text-[12px] leading-[1.6] text-dim">
              {{ day(highest.date) }}
            </p>
          </article>
        </template>
      </div>

      <div v-if="points.length > 1" class="mt-5 flex gap-2.5">
        <div class="flex h-[170px] w-[62px] shrink-0 flex-col justify-between pb-3 pt-[22px] text-[11px] tabular-nums text-dim to-480:w-[54px] to-480:text-[10px]">
          <span v-for="(tick, index) in ticks" :key="index">{{ tick }}</span>
        </div>
        <div class="min-w-0 flex-1">
          <svg class="block h-[170px] w-full overflow-visible text-green" viewBox="0 0 600 170" preserveAspectRatio="none" role="img" :aria-label="`Daily payout per TH over ${points.length} recorded days, from ${money(points[0].rewardUsdPerThDay)} on ${day(points[0].date)} to ${money(latest.rewardUsdPerThDay)} on ${day(latest.date)}.`">
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
          <div class="mt-2 flex justify-between text-[12px] text-dim">
            <span v-for="(label, index) in axisDates" :key="index">{{ label }}</span>
          </div>
        </div>
      </div>
      <p v-else class="mt-[18px] text-[12px] leading-[1.6] text-dim">
        One day recorded so far; the chart appears after the second. GoMining doesn't publish past daily payouts, so the history starts here.
      </p>

      <details class="group mt-[18px] border-t border-border pt-[15px]">
        <summary class="focus-ring flex cursor-pointer list-none items-center gap-2 text-[12px] text-muted hover:text-text [&::-webkit-details-marker]:hidden">
          <AppIcon name="chevron" class="h-[15px] w-[15px] [transition:transform_.2s] group-open:rotate-180 motion-reduce:transition-none" />Every recorded day
        </summary>
        <div class="mt-3.5 max-h-[260px] overflow-auto">
          <table class="w-full min-w-[360px] border-collapse text-[12px] tabular-nums">
            <thead>
              <tr>
                <th scope="col" :class="thFirst">
                  Payout date
                </th>
                <th scope="col" :class="thRest">
                  Per TH
                </th>
                <th scope="col" :class="thRest">
                  sat / TH
                </th>
                <th scope="col" :class="thRest">
                  BTC price
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="point in newestFirst" :key="point.date">
                <td :class="tdFirst">
                  {{ day(point.date) }}
                </td>
                <td :class="tdRest">
                  {{ money(point.rewardUsdPerThDay, 6) }}
                </td>
                <td :class="tdRest">
                  {{ number(point.rewardSatPerThDay) }}
                </td>
                <td :class="tdRest">
                  {{ money(point.btcPriceUsd, 0) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </details>
    </template>
  </section>
</template>
