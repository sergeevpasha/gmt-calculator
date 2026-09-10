// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  // `nuxt dev` and `nuxt build` both default to .nuxt, so a build launched while
  // the dev server is running overwrites the manifests underneath it. Let the
  // build point somewhere else instead. .cache is already ignored by the dev
  // watcher and by git, so a build there does not disturb a running server.
  buildDir: process.env.NUXT_BUILD_DIR || '.nuxt',
  devtools: { enabled: true }.enabled,
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
      title: 'Gomining calculator',
      htmlAttrs: { class: 'min-w-[320px] scroll-smooth [color-scheme:dark] motion-reduce:scroll-auto' },
      bodyAttrs: { class: 'bg-bg text-[16px] text-text [-webkit-font-smoothing:antialiased]' },
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        {
          hid: 'description',
          name: 'description',
          content: 'Easy to use calculator to estimate the profitability of mining Bitcoin with gmt.io'
        },
        { name: 'theme-color', content: '#0c0e15' }
      ],
      link: [
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;450;500;550;600;650;700&family=Manrope:wght@400;500;600;650;700;750;800&display=swap' },
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
