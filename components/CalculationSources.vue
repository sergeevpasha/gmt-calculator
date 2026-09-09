<script setup lang="ts">
import type { MarketData } from '~/data/gomining'

const props = defineProps<{ market: MarketData, btcPrice: number, priceLabel: string, rewardLabel: string, live: boolean }>()

const money = (value: number, digits = 2) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value)
const number = (value: number, digits = 2) => new Intl.NumberFormat('en-US', { maximumFractionDigits: digits }).format(value)
const stamp = (value: string) => new Date(value).toLocaleString('en-US', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC' }) + ' UTC'

const electricityPerWatt = computed(() => props.market.kwhPriceUsd * 24 / 1000)
const ladder = computed(() => [...props.market.miners].sort((a, b) => a.power - b.power))
// Bulk sizes cost less per TH, so quote the range rather than a single headline price.
const perTerahash = computed(() => {
  const prices = ladder.value.map(miner => miner.priceUsd / miner.power)
  return { high: Math.max(...prices), low: Math.min(...prices) }
})

// Collapse consecutive levels that share a price, the way GoMining bands its upgrade rates.
const upgradeBands = computed(() => {
  const levels = Object.keys(props.market.efficiencyUpgradePrices).map(Number).sort((a, b) => a - b)
  const bands: { from: number, to: number, priceUsd: number }[] = []
  for (const level of levels) {
    const price = props.market.efficiencyUpgradePrices[level]
    const last = bands[bands.length - 1]
    if (last && last.priceUsd === price && last.to === level - 1) {
      last.to = level
    } else {
      bands.push({ from: level, to: level, priceUsd: price })
    }
  }
  return bands
})

const endpoints = [
  { label: 'Payout, fees and BTC rate', value: 'POST api.gomining.com/api/nft-income-aggregation/get-last' },
  { label: 'Miner prices', value: 'GET api.gomining.com/api/nft-collection/find-all-generative' },
  { label: 'Efficiency upgrade rates', value: 'POST api.gomining.com/api/nft/get-upgrade-rate' },
  { label: 'Bitcoin price', value: 'GET api.coingecko.com/api/v3/simple/price' }
]
</script>
<template>
  <section class="sources-panel" aria-labelledby="sources-title">
    <div class="sources-heading">
      <span class="small-icon"><AppIcon name="info" /></span>
      <div>
        <h2 id="sources-title">
          Where these numbers come from
        </h2>
        <p>
          Every input below is read from GoMining, so you can check the maths yourself.
        </p>
      </div>
      <span class="sources-stamp" :class="{ 'is-live': live }"><span class="status-dot" />{{ live ? 'Live' : 'Snapshot' }} · {{ stamp(market.fetchedAt) }}</span>
    </div>

    <div class="source-grid">
      <article>
        <span>Daily pool payout</span>
        <strong>{{ number(market.rewardSatPerThDay) }} <small>sat / TH</small></strong>
        <p>{{ money(market.rewardUsdPerThDay, 6) }} per TH per day. GoMining payout for {{ stamp(market.incomeDate) }}. {{ rewardLabel }}.</p>
      </article>
      <article>
        <span>Bitcoin price</span>
        <strong>{{ money(btcPrice) }}</strong>
        <p>{{ priceLabel }}. GoMining valued its own payout at {{ money(market.btcPriceUsd) }}.</p>
      </article>
      <article>
        <span>Electricity</span>
        <strong>{{ money(market.kwhPriceUsd, 3) }} <small>/ kWh</small></strong>
        <p>{{ money(electricityPerWatt, 6) }} per TH per W / TH per day. GoMining bills the rate its data centres pay.</p>
      </article>
      <article>
        <span>Service fee</span>
        <strong>{{ money(market.serviceUsdPerThDay, 4) }} <small>/ TH / day</small></strong>
        <p>Flat equipment service fee, charged on top of electricity.</p>
      </article>
      <article>
        <span>Miner price</span>
        <strong>{{ money(perTerahash.low) }} – {{ money(perTerahash.high) }} <small>/ TH</small></strong>
        <p>GoMining sells {{ market.referenceEfficiency }} W / TH miners from {{ ladder[0].power }} to {{ number(ladder[ladder.length - 1].power) }} TH; larger ones cost less per TH. Sizes in between are interpolated.</p>
      </article>
      <article>
        <span>Efficiency upgrades</span>
        <strong>{{ money(upgradeBands[0].priceUsd, 3) }} <small>/ TH / step</small></strong>
        <p>Cost of improving one W / TH. Other efficiencies are priced from the {{ market.referenceEfficiency }} W / TH miner minus these steps.</p>
      </article>
    </div>

    <details class="sources-detail">
      <summary>
        <AppIcon name="chevron" />See the full price tables and formulas
      </summary>
      <div class="detail-columns">
        <div>
          <h3>{{ market.referenceEfficiency }} W / TH price ladder</h3>
          <div class="table-scroll">
            <table>
              <thead>
                <tr>
                  <th scope="col">
                    Power
                  </th>
                  <th scope="col">
                    Price
                  </th>
                  <th scope="col">
                    Per TH
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="miner in ladder" :key="miner.power">
                  <td>{{ number(miner.power) }} TH</td>
                  <td>{{ money(miner.priceUsd) }}</td>
                  <td>{{ money(miner.priceUsd / miner.power) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <div>
          <h3>Efficiency upgrade rates</h3>
          <table>
            <thead>
              <tr>
                <th scope="col">
                  To level
                </th>
                <th scope="col">
                  Price per TH
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="band in upgradeBands" :key="band.from">
                <td>{{ band.from === band.to ? `${band.from}` : `${band.from} – ${band.to}` }} W / TH</td>
                <td>{{ money(band.priceUsd, 3) }}</td>
              </tr>
            </tbody>
          </table>
          <h3 class="spaced">
            Endpoints
          </h3>
          <ul class="endpoint-list">
            <li v-for="endpoint in endpoints" :key="endpoint.value">
              <span>{{ endpoint.label }}</span><code>{{ endpoint.value }}</code>
            </li>
          </ul>
        </div>
        <div>
          <h3>How each figure is worked out</h3>
          <ul class="formula-list">
            <li><span>Electricity per day</span><code>{{ money(market.kwhPriceUsd, 3) }} × 24 ÷ 1000 × W/TH × TH × (1 − discount)</code></li>
            <li><span>Service fee per day</span><code>{{ money(market.serviceUsdPerThDay, 4) }} × TH × (1 − discount)</code></li>
            <li><span>Mining reward per day</span><code>{{ number(market.rewardSatPerThDay) }} sat × TH ÷ 100,000,000 × BTC price</code></li>
            <li><span>Net profit per day</span><code>reward − electricity − service</code></li>
            <li><span>Miner value</span><code>{{ market.referenceEfficiency }} W/TH price − upgrade cost back to {{ market.referenceEfficiency }} W/TH</code></li>
            <li><span>Annual ROI</span><code>net profit × 365 ÷ investment</code></li>
            <li><span>Payback</span><code>investment ÷ net profit</code></li>
          </ul>
        </div>
      </div>
    </details>
  </section>
</template>
<style scoped>
.sources-panel { margin-top: 24px; border: 1px solid var(--border); border-radius: 16px; background: var(--panel); padding: 23px 26px; }
.sources-heading { display: flex; align-items: center; gap: 13px; }
.sources-heading h2 { font-size: 14px; font-weight: 550; }
.sources-heading > div:nth-child(2) { flex: 1; min-width: 0; }
.sources-heading p { color: var(--dim); font-size: 12px; margin-top: 4px; }
.sources-stamp { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--dim); flex-shrink: 0; }
.sources-stamp .status-dot { width: 5px; height: 5px; background: #9d8fc1; }
.sources-stamp.is-live { color: var(--green); }
.sources-stamp.is-live .status-dot { background: var(--green); }
.source-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin-top: 20px; }
.source-grid article { border: 1px solid var(--border); border-radius: 12px; background: #0f111a80; padding: 15px 17px; min-width: 0; }
.source-grid span { display: block; font-size: 12px; color: var(--muted); }
.source-grid strong { display: block; margin: 7px 0 8px; font-family: 'Manrope', sans-serif; font-size: 20px; font-weight: 650; letter-spacing: -.5px; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.source-grid small { font-family: 'DM Sans', sans-serif; font-size: 12px; font-weight: 400; color: var(--dim); letter-spacing: 0; }
.source-grid p { font-size: 12px; color: var(--dim); line-height: 1.6; }
.sources-detail { margin-top: 18px; border-top: 1px solid var(--border); padding-top: 15px; }
.sources-detail summary { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--muted); cursor: pointer; list-style: none; }
.sources-detail summary::-webkit-details-marker { display: none; }
.sources-detail summary:hover { color: var(--text); }
.sources-detail summary svg { width: 15px; height: 15px; transition: transform .2s; }
.sources-detail[open] summary svg { transform: rotate(180deg); }
.detail-columns { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 26px; margin-top: 18px; }
.detail-columns h3 { font-size: 12px; font-weight: 550; color: #cccadb; margin-bottom: 10px; }
.detail-columns h3.spaced { margin-top: 22px; }
.table-scroll { max-height: 260px; overflow-y: auto; }
table { width: 100%; border-collapse: collapse; font-size: 12px; font-variant-numeric: tabular-nums; }
th { text-align: left; font-weight: 400; color: var(--dim); padding-bottom: 6px; border-bottom: 1px solid var(--border); position: sticky; top: 0; background: var(--panel); }
td { padding: 5px 0; color: var(--muted); border-bottom: 1px solid #22252f; }
td:first-child { color: #cccadb; }
td + td, th + th { text-align: right; }
.endpoint-list, .formula-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 11px; }
.endpoint-list span, .formula-list span { display: block; font-size: 12px; color: var(--muted); margin-bottom: 4px; }
.endpoint-list code, .formula-list code { display: block; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; line-height: 1.55; color: #b9aee0; overflow-wrap: anywhere; }
@media (max-width: 1100px) {
  .source-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .detail-columns { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 22px; }
}
@media (max-width: 800px) {
  .sources-panel { padding: 20px; }
  .sources-heading { flex-wrap: wrap; }
  .sources-stamp { width: 100%; }
}
@media (max-width: 480px) {
  .sources-panel { padding: 17px; }
  .sources-heading .small-icon { display: none; }
  .source-grid, .detail-columns { grid-template-columns: minmax(0, 1fr); }
  .source-grid strong { font-size: 18px; }
}
</style>
