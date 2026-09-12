<script setup lang="ts">
import { SITE_URL } from '~/data/site'

// One address per page. The .vercel.app alias, a trailing slash and any tracking query all render the
// same page, and this is what tells search engines which of those spellings is the real one.
const route = useRoute()
const canonical = computed(() => `${SITE_URL}${route.path === '/' ? '/' : route.path.replace(/\/+$/, '')}`)

useHead(() => ({
  link: [{ rel: 'canonical', href: canonical.value }],
  meta: [{ property: 'og:url', content: canonical.value }]
}))
</script>
<template>
  <div class="min-h-screen bg-[radial-gradient(ellipse_at_85%_10%,#5c38860b,transparent_45%)]">
    <a class="transition-control focus-ring fixed -top-[60px] left-4 z-20 rounded-lg bg-[#7953c6] px-4 py-2.5 text-white focus:top-3" href="#main-content">Skip to calculator</a>
    <AppHeader />
    <main id="main-content" class="mx-auto w-[min(1240px,calc(100%_-_96px))] to-1100:w-[calc(100%_-_56px)] to-800:w-[calc(100%_-_40px)] to-480:w-[calc(100%_-_32px)]">
      <NuxtPage />
    </main>
    <AppFooter />
  </div>
</template>
