<script setup lang="ts">
import { marketSnapshot } from '~/data/gomining'
import { isRecord } from '~/utils/isRecord'

const { market, status: marketStatus, pending: marketPending, refresh: refreshMarket } = useMarketData()
// v-model on a number input yields a number, or '' while the field is empty.
const btcPrice = ref<number | ''>(Math.round(marketSnapshot.btcPriceUsd))
const reward = ref<number | ''>(marketSnapshot.rewardSatPerThDay)
const activeTab = ref<'investment' | 'nft'>('investment')
// The selected tab's colour and the underline drawn beneath it.
const activeTabClass = 'text-[#b599ff] after:absolute after:inset-x-0 after:-bottom-px after:h-[2px] after:bg-purple'
const priceStatus = ref<'loading' | 'live' | 'gomining' | 'cached' | 'sample' | 'custom'>('loading')
const rewardStatus = ref<'loading' | 'live' | 'snapshot' | 'custom'>('loading')
const fetchingPrice = ref(false)
let priceEdited = false
let rewardEdited = false
let priceRequest: AbortController | undefined

const formatDate = (value: string) => new Date(value).toLocaleDateString('en-US', { day: 'numeric', month: 'short', timeZone: 'UTC' })
const formatFee = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(value)

const priceLabel = computed(() => ({
  loading: 'Saved GoMining rate · loading',
  live: 'Live price from CoinGecko',
  gomining: `GoMining payout rate · ${formatDate(market.value.incomeDate)}`,
  cached: 'Last fetched price · refresh unavailable',
  sample: 'Saved GoMining rate · live price unavailable',
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
    const data: unknown = await response.json()
    const usd = isRecord(data) && isRecord(data.bitcoin) ? data.bitcoin.usd : undefined
    if (typeof usd !== 'number' || usd <= 0) { throw new Error('Invalid price') }
    if (!priceEdited) {
      btcPrice.value = usd
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
  <div class="pb-[34px] pt-[43px] from-1600:pt-[60px] to-800:pt-[30px]">
    <section class="mb-8 flex items-center justify-between from-1600:mb-10 to-480:mb-[25px]" aria-labelledby="page-title">
      <div>
        <h1 id="page-title" class="font-display text-[length:clamp(28px,3vw,39px)] font-[650] leading-[1.25] tracking-[-1.5px] to-480:text-[28px] to-480:tracking-[-1.2px]">
          GoMining <span class="text-purple">profit calculator</span>
        </h1>
        <p class="mt-[11px] text-[16px] text-muted">
          Estimate daily profit, ROI and payback for a GoMining miner from today's payout, fees and prices.
        </p>
      </div>
      <div class="grid h-[67px] w-[67px] place-items-center rounded-[20px] border border-[#9b76f030] bg-[linear-gradient(140deg,#9b76f016,#9b76f002)] to-800:hidden">
        <GoMiningMark class="h-[38px] w-[38px]" role="img" aria-label="GoMining" />
      </div>
    </section>

    <section class="grid grid-cols-[.95fr_1.2fr_1fr] gap-6 rounded-2xl border border-border bg-panel px-[26px] py-[23px] to-1100:grid-cols-[.85fr_1.2fr_1fr] to-1100:gap-4 to-1100:p-5 to-800:grid-cols-[1fr_1fr] to-800:gap-[18px] to-600:grid-cols-[1fr] to-480:gap-4 to-480:p-[17px]" aria-label="Market assumptions">
      <div class="flex items-center gap-[13px] to-800:col-span-full to-800:border-b to-800:border-border to-800:pb-4">
        <span class="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-[11px] bg-[#202030] text-[#ada1cc] to-1100:hidden to-800:grid"><AppIcon name="settings" class="h-5 w-5" /></span>
        <div>
          <h2 class="text-[14px] font-[550]">
            Market assumptions
          </h2>
          <p id="market-edit-hint" class="mt-1 text-[12px] text-dim">
            Edit values for both calculators
          </p>
          <p class="mt-1 flex flex-wrap items-center gap-1.5 text-[12px] leading-[1.5] text-dim">
            <span class="inline-block h-[5px] w-[5px] shrink-0 rounded-[50%]" :class="marketStatus === 'live' ? 'bg-green' : 'bg-[#9d8fc1]'" />{{ marketLabel }}
          </p>
          <p class="mt-1 flex flex-wrap items-center gap-1.5 text-[12px] leading-[1.5] text-dim">
            Electricity <strong class="font-medium text-label">{{ formatFee(market.kwhPriceUsd) }}</strong> / kWh · Service <strong class="font-medium text-label">{{ formatFee(market.serviceUsdPerThDay) }}</strong> / TH / day
          </p>
        </div>
      </div>
      <div class="flex min-w-0 items-center gap-[13px] border-l border-border pl-[27px] to-1100:gap-[9px] to-1100:pl-[18px] to-800:border-0 to-800:pl-0 to-480:items-start to-480:gap-2">
        <span class="grid h-9 w-9 shrink-0 place-items-center rounded-[50%] bg-[#33271c] text-[22px] text-[#efb577] to-600:self-center">₿</span>
        <div class="min-w-0 flex-1">
          <label for="btc-price" class="mb-2 flex items-baseline gap-2 text-[14px] text-label to-1100:block">Bitcoin price <span class="text-[12px] text-dim to-1100:ml-1 to-600:inline to-600:ml-[5px]">USD</span></label>
          <div class="relative text-[21px] font-[550]">
            <span aria-hidden="true" class="pointer-events-none absolute left-[13px] top-1/2 -translate-y-1/2 text-[#b3afc5]">$</span><input
              id="btc-price"
              v-model.number="btcPrice"
              class="no-spinner block h-[49px] w-full min-w-0 cursor-text text-ellipsis rounded-[9px] border border-[#68617c] bg-[#0f111a] pl-[31px] pr-[13px] text-[21px] font-[550] leading-[1.5] text-text tabular-nums [transition:border-color_.2s,box-shadow_.2s] hover:border-[#a18cbf] focus:border-purple focus:outline focus:outline-[3px] focus:outline-offset-0 focus:outline-[#9674f52b] motion-reduce:transition-none"
              type="number"
              min="0.01"
              max="10000000"
              step="any"
              inputmode="decimal"
              aria-describedby="market-edit-hint btc-price-status"
              @input="updatePrice"
            >
          </div>
          <span id="btc-price-status" class="mt-[7px] flex items-center gap-[5px] text-[12px] leading-[1.5]" :class="priceStatus === 'live' ? 'text-green' : 'text-dim'"><span v-if="priceStatus === 'live'" class="inline-block h-1 w-1 shrink-0 rounded-[50%] bg-green" />{{ priceLabel }}</span>
        </div>
        <button class="transition-control focus-ring grid h-8 w-8 place-items-center rounded-lg border border-border bg-transparent text-muted hover:bg-[#28243b] hover:text-purple disabled:cursor-wait disabled:opacity-[.55] to-600:h-9 to-600:w-9 to-600:shrink-0 to-600:self-center" type="button" aria-label="Refresh Bitcoin price and GoMining data" :disabled="fetchingPrice || marketPending" @click="refreshAll">
          <AppIcon name="refresh" class="h-[15px] w-[15px] shrink-0" :class="{ 'animate-spin-slow motion-reduce:animate-none': fetchingPrice || marketPending }" />
        </button>
      </div>
      <div class="flex min-w-0 items-center gap-[13px] border-l border-border pl-[27px] to-1100:gap-[9px] to-1100:pl-[18px] to-600:border-l-0 to-600:border-t to-600:pb-0 to-600:pl-0 to-600:pr-0 to-600:pt-4 to-480:items-start to-480:gap-2">
        <span class="grid h-9 w-9 shrink-0 place-items-center rounded-[50%] bg-[#27213e] text-[22px] text-[#b599ff] to-600:self-center"><AppIcon name="bolt" class="h-[18px] w-[18px]" /></span>
        <div class="min-w-0 flex-1">
          <label for="satoshi-reward" class="mb-2 flex items-baseline gap-2 text-[14px] text-label to-1100:block">Daily mining reward <span class="text-[12px] text-dim to-1100:ml-1 to-600:inline to-600:ml-[5px]">sat / TH</span></label>
          <input
            id="satoshi-reward"
            v-model.number="reward"
            class="no-spinner block h-[49px] w-full min-w-0 cursor-text text-ellipsis rounded-[9px] border border-[#68617c] bg-[#0f111a] px-[13px] text-[21px] font-[550] leading-[1.5] text-text tabular-nums [transition:border-color_.2s,box-shadow_.2s] hover:border-[#a18cbf] focus:border-purple focus:outline focus:outline-[3px] focus:outline-offset-0 focus:outline-[#9674f52b] motion-reduce:transition-none"
            type="number"
            min="0"
            max="1000000"
            step="any"
            inputmode="decimal"
            aria-describedby="market-edit-hint satoshi-reward-hint"
            @input="updateReward"
          >
          <span id="satoshi-reward-hint" class="mt-[7px] flex items-center gap-[5px] text-[12px] leading-[1.5]" :class="rewardStatus === 'live' ? 'text-green' : 'text-dim'"><span v-if="rewardStatus === 'live'" class="inline-block h-1 w-1 shrink-0 rounded-[50%] bg-green" />{{ rewardLabel }}</span>
        </div>
      </div>
    </section>

    <div class="my-6 flex gap-[31px] border-b border-border to-480:mt-[19px] to-480:gap-[18px] to-360:gap-[14px]" role="tablist" aria-label="Calculator type" @keydown="switchTab">
      <button
        id="investment-tab"
        class="transition-control focus-ring relative flex items-center gap-[9px] border-0 bg-transparent pb-[19px] pt-[13px] text-[14px] hover:text-text to-480:gap-[7px] to-360:text-[12px]"
        :class="activeTab === 'investment' ? activeTabClass : 'text-muted'"
        type="button"
        role="tab"
        :aria-selected="activeTab === 'investment'"
        aria-controls="investment-panel"
        :tabindex="activeTab === 'investment' ? 0 : -1"
        @click="activeTab = 'investment'"
      >
        <AppIcon name="chart" class="h-[17px] w-[17px] shrink-0 to-480:h-[15px] to-480:w-[15px]" />Investment calculator
      </button>
      <button
        id="nft-tab"
        class="transition-control focus-ring relative flex items-center gap-[9px] border-0 bg-transparent pb-[19px] pt-[13px] text-[14px] hover:text-text to-480:gap-[7px] to-360:text-[12px]"
        :class="activeTab === 'nft' ? activeTabClass : 'text-muted'"
        type="button"
        role="tab"
        :aria-selected="activeTab === 'nft'"
        aria-controls="nft-panel"
        :tabindex="activeTab === 'nft' ? 0 : -1"
        @click="activeTab = 'nft'"
      >
        <AppIcon name="chip" class="h-[17px] w-[17px] shrink-0 to-480:h-[15px] to-480:w-[15px]" />NFT calculator
      </button>
    </div>
    <div v-show="activeTab === 'investment'" id="investment-panel" role="tabpanel" aria-labelledby="investment-tab">
      <InvestmentCalculatorForm :btc-price="Number(btcPrice)" :reward="reward === '' ? null : reward" :market="market" />
    </div>
    <div v-show="activeTab === 'nft'" id="nft-panel" role="tabpanel" aria-labelledby="nft-tab">
      <NFTCalculatorForm :btc-price="Number(btcPrice)" :reward="reward === '' ? null : reward" :market="market" />
    </div>

    <PayoutHistory />

    <CalculationSources
      :market="market"
      :btc-price="Number(btcPrice)"
      :price-label="priceLabel"
      :live="marketStatus === 'live'"
    />

    <div class="mt-6 flex items-start gap-2.5 rounded-[10px] border border-[#242733] bg-[#13162080] px-[18px] py-[15px] to-480:p-[13px]">
      <AppIcon name="info" class="mt-0.5 h-[17px] w-[17px] shrink-0 text-dim" /><p class="text-[12px] leading-[1.7] text-dim">
        These are estimates. They assume today's Bitcoin price and mining reward stay the same and that nothing is reinvested. Network difficulty, fees and GoMining's prices all change over time.
      </p>
    </div>
  </div>
</template>
