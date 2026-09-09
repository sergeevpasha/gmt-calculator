<script setup lang="ts">
import type { NuxtError } from '#app'

const props = defineProps<{ error: NuxtError }>()
const isNotFound = computed(() => props.error.statusCode === 404)

useHead(() => ({
  title: `${isNotFound.value ? 'Page not found' : 'Something went wrong'} · GMT Calculator`,
  meta: [{ name: 'robots', content: 'noindex, nofollow' }]
}))

function returnToCalculator () {
  return clearError({ redirect: '/' })
}
</script>

<template>
  <div class="app-shell error-shell">
    <a class="skip-link" href="#error-content">Skip to error details</a>
    <AppHeader />

    <main id="error-content" class="main-content error-main">
      <section class="error-card" aria-labelledby="error-title">
        <div class="error-visual" aria-hidden="true">
          <span class="error-code">{{ error.statusCode || 500 }}</span>
          <div class="error-marker">
            <span class="status-dot" />
            {{ isNotFound ? 'PAGE NOT FOUND' : 'SOMETHING WENT WRONG' }}
          </div>
        </div>

        <div class="error-copy">
          <p class="eyebrow">
            <span /> {{ isNotFound ? 'A SMALL DETOUR' : 'A MOMENTARY PAUSE' }}
          </p>
          <h1 v-if="isNotFound" id="error-title">
            This page is<br><span>off the grid.</span>
          </h1>
          <h1 v-else id="error-title">
            Something went wrong.<br><span>Let's try again.</span>
          </h1>
          <p class="error-description">
            {{ isNotFound
              ? "We couldn't find the page you're looking for. Let's get you back to your numbers."
              : "We couldn't load this page. Head back to the calculator and give it another try." }}
          </p>
          <a href="/" class="primary-button error-home" @click.prevent="returnToCalculator">
            <AppIcon name="chart" />
            <span>Back to calculator</span>
            <AppIcon name="arrow" />
          </a>
          <p v-if="isNotFound" class="error-hint">
            You can also double-check the address for a typo.
          </p>
        </div>
      </section>
    </main>

    <AppFooter />
  </div>
</template>

<style scoped>
.error-shell {
  display: flex;
  flex-direction: column;
  min-height: 100svh;
}

.error-main {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  padding-top: 64px;
  padding-bottom: 64px;
}

.error-card {
  display: grid;
  grid-template-columns: 1fr 1.15fr;
  align-items: center;
  gap: 64px;
  width: 100%;
  max-width: 1020px;
  padding: 64px;
  border: 1px solid var(--border);
  border-radius: 24px;
  background: radial-gradient(ellipse at 15% 50%, #7950ad12, transparent 60%), var(--panel);
}

.error-visual {
  display: flex;
  min-width: 0;
  min-height: 300px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 20px;
  border-radius: 16px;
  background-image: linear-gradient(#a68aff09 1px, transparent 1px), linear-gradient(90deg, #a68aff09 1px, transparent 1px);
  background-size: 28px 28px;
}

.error-code {
  font-family: 'Manrope', sans-serif;
  font-size: clamp(96px, 12vw, 164px);
  font-weight: 750;
  letter-spacing: -.08em;
  line-height: 1;
  color: #b49af3;
  text-shadow: 0 12px 64px #a68aff1f;
}

.error-marker {
  display: flex;
  align-items: center;
  gap: 8px;
  max-width: 100%;
  padding: 8px 12px;
  border: 1px solid #51405f;
  border-radius: 7px;
  background: #221d30;
  color: #c7b4e8;
  font-size: 12px;
  letter-spacing: 1px;
  text-align: center;
}

.error-copy {
  min-width: 0;
}

.error-copy .eyebrow {
  margin-bottom: 16px;
}

.error-copy h1 {
  font-size: clamp(28px, 3.3vw, 42px);
  line-height: 1.25;
}

.error-description {
  max-width: 360px;
  margin-top: 20px;
  color: var(--muted);
  font-size: 16px;
  line-height: 1.75;
}

.error-home {
  width: fit-content;
  max-width: 100%;
  min-height: 49px;
  gap: 16px;
  margin-top: 28px;
  text-decoration: none;
}

.error-home svg {
  flex-shrink: 0;
}

.error-hint {
  margin-top: 18px;
  color: var(--dim);
  font-size: 12px;
  line-height: 1.7;
}

@media (max-width: 1000px) {
  .error-card {
    gap: 32px;
    padding: 40px;
  }
}

@media (max-width: 700px) {
  .error-main {
    padding-top: 32px;
    padding-bottom: 32px;
  }

  .error-card {
    grid-template-columns: 1fr;
    gap: 32px;
    max-width: 480px;
    padding: 32px 24px;
    border-radius: 18px;
    text-align: center;
  }

  .error-visual {
    min-height: 180px;
    gap: 16px;
  }

  .error-code {
    font-size: 112px;
  }

  .error-copy .eyebrow {
    justify-content: center;
  }

  .error-description,
  .error-home {
    margin-right: auto;
    margin-left: auto;
  }
}
</style>
