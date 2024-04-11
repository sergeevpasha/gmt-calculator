<script setup lang="ts">
import BaseInput from '~/components/forms/BaseInput.vue'

const btcPrice = ref(0)
const reward = ref(160)

interface CoingeckoResponse {
  bitcoin: {
    usd: number
  }
}

function getCurrentBTCPrice () {
  fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd')
    .then(response => response.json())
    .then((data: CoingeckoResponse) => {
      btcPrice.value = data.bitcoin.usd
    })
}

onMounted(() => {
  getCurrentBTCPrice()
})
</script>
<template>
  <div class="flex flex-col gap-3 mt-3 items-center justify-center">
    <div class="w-full p-4 text-center bg-gray-100 rounded-lg shadow sm:p-8 dark:bg-gray-800 dark:border-gray-700">
      <h5 class="mb-2 text-3xl font-bold text-gray-900 dark:text-white">
        Global values
      </h5>
      <p class="mb-5 text-base text-gray-500 sm:text-lg dark:text-gray-400">
        Set current BTC price and reward per 1 TH. This settings will affect both calculator forms.
      </p>
      <div class="grid md:grid-cols-4 gap-3 items-stretch mt-10 m-auto">
        <BaseInput v-model="btcPrice" type="number" placeholder="0.00" label="BTC Price" />
        <BaseInput v-model="reward" type="number" placeholder="0.00" label="Satoshi reward per 1 TH" />
        <div class="flex flex-col justify-end align-bottom">
          <BaseButton label="Halving" @click="reward = reward / 2" />
        </div>
      </div>
    </div>
    <InvestmentCalculatorForm :btc-price="btcPrice" :reward="reward" />
    <NFTCalculatorForm :btc-price="btcPrice" :reward="reward" />
  </div>
</template>
