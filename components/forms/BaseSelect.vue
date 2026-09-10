<script setup lang="ts">
defineProps<{ label: string, id: string, options: Array<number | { value: number, label: string }>, unit?: string }>()
const model = defineModel<number>({ required: true })
const optionValue = (option: number | { value: number, label: string }) => typeof option === 'number' ? option : option.value
</script>
<template>
  <div>
    <label :for="id" class="mb-[9px] flex flex-wrap items-center justify-between gap-1 text-[14px] text-label">{{ label }}</label>
    <div class="relative">
      <select :id="id" v-model="model" class="h-[49px] w-full appearance-none pl-[15px] pr-10 text-[16px] rounded-[9px] border border-[#343646] bg-[#0f111a] text-text [transition:border-color_.2s] hover:border-[#565064] focus:border-purple focus:outline focus:outline-[3px] focus:outline-offset-0 focus:outline-[#9674f51a] motion-reduce:transition-none">
        <option v-for="option in options" :key="optionValue(option)" :value="optionValue(option)">
          {{ typeof option === 'number' ? `${option} ${unit ?? ''}`.trim() : option.label }}
        </option>
      </select>
      <AppIcon name="chevron" class="pointer-events-none absolute right-[15px] top-[17px] h-4 w-4 text-muted" />
    </div>
  </div>
</template>
