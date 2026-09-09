<script setup lang="ts">
defineProps<{ modelValue: number, label: string, id: string, options: Array<number | { value: number, label: string }>, unit?: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: number] }>()
const optionValue = (option: number | { value: number, label: string }) => typeof option === 'number' ? option : option.value
</script>
<template>
  <div class="form-field">
    <label :for="id">{{ label }}</label>
    <div class="input-wrap select-wrap">
      <select :id="id" :value="modelValue" @change="emit('update:modelValue', Number(($event.target as HTMLSelectElement).value))">
        <option v-for="option in options" :key="optionValue(option)" :value="optionValue(option)">
          {{ typeof option === 'number' ? `${option} ${unit ?? ''}`.trim() : option.label }}
        </option>
      </select>
      <AppIcon name="chevron" />
    </div>
  </div>
</template>
