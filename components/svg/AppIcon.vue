<script setup lang="ts">
type IconName = 'chart' | 'chip' | 'bolt' | 'arrow' | 'refresh' | 'info' | 'check' | 'chevron' | 'settings' | 'clock'

defineProps<{ name: IconName }>()

const paths: Record<IconName, string> = {
  chart: 'M4 19V5m0 14h16M8 15l4-5 4 3 4-7',
  chip: 'M8 3v3m8-3v3M8 18v3m8-3v3M3 8h3m-3 8h3m12-8h3m-3 8h3M6 6h12v12H6zM9 9h6v6H9z',
  bolt: 'M13 2L4 14h7l-1 8 10-12h-7l1-8z',
  arrow: 'M5 12h14m-5-5 5 5-5 5',
  refresh: 'M20 7v5h-5M4 17v-5h5M6.1 7a7 7 0 0 1 11.5-2L20 8M4 16l2.4 3A7 7 0 0 0 17.9 17',
  info: 'M12 11v6m0-10v.01',
  check: 'M5 12l4 4L19 6',
  chevron: 'M8 10l4 4 4-4',
  settings: 'M4 7h16M4 17h16M8 4v6m8 4v6',
  clock: 'M12 7v5l3 2'
}
</script>
<template>
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.6"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <circle v-if="name === 'info' || name === 'clock'" cx="12" cy="12" r="9" />
    <path :d="paths[name]" />
  </svg>
</template>
