import plugin from 'tailwindcss/plugin'

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './components/**/*.{js,vue,ts}',
    './pages/**/*.vue',
    './plugins/**/*.{js,ts}',
    './app.vue',
    './error.vue',
    // The <html> and <body> classes live in app.head there.
    './nuxt.config.ts'
  ],
  theme: {
    // Desktop-first, matching the breakpoints the design was built on. Declared from widest to narrowest
    // so a narrower breakpoint overrides a wider one; from-1600 is the only min-width query.
    screens: {
      'to-1100': { raw: '(max-width: 1100px)' },
      'to-1000': { raw: '(max-width: 1000px)' },
      'to-800': { raw: '(max-width: 800px)' },
      'to-700': { raw: '(max-width: 700px)' },
      'to-600': { raw: '(max-width: 600px)' },
      'to-480': { raw: '(max-width: 480px)' },
      'to-360': { raw: '(max-width: 360px)' },
      'from-1600': { raw: '(min-width: 1600px)' }
    },
    extend: {
      colors: {
        bg: '#0c0e15',
        panel: '#131620',
        border: '#282b38',
        text: '#f2f2f7',
        label: '#cccadb',
        muted: '#a1a3b6',
        dim: '#83879c',
        purple: '#a68aff',
        green: '#69ddbd'
      },
      fontFamily: {
        sans: ['"DM Sans"', 'sans-serif'],
        display: ['Manrope', 'sans-serif']
      },
      animation: {
        'spin-slow': 'spin 1.4s linear infinite'
      }
    }
  },
  plugins: [
    plugin(({ addBase, addUtilities, theme }) => {
      // The two families, self-hosted. Google's stylesheet was the page's one render-blocking
      // request: nothing could paint until fonts.googleapis.com answered, which PageSpeed put at
      // about 1.8 s on mobile. These are the same variable woff2 subsets Google serves, copied into
      // public/fonts, so the browser fetches them from our own origin alongside the CSS.
      addBase({
        '@font-face': [
          {
            fontFamily: 'DM Sans',
            fontStyle: 'normal',
            fontWeight: '100 1000',
            fontDisplay: 'swap',
            src: "url('/fonts/dm-sans-latin-ext.woff2') format('woff2')",
            unicodeRange: 'U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF'
          },
          {
            fontFamily: 'DM Sans',
            fontStyle: 'normal',
            fontWeight: '100 1000',
            fontDisplay: 'swap',
            src: "url('/fonts/dm-sans-latin.woff2') format('woff2')",
            unicodeRange: 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD'
          },
          {
            fontFamily: 'Manrope',
            fontStyle: 'normal',
            fontWeight: '200 800',
            fontDisplay: 'swap',
            src: "url('/fonts/manrope-latin-ext.woff2') format('woff2')",
            unicodeRange: 'U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF'
          },
          {
            fontFamily: 'Manrope',
            fontStyle: 'normal',
            fontWeight: '200 800',
            fontDisplay: 'swap',
            src: "url('/fonts/manrope-latin.woff2') format('woff2')",
            unicodeRange: 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD'
          }
        ]
      })
      addUtilities({
        // The colour and press transition every button and link shares.
        '.transition-control': {
          transition: 'color .2s, border-color .2s, background .2s, transform .2s',
          '@media (prefers-reduced-motion: reduce)': { transition: 'none' }
        },
        // Keyboard focus ring for buttons, links and disclosures.
        '.focus-ring': {
          '&:focus-visible': { outline: `2px solid ${theme('colors.purple')}`, outlineOffset: '5px' }
        },
        // Number inputs without the browser's stepper arrows.
        '.no-spinner': {
          appearance: 'textfield',
          '-moz-appearance': 'textfield',
          '&::-webkit-inner-spin-button, &::-webkit-outer-spin-button': { '-webkit-appearance': 'none', margin: '0' }
        }
      })
    })
  ]
}
