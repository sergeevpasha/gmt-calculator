<script setup lang="ts">
import { defineComponent } from 'vue'

defineComponent({
  name: 'ResultColumn'
})

defineProps({
  label: {
    type: String,
    default: null
  },
  modelValue: {
    type: Number,
    default: null
  },
  additionalValue: {
    type: Number,
    default: null
  }
})

</script>
<template>
  <div class="flex flex-wrap flex-col items-start">
    <span class="text-sm text-gray-500 dark:text-gray-300">{{ label }}</span>
    <div class="flex items-center">
      <slot name="symbol" />
      <span class="text-lg font-bold dark:text-gray-100">{{ modelValue }}</span>
      <slot name="converted" />
    </div>
  </div>
</template>
