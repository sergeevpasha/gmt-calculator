<script setup lang="ts">
import { defineComponent } from 'vue'

defineComponent({
  name: 'BaseButton'
})

defineProps({
  label: {
    type: String,
    default: null
  }
})

const isPressed = ref(false)

</script>
<template>
  <button
    class="text-white bg-purple-600 rounded-lg h-10 transition-all duration-200 ease-in-out"
    :class="{ 'bg-pink-500': isPressed, 'hover:bg-red-400': !isPressed }"
    @mouseover="isPressed = false"
    @mousedown="isPressed = true"
    @mouseup="isPressed = false"
    @mouseleave="isPressed = false"
  >
    {{ label }}
  </button>
</template>
