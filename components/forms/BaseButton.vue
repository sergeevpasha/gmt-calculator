<script setup lang="ts">
defineProps<{ label: string }>()
</script>
<template>
  <button class="primary-button">
    <AppIcon name="chart" /><span>{{ label }}</span><AppIcon name="arrow" />
  </button>
</template>
