<script setup lang="ts">
import { marketSnapshot } from '~/data/gomining'

const { market, status: marketStatus, pending: marketPending, refresh: refreshMarket } = useMarketData()
const btcPrice = ref<number | string>(Math.round(marketSnapshot.btcPriceUsd))
const reward = ref<number | string>(marketSnapshot.rewardSatPerThDay)
const activeTab = ref<'investment' | 'nft'>('investment')
const priceStatus = ref<'loading' | 'live' | 'gomining' | 'cached' | 'sample' | 'custom'>('loading')
const rewardStatus = ref<'loading' | 'live' | 'snapshot' | 'custom'>('loading')
const fetchingPrice = ref(false)
let priceEdited = false
let rewardEdited = false
let priceRequest: AbortController | undefined

const formatDate = (value: string) => new Date(value).toLocaleDateString('en-US', { day: 'numeric', month: 'short', timeZone: 'UTC' })
const formatFee = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(value)

const priceLabel = computed(() => ({
  loading: 'Sample price · connecting',
  live: 'Live price from CoinGecko',
  gomining: `GoMining payout rate · ${formatDate(market.value.incomeDate)}`,
  cached: 'Last fetched price · refresh unavailable',
  sample: 'Sample price · live price unavailable',
  custom: 'Your custom price'
}[priceStatus.value]))

const rewardLabel = computed(() => ({
  loading: 'Latest payout · connecting to GoMining',
  live: `GoMining pool payout · ${formatDate(market.value.incomeDate)}`,
  snapshot: `Payout snapshot from ${formatDate(market.value.incomeDate)} · live data unavailable`,
  custom: 'Your custom reward'
}[rewardStatus.value]))

const marketLabel = computed(() => ({
  loading: 'Connecting to GoMining for prices and fees',
  live: 'Prices and fees live from GoMining',
  snapshot: `Prices and fees from a GoMining snapshot · ${formatDate(market.value.fetchedAt)}`
}[marketStatus.value]))

function useGoMiningRate () {
  if (priceEdited || !['loading', 'sample'].includes(priceStatus.value) || marketStatus.value !== 'live') { return }
  btcPrice.value = Math.round(market.value.btcPriceUsd * 100) / 100
  priceStatus.value = 'gomining'
}

async function getCurrentBTCPrice () {
  if (fetchingPrice.value) { return }
  fetchingPrice.value = true
  priceEdited = false
  priceRequest = new AbortController()
  const timeout = setTimeout(() => priceRequest?.abort(), 8000)
  try {
    const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd', { signal: priceRequest.signal })
    if (!response.ok) { throw new Error('Price unavailable') }
    const data = await response.json()
    if (!Number.isFinite(data.bitcoin?.usd) || data.bitcoin.usd <= 0) { throw new Error('Invalid price') }
    if (!priceEdited) {
      btcPrice.value = data.bitcoin.usd
      priceStatus.value = 'live'
    }
  } catch {
    if (!priceEdited && priceStatus.value !== 'custom') {
      priceStatus.value = ['live', 'cached'].includes(priceStatus.value) ? 'cached' : priceStatus.value === 'gomining' ? 'gomining' : 'sample'
      useGoMiningRate()
    }
  } finally {
    clearTimeout(timeout)
    fetchingPrice.value = false
  }
}

async function loadMarket () {
  await refreshMarket()
  if (!rewardEdited) {
    reward.value = market.value.rewardSatPerThDay
    rewardStatus.value = marketStatus.value === 'live' ? 'live' : 'snapshot'
  }
  useGoMiningRate()
}

function refreshAll () {
  rewardEdited = false
  return Promise.all([getCurrentBTCPrice(), loadMarket()])
}

function updatePrice () {
  priceEdited = true
  priceStatus.value = 'custom'
}

function updateReward () {
  rewardEdited = true
  rewardStatus.value = 'custom'
}

function switchTab (event: KeyboardEvent) {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) { return }
  event.preventDefault()
  activeTab.value = event.key === 'Home' ? 'investment' : event.key === 'End' ? 'nft' : activeTab.value === 'investment' ? 'nft' : 'investment'
  nextTick(() => document.getElementById(`${activeTab.value}-tab`)?.focus())
}

onMounted(refreshAll)
onBeforeUnmount(() => priceRequest?.abort())
</script>
<template>
  <div class="calculator-page">
    <section class="page-intro" aria-labelledby="page-title">
      <div>
        <div class="eyebrow">
          <span /> LESS GUESSWORK. MORE PERSPECTIVE.
        </div>
        <h1 id="page-title">
          Your mining. <span>Your numbers.</span>
        </h1>
        <p>Find the potential in your next investment.</p>
      </div>
      <div class="intro-mark">
        <GoMiningMark role="img" aria-label="GoMining" />
      </div>
    </section>

    <section class="market-panel" aria-label="Market assumptions">
      <div class="market-heading">
        <span class="small-icon"><AppIcon name="settings" /></span>
        <div>
          <h2>Market assumptions</h2>
          <p id="market-edit-hint">
            Edit values for both calculators
          </p>
          <p class="market-meta">
            <span class="status-dot" :class="{ 'is-live': marketStatus === 'live' }" />{{ marketLabel }}
          </p>
          <p class="market-meta">
            Electricity <strong>{{ formatFee(market.kwhPriceUsd) }}</strong> / kWh · Service <strong>{{ formatFee(market.serviceUsdPerThDay) }}</strong> / TH / day
          </p>
        </div>
      </div>
      <div class="market-field">
        <span class="currency-icon">₿</span>
        <div class="market-field-content">
          <label for="btc-price">Bitcoin price <span>USD</span></label>
          <div class="market-input-line">
            <span aria-hidden="true">$</span><input
              id="btc-price"
              v-model.number="btcPrice"
              type="number"
              min="0.01"
              max="10000000"
              step="any"
              inputmode="decimal"
              aria-describedby="market-edit-hint btc-price-status"
              @input="updatePrice"
            >
          </div>
          <span id="btc-price-status" class="price-status" :class="{ 'is-live': priceStatus === 'live' }"><span v-if="priceStatus === 'live'" class="status-dot" />{{ priceLabel }}</span>
        </div>
        <button class="icon-button" type="button" aria-label="Refresh Bitcoin price and GoMining data" :disabled="fetchingPrice || marketPending" @click="refreshAll">
          <AppIcon name="refresh" :class="{ spinning: fetchingPrice || marketPending }" />
        </button>
      </div>
      <div class="market-field reward-field">
        <span class="reward-icon"><AppIcon name="bolt" /></span>
        <div class="market-field-content">
          <label for="satoshi-reward">Daily mining reward <span>sat / TH</span></label>
          <input
            id="satoshi-reward"
            v-model.number="reward"
            type="number"
            min="0"
            max="1000000"
            step="any"
            inputmode="decimal"
            aria-describedby="market-edit-hint satoshi-reward-hint"
            @input="updateReward"
          >
          <span id="satoshi-reward-hint" class="price-status" :class="{ 'is-live': rewardStatus === 'live' }"><span v-if="rewardStatus === 'live'" class="status-dot" />{{ rewardLabel }}</span>
        </div>
      </div>
    </section>

    <div class="calculator-tabs" role="tablist" aria-label="Calculator type" @keydown="switchTab">
      <button
        id="investment-tab"
        type="button"
        role="tab"
        :aria-selected="activeTab === 'investment'"
        aria-controls="investment-panel"
        :tabindex="activeTab === 'investment' ? 0 : -1"
        :class="{ active: activeTab === 'investment' }"
        @click="activeTab = 'investment'"
      >
        <AppIcon name="chart" />Investment calculator
      </button>
      <button
        id="nft-tab"
        type="button"
        role="tab"
        :aria-selected="activeTab === 'nft'"
        aria-controls="nft-panel"
        :tabindex="activeTab === 'nft' ? 0 : -1"
        :class="{ active: activeTab === 'nft' }"
        @click="activeTab = 'nft'"
      >
        <AppIcon name="chip" />NFT calculator
      </button>
    </div>
    <div v-show="activeTab === 'investment'" id="investment-panel" role="tabpanel" aria-labelledby="investment-tab">
      <InvestmentCalculatorForm :btc-price="Number(btcPrice)" :reward="reward === '' ? NaN : Number(reward)" :market="market" />
    </div>
    <div v-show="activeTab === 'nft'" id="nft-panel" role="tabpanel" aria-labelledby="nft-tab">
      <NFTCalculatorForm :btc-price="Number(btcPrice)" :reward="reward === '' ? NaN : Number(reward)" :market="market" />
    </div>

    <PayoutHistory />

    <CalculationSources
      :market="market"
      :btc-price="Number(btcPrice)"
      :price-label="priceLabel"
      :reward-label="rewardLabel"
      :live="marketStatus === 'live'"
    />

    <div class="estimate-note">
      <AppIcon name="info" /><p>A little perspective: these are estimates, not guarantees. Returns assume a constant BTC price and mining reward, without reinvestment. Network conditions, fees, and GoMining's prices may change.</p>
    </div>
  </div>
</template>
