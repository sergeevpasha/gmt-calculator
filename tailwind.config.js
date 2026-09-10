import plugin from 'tailwindcss/plugin'

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './components/**/*.{js,vue,ts}',
    './layouts/**/*.vue',
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
        'panel-raised': '#191c28',
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
    plugin(({ addUtilities, theme }) => {
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
