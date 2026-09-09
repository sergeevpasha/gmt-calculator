<script setup lang="ts">
defineOptions({ inheritAttrs: false })
defineProps<{ modelValue: number | string, label: string, id: string, type?: string, placeholder?: string, unit?: string, hint?: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: number | string] }>()
function updateValue (event: Event) {
  const input = event.target as HTMLInputElement
  emit('update:modelValue', input.value === '' ? '' : Number(input.value))
}
</script>
<template>
  <div class="form-field">
    <label :for="id">{{ label }}<slot name="label-extra" /></label>
    <div class="input-wrap">
      <span v-if="$slots.prefix" class="input-prefix"><slot name="prefix" /></span>
      <input
        :id="id"
        v-bind="$attrs"
        :type="type || 'number'"
        :placeholder="placeholder"
        :value="modelValue"
        :class="{ 'has-prefix': $slots.prefix }"
        :aria-describedby="hint ? `${id}-hint` : undefined"
        inputmode="decimal"
        required
        @input="updateValue"
      >
      <span v-if="unit" class="input-unit">{{ unit }}</span>
      <slot name="symbol" />
    </div>
    <p v-if="hint" :id="`${id}-hint`" class="field-hint">
      {{ hint }}
    </p>
  </div>
</template>
