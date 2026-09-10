<script setup lang="ts">
defineProps<{ label: string }>()
</script>
<template>
  <button class="transition-control focus-ring flex min-h-[49px] w-full items-center justify-center gap-2.5 rounded-[9px] border border-[#ae83ff66] bg-[#8354db] px-[17px] py-3 text-[14px] font-semibold text-white [box-shadow:0_4px_20px_#7f4ddd20] hover:bg-[#895add] hover:[box-shadow:0_4px_25px_#8f60f039] active:translate-y-px">
    <AppIcon name="chart" class="h-[17px] w-[17px] shrink-0" /><span class="mr-auto">{{ label }}</span><AppIcon name="arrow" class="ml-auto h-[17px] w-[17px] shrink-0" />
  </button>
</template>
