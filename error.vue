<script setup lang="ts">
import type { NuxtError } from '#app'

const props = defineProps<{ error: NuxtError }>()
const isNotFound = computed(() => props.error.statusCode === 404)

useHead(() => ({
  title: `${isNotFound.value ? 'Page not found' : 'Something went wrong'} · GMT Calculator`,
  meta: [{ name: 'robots', content: 'noindex, nofollow' }]
}))

const titleClass = 'font-display text-[length:clamp(28px,3.3vw,42px)] font-[650] leading-[1.25] tracking-[-1.5px] to-480:tracking-[-1.2px]'

function returnToCalculator () {
  return clearError({ redirect: '/' })
}
</script>

<template>
  <div class="flex min-h-svh flex-col bg-[radial-gradient(ellipse_at_85%_10%,#5c38860b,transparent_45%)]">
    <a class="transition-control focus-ring fixed -top-[60px] left-4 z-20 rounded-lg bg-[#7953c6] px-4 py-2.5 text-white focus:top-3" href="#error-content">Skip to error details</a>
    <AppHeader />

    <main id="error-content" class="mx-auto flex w-[min(1240px,calc(100%_-_96px))] flex-1 items-center justify-center py-16 to-1100:w-[calc(100%_-_56px)] to-800:w-[calc(100%_-_40px)] to-700:py-8 to-480:w-[calc(100%_-_32px)]">
      <section class="grid w-full max-w-[1020px] grid-cols-[1fr_1.15fr] items-center gap-16 rounded-3xl border border-border bg-panel bg-[image:radial-gradient(ellipse_at_15%_50%,#7950ad12,transparent_60%),none] p-16 to-1000:gap-8 to-1000:p-10 to-700:max-w-[480px] to-700:grid-cols-[1fr] to-700:gap-8 to-700:rounded-[18px] to-700:px-6 to-700:py-8 to-700:text-center" aria-labelledby="error-title">
        <div class="flex min-h-[300px] min-w-0 flex-col items-center justify-center gap-5 rounded-2xl bg-[linear-gradient(#a68aff09_1px,transparent_1px),linear-gradient(90deg,#a68aff09_1px,transparent_1px)] bg-[length:28px_28px] to-700:min-h-[180px] to-700:gap-4" aria-hidden="true">
          <span class="font-display text-[length:clamp(96px,12vw,164px)] font-[750] leading-none tracking-[-.08em] text-[#b49af3] [text-shadow:0_12px_64px_#a68aff1f] to-700:text-[112px]">{{ error.statusCode }}</span>
          <div class="flex max-w-full items-center gap-2 rounded-[7px] border border-[#51405f] bg-[#221d30] px-3 py-2 text-center text-[12px] tracking-[1px] text-[#c7b4e8]">
            <span class="inline-block h-1.5 w-1.5 shrink-0 rounded-[50%] bg-purple" />
            {{ isNotFound ? 'PAGE NOT FOUND' : 'ERROR' }}
          </div>
        </div>

        <div class="min-w-0">
          <h1 v-if="isNotFound" id="error-title" :class="titleClass">
            Nothing at<br><span class="text-purple">this address</span>
          </h1>
          <h1 v-else id="error-title" :class="titleClass">
            Something<br><span class="text-purple">went wrong</span>
          </h1>
          <p class="mt-5 max-w-[360px] text-[16px] leading-[1.75] text-muted to-700:mx-auto">
            {{ isNotFound
              ? 'The link may be old or mistyped. The calculator is on the home page.'
              : 'The page failed to load. Try again, or go back to the calculator.' }}
          </p>
          <a href="/" class="transition-control focus-ring mt-7 flex min-h-[49px] w-fit max-w-full items-center justify-center gap-4 rounded-[9px] border border-[#ae83ff66] bg-[#8354db] px-[17px] py-3 text-[14px] font-semibold text-white no-underline [box-shadow:0_4px_20px_#7f4ddd20] hover:bg-[#895add] hover:[box-shadow:0_4px_25px_#8f60f039] active:translate-y-px to-700:mx-auto" @click.prevent="returnToCalculator">
            <AppIcon name="chart" class="h-[17px] w-[17px] shrink-0" />
            <span class="mr-auto">Back to calculator</span>
            <AppIcon name="arrow" class="ml-auto h-[17px] w-[17px] shrink-0" />
          </a>
        </div>
      </section>
    </main>

    <AppFooter />
  </div>
</template>
