// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  devtools: { enabled: true }.enabled,
  app: {
    head: {
      title: 'Gomining calculator',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        {
          hid: 'description',
          name: 'description',
          content: 'Easy to use calculator to estimate the profitability of mining Bitcoin with gmt.io'
        }
      ],
      link: [
        { rel: 'icon', type: 'image/icon', href: '/favicon.ico' },
        { rel: 'icon', type: 'image/svg+xm', href: '/favicon.svg' },
        { rel: 'icon', type: 'image/png', sizes: '16x16', href: '/favicon-16x16.png' },
        { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/favicon-32x32.png' },
        { rel: 'apple-touch-icon', type: 'image/x-icon', sizes: '180x180', href: '/apple-touch-icon.png' },
        { rel: 'mask-icon', href: '/safari-pinned-tab.svg', color: '#5bbad5' },
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
  css: ['~/assets/scss/app.scss'],
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
