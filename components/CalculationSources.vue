<script setup lang="ts">
import { useInvest } from '~/composables/useInvest'
import type { MarketData } from '~/data/gomining'

const props = defineProps<{ market: MarketData, btcPrice: number, priceLabel: string, rewardLabel: string, live: boolean }>()
const { energyBonus, maxEfficiency } = useInvest(() => props.market)

const money = (value: number, digits = 2) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value)
const number = (value: number, digits = 2) => new Intl.NumberFormat('en-US', { maximumFractionDigits: digits }).format(value)
const stamp = (value: string) => new Date(value).toLocaleString('en-US', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC' }) + ' UTC'

const electricityPerWatt = computed(() => props.market.kwhPriceUsd * 24 / 1000)
// What one TH is worth at each supported efficiency, straight from GoMining's valuation steps.
const energyBonuses = computed(() => Array.from({ length: maxEfficiency() - props.market.referenceEfficiency + 1 }, (_, index) => {
  const efficiency = props.market.referenceEfficiency + index
  return { efficiency, bonus: energyBonus(efficiency) }
}))

// GoMining's 365-day average payout against today's. Every return on this page is built from today's
// rate, so this says whether today is running hot or cold. normalizeMarket falls back to today's figure
// when the API omits the yearly total, which is the one case where there is nothing to compare against.
const averagePayout = computed(() => {
  const today = props.market.rewardUsdPerThDay
  const average = props.market.averageRewardUsdPerThDay
  if (!average || average === today) {
    return null
  }
  return { average, above: today >= average, deltaPercent: Math.abs((today / average - 1) * 100) }
})

const endpoints = [
  { label: 'Payout, fees and BTC rate', value: 'POST api.gomining.com/api/nft-income-aggregation/get-last' },
  { label: 'Miner prices', value: 'GET api.gomining.com/api/nft-collection/find-all-generative' },
  { label: 'Efficiency upgrade rates', value: 'POST api.gomining.com/api/nft/get-upgrade-rate' },
  { label: 'Bitcoin price', value: 'GET api.coingecko.com/api/v3/simple/price' }
]
// Class groups for the elements the template repeats.
const tileValue = 'mb-2 mt-[7px] block font-display text-[20px] font-[650] tracking-[-.5px] tabular-nums [overflow-wrap:anywhere] to-480:text-[18px]'
const tileText = 'text-[12px] leading-[1.6] text-dim'
const headingClass = 'mb-2.5 text-[12px] font-[550] text-label'
const summaryClass = 'focus-ring flex cursor-pointer list-none items-center gap-2 text-[12px] text-muted hover:text-text [&::-webkit-details-marker]:hidden'
const chevronClass = 'h-[15px] w-[15px] [transition:transform_.2s] group-open:rotate-180 motion-reduce:transition-none'
const thFirst = 'sticky top-0 border-b border-border bg-panel pb-1.5 text-left font-normal text-dim'
const thRest = 'sticky top-0 border-b border-border bg-panel pb-1.5 text-right font-normal text-dim'
const tdFirst = 'border-b border-[#22252f] px-0 py-[5px] text-label'
const tdRest = 'border-b border-[#22252f] px-0 py-[5px] text-right text-muted'
const listClass = 'm-0 flex list-none flex-col gap-[11px] p-0'
const listLabel = 'mb-1 block text-[12px] text-muted'
const listCode = 'block font-[ui-monospace,SFMono-Regular,Menlo,monospace] text-[11px] leading-[1.55] text-[#b9aee0] [overflow-wrap:anywhere]'
</script>
<template>
  <section class="mt-6 rounded-2xl border border-border bg-panel px-[26px] py-[23px] to-800:p-5 to-480:p-[17px]" aria-labelledby="sources-title">
    <div class="flex items-center gap-[13px] to-800:flex-wrap">
      <span class="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-[11px] bg-[#202030] text-[#ada1cc] to-480:hidden"><AppIcon name="info" class="h-5 w-5" /></span>
      <div class="min-w-0 flex-1">
        <h2 id="sources-title" class="text-[14px] font-[550]">
          Where these numbers come from
        </h2>
        <p class="mt-1 text-[12px] text-dim">
          Every input below is read from GoMining, so you can check the maths yourself.
        </p>
      </div>
      <span class="flex shrink-0 items-center gap-1.5 text-[12px] to-800:w-full" :class="live ? 'text-green' : 'text-dim'"><span class="inline-block h-[5px] w-[5px] shrink-0 rounded-[50%]" :class="live ? 'bg-green' : 'bg-[#9d8fc1]'" />{{ live ? 'Live' : 'Snapshot' }} · {{ stamp(market.fetchedAt) }}</span>
    </div>

    <div class="mt-5 grid grid-cols-3 gap-3 to-1100:grid-cols-2 to-480:grid-cols-1">
      <article class="min-w-0 rounded-xl border border-border bg-[#0f111a80] px-[17px] py-[15px]">
        <span class="block text-[12px] text-muted">Daily pool payout</span>
        <strong :class="tileValue">{{ number(market.rewardSatPerThDay) }} <small class="font-sans text-[12px] font-normal tracking-normal text-dim">sat / TH</small></strong>
        <p :class="tileText">
          {{ money(market.rewardUsdPerThDay, 6) }} per TH per day. GoMining payout for {{ stamp(market.incomeDate) }}. {{ rewardLabel }}.
        </p>
      </article>
      <article class="min-w-0 rounded-xl border border-border bg-[#0f111a80] px-[17px] py-[15px]">
        <span class="block text-[12px] text-muted">Bitcoin price</span>
        <strong :class="tileValue">{{ money(btcPrice) }}</strong>
        <p :class="tileText">
          {{ priceLabel }}. GoMining valued its own payout at {{ money(market.btcPriceUsd) }}.
        </p>
      </article>
      <article class="min-w-0 rounded-xl border border-border bg-[#0f111a80] px-[17px] py-[15px]">
        <span class="block text-[12px] text-muted">Electricity</span>
        <strong :class="tileValue">{{ money(market.kwhPriceUsd, 3) }} <small class="font-sans text-[12px] font-normal tracking-normal text-dim">/ kWh</small></strong>
        <p :class="tileText">
          {{ money(electricityPerWatt, 6) }} per TH per W / TH per day. GoMining bills the rate its data centres pay.
        </p>
      </article>
      <article class="min-w-0 rounded-xl border border-border bg-[#0f111a80] px-[17px] py-[15px]">
        <span class="block text-[12px] text-muted">Service fee</span>
        <strong :class="tileValue">{{ money(market.serviceUsdPerThDay, 4) }} <small class="font-sans text-[12px] font-normal tracking-normal text-dim">/ TH / day</small></strong>
        <p :class="tileText">
          Flat equipment service fee, charged on top of electricity.
        </p>
      </article>
      <article class="min-w-0 rounded-xl border border-border bg-[#0f111a80] px-[17px] py-[15px]">
        <span class="block text-[12px] text-muted">Base miner price</span>
        <strong :class="tileValue">{{ money(market.basePriceUsd) }} <small class="font-sans text-[12px] font-normal tracking-normal text-dim">/ 1 TH</small></strong>
        <p :class="tileText">
          GoMining's listed price for 1 TH at {{ market.referenceEfficiency }} W / TH. It publishes full ladders at {{ market.ladders.map(l => l.efficiency).join(' and ') }} W / TH, and every listed size costs exactly what GoMining charges.
        </p>
      </article>
      <article class="min-w-0 rounded-xl border border-border bg-[#0f111a80] px-[17px] py-[15px]">
        <span class="block text-[12px] text-muted">Payout vs 365-day average</span>
        <strong v-if="averagePayout" :class="tileValue">{{ averagePayout.above ? '+' : '−' }}{{ number(averagePayout.deltaPercent, 1) }}<small class="font-sans text-[12px] font-normal tracking-normal text-dim">%</small></strong>
        <strong v-else :class="tileValue">{{ money(market.rewardUsdPerThDay, 6) }} <small class="font-sans text-[12px] font-normal tracking-normal text-dim">/ TH / day</small></strong>
        <p v-if="averagePayout" :class="tileText">
          GoMining paid {{ money(averagePayout.average, 6) }} per TH per day on average over the last 365 days. Every return on this page uses today's rate, which is running {{ averagePayout.above ? 'above' : 'below' }} that.
        </p>
        <p v-else :class="tileText">
          GoMining returned no 365-day total this time, so there is nothing to compare today's payout against.
        </p>
      </article>
    </div>

    <details class="group mt-[18px] border-t border-border pt-[15px]">
      <summary :class="summaryClass">
        <AppIcon name="chevron" :class="chevronClass" />See the full price tables and formulas
      </summary>
      <div class="mt-[18px] grid grid-cols-3 gap-[26px] to-1100:grid-cols-2 to-1100:gap-[22px] to-480:grid-cols-1">
        <div>
          <h3 :class="headingClass">
            {{ market.referenceEfficiency }} W / TH listed ladder
          </h3>
          <div class="max-h-[260px] overflow-y-auto">
            <table class="w-full border-collapse text-[12px] tabular-nums">
              <thead>
                <tr>
                  <th scope="col" :class="thFirst">
                    Power
                  </th>
                  <th scope="col" :class="thRest">
                    Price
                  </th>
                  <th scope="col" :class="thRest">
                    Per TH
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="miner in market.miners" :key="miner.power">
                  <td :class="tdFirst">
                    {{ number(miner.power) }} TH
                  </td>
                  <td :class="tdRest">
                    {{ money(miner.priceUsd) }}
                  </td>
                  <td :class="tdRest">
                    {{ money(miner.priceUsd / miner.power) }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <div>
          <h3 :class="headingClass">
            What a TH is worth by efficiency
          </h3>
          <table class="w-full border-collapse text-[12px] tabular-nums">
            <thead>
              <tr>
                <th scope="col" :class="thFirst">
                  W / TH
                </th>
                <th scope="col" :class="thRest">
                  Value vs {{ market.referenceEfficiency }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in energyBonuses" :key="row.efficiency">
                <td :class="tdFirst">
                  {{ row.efficiency }} W / TH
                </td>
                <td :class="tdRest">
                  {{ row.bonus === 0 ? "base" : money(row.bonus, 3) }}
                </td>
              </tr>
            </tbody>
          </table>
          <h3 :class="[headingClass, 'mt-[22px]']">
            Cost to upgrade one TH
          </h3>
          <table class="w-full border-collapse text-[12px] tabular-nums">
            <thead>
              <tr>
                <th scope="col" :class="thFirst">
                  To
                </th>
                <th scope="col" :class="thRest">
                  Per TH
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="step in market.efficiencyUpgradeSteps" :key="step.toLevel">
                <td :class="tdFirst">
                  {{ step.toLevel }} W / TH
                </td>
                <td :class="tdRest">
                  {{ money(step.priceUsd, 3) }}
                </td>
              </tr>
            </tbody>
          </table>
          <h3 :class="[headingClass, 'mt-[22px]']">
            Endpoints
          </h3>
          <ul :class="listClass">
            <li v-for="endpoint in endpoints" :key="endpoint.value">
              <span :class="listLabel">{{ endpoint.label }}</span><code :class="listCode">{{ endpoint.value }}</code>
            </li>
          </ul>
        </div>
        <div>
          <h3 :class="headingClass">
            How each figure is worked out
          </h3>
          <ul :class="listClass">
            <li><span :class="listLabel">Electricity per day</span><code :class="listCode">{{ money(market.kwhPriceUsd, 3) }} × 24 ÷ 1000 × W/TH × TH × (1 − discount)</code></li>
            <li><span :class="listLabel">Service fee per day</span><code :class="listCode">{{ money(market.serviceUsdPerThDay, 4) }} × TH × (1 − discount)</code></li>
            <li><span :class="listLabel">Mining reward per day</span><code :class="listCode">{{ number(market.rewardSatPerThDay) }} sat × TH ÷ 100,000,000 × BTC price</code></li>
            <li><span :class="listLabel">Net profit per day</span><code :class="listCode">reward − electricity − service</code></li>
            <li><span :class="listLabel">Miner price</span><code :class="listCode">{{ market.ladders.map(l => l.efficiency).join('/') }} W/TH from GoMining's listed ladder; levels between them interpolated; worse levels stepped down by the valuation rate</code></li>
            <li><span :class="listLabel">Annual ROI</span><code :class="listCode">net profit × 365 ÷ investment</code></li>
            <li><span :class="listLabel">Payback</span><code :class="listCode">investment ÷ net profit</code></li>
            <li><span :class="listLabel">Efficiency upgrade</span><code :class="listCode">sum of the per-TH upgrade rates for every W/TH crossed × TH</code></li>
          </ul>
        </div>
      </div>
    </details>
  </section>
</template>
