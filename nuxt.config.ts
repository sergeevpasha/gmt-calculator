// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  // `nuxt dev` and `nuxt build` both default to .nuxt, so a build launched while
  // the dev server is running overwrites the manifests underneath it. Let the
  // build point somewhere else instead. .cache is already ignored by the dev
  // watcher and by git, so a build there does not disturb a running server.
  buildDir: process.env.NUXT_BUILD_DIR || '.nuxt',
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
        },
        { name: 'theme-color', content: '#0c0e15' }
      ],
      link: [
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
