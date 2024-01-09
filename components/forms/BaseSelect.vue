<script setup lang="ts">
import { defineComponent } from 'vue'

defineComponent({
  name: 'BaseSelect'
})

defineProps({
  modelValue: {
    type: Number,
    required: true
  },
  label: {
    type: String,
    default: null
  },
  placeholder: {
    type: String,
    default: null
  },
  options: {
    type: Array<any>,
    default: (): Array<any> => []
  }
})

const emit = defineEmits(['update:modelValue'])

function updateValue (event: any) {
  emit('update:modelValue', parseFloat(event.target.value))
}

</script>
<template>
  <div class="w-full flex flex-col">
    <label class="flex text-sm font-medium leading-6 text-gray-900">{{ label }}</label>
    <div class="relative">
      <select
        class="w-full pe-16 p-2.5 border border-gray-300 text-gray-900 text-sm rounded-lg ring-inset leading-tight focus:outline-none focus:bg-white focus:border-purple-500"
        required
        :value="modelValue"
        @input="updateValue"
      >
        <option v-for="option in options" :key="option">
          {{ option }}
        </option>
      </select>
    </div>
  </div>
</template>
