<script setup lang="ts">
defineOptions({ inheritAttrs: false })
defineProps<{ label: string, id: string, unit?: string, hint?: string }>()
// v-model on a number input yields a number, or '' while the field is empty.
const model = defineModel<number | ''>({ required: true })
</script>
<template>
  <div>
    <label :for="id" class="mb-[9px] flex flex-wrap items-center justify-between gap-1 text-[14px] text-label">{{ label }}<slot name="label-extra" /></label>
    <div class="relative">
      <span v-if="$slots.prefix" class="pointer-events-none absolute left-[15px] top-1/2 -translate-y-1/2 text-[20px] text-[#b3afc5]"><slot name="prefix" /></span>
      <input
        :id="id"
        v-model="model"
        v-bind="$attrs"
        type="number"
        class="no-spinner w-full pr-16 rounded-[9px] border border-[#343646] bg-[#0f111a] text-text [transition:border-color_.2s] hover:border-[#565064] focus:border-purple focus:outline focus:outline-[3px] focus:outline-offset-0 focus:outline-[#9674f51a] motion-reduce:transition-none"
        :class="$slots.prefix ? 'h-[57px] pl-[35px] text-[21px] font-[550]' : 'h-[49px] pl-[15px] text-[16px]'"
        :aria-describedby="hint ? `${id}-hint` : undefined"
        inputmode="decimal"
        required
      >
      <span v-if="unit" class="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[12px] text-dim">{{ unit }}</span>
    </div>
    <p v-if="hint" :id="`${id}-hint`" class="mt-2 text-[12px] leading-[1.5] text-dim">
      {{ hint }}
    </p>
  </div>
</template>
