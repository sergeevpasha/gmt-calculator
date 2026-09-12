// https://nuxt.com/docs/api/configuration/nuxt-config
import { SHARE_IMAGE_ALT, SITE_DESCRIPTION, SITE_NAME, SITE_TITLE, SITE_URL } from './data/site'

export default defineNuxtConfig({
  // `nuxt dev` and `nuxt build` both default to .nuxt, so a build launched while
  // the dev server is running overwrites the manifests underneath it. Let the
  // build point somewhere else instead. .cache is already ignored by the dev
  // watcher and by git, so a build there does not disturb a running server.
  buildDir: process.env.NUXT_BUILD_DIR || '.nuxt',
  devtools: { enabled: true },
  nitro: {
    vercel: {
      config: {
        // Refresh the stored market reading daily. GoMining publishes the payout around 03:31 UTC.
        // Declared here rather than in vercel.json because the Vercel preset builds through the
        // Build Output API, so .vercel/output/config.json is what the platform actually reads.
        crons: [{ path: '/api/cron/refresh-market', schedule: '0 4 * * *' }]
      }
    }
  },
  app: {
    head: {
      title: SITE_TITLE,
      htmlAttrs: { lang: 'en', class: 'min-w-[320px] scroll-smooth [color-scheme:dark] motion-reduce:scroll-auto' },
      bodyAttrs: { class: 'bg-bg text-[16px] text-text [-webkit-font-smoothing:antialiased]' },
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        { name: 'description', content: SITE_DESCRIPTION },
        { name: 'theme-color', content: '#0c0e15' },
        // What a link to the site looks like when it is shared. og:url and the canonical link differ
        // per page, so app.vue adds those two; everything here is the same on every page.
        { property: 'og:type', content: 'website' },
        { property: 'og:site_name', content: SITE_NAME },
        { property: 'og:locale', content: 'en_US' },
        { property: 'og:title', content: SITE_TITLE },
        { property: 'og:description', content: SITE_DESCRIPTION },
        { property: 'og:image', content: `${SITE_URL}/og-image.png` },
        { property: 'og:image:width', content: '1200' },
        { property: 'og:image:height', content: '630' },
        { property: 'og:image:alt', content: SHARE_IMAGE_ALT },
        { name: 'twitter:card', content: 'summary_large_image' },
        { name: 'twitter:title', content: SITE_TITLE },
        { name: 'twitter:description', content: SITE_DESCRIPTION },
        { name: 'twitter:image', content: `${SITE_URL}/og-image.png` },
        { name: 'twitter:image:alt', content: SHARE_IMAGE_ALT }
      ],
      link: [
        // The faces are declared in tailwind.config.js and served from public/fonts; these two are
        // the latin subsets every page needs, fetched in parallel with the stylesheet rather than
        // after the browser has parsed it.
        { rel: 'preload', as: 'font', type: 'font/woff2', href: '/fonts/dm-sans-latin.woff2', crossorigin: '' },
        { rel: 'preload', as: 'font', type: 'font/woff2', href: '/fonts/manrope-latin.woff2', crossorigin: '' },
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'icon', type: 'image/png', sizes: '16x16', href: '/favicon-16x16.png' },
        { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/favicon-32x32.png' },
        { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.png' },
        { rel: 'mask-icon', href: '/safari-pinned-tab.svg', color: '#a68aff' },
        { rel: 'manifest', href: '/site.webmanifest' }
      ]
    }
  },
  components: [
    {
      path: '~/components',
      pathPrefix: false
    }
  ],
  css: ['~/assets/css/tailwind.css'],
  modules: [
    '@nuxtjs/eslint-module',
    'nuxt-gtag'
  ],
  gtag: {
    id: 'G-R2TWYZL9MC'
  },
  eslint: {
    lintOnStart: false
  },
  postcss: {
    plugins: {
      tailwindcss: {},
      autoprefixer: {}
    }
  }
})
