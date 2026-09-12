import { inject } from '@vercel/analytics'

// Both analytics scripts are dead weight for the first paint: they measure the page, nothing on it
// depends on them, and gtag.js alone was 168 KiB and about 400 ms of main-thread time in PageSpeed
// Insights. They start once Nuxt has hydrated and the browser goes idle, so they no longer land in
// the page's blocking time. grantConsent injects the script through useHead, which needs the Nuxt
// context back after the idle callback.
export default defineNuxtPlugin((nuxtApp) => {
  onNuxtReady(() => {
    inject()
    nuxtApp.runWithContext(() => useGtag().grantConsent())
  })
})
