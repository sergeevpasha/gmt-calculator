<template>
  <header class="border-b border-border">
    <div class="mx-auto flex min-h-[88px] w-[min(1240px,calc(100%_-_96px))] items-center justify-between gap-6 to-1100:w-[calc(100%_-_56px)] to-800:min-h-[74px] to-800:w-[calc(100%_-_40px)] to-480:w-[calc(100%_-_32px)]">
      <a href="/" class="transition-control focus-ring flex items-center gap-[14px] text-text no-underline to-480:gap-[11px]" aria-label="GMT Calculator home">
        <AppLogo class="h-[26px] w-[37px] shrink-0 to-480:h-[22px] to-480:w-[31px]" />
        <span class="whitespace-nowrap font-display text-[17px] font-bold tracking-[-.3px] to-480:text-[15px]">GMT <span class="font-medium text-muted">Calculator</span></span>
      </a>
      <div class="flex shrink-0 items-center gap-3 rounded-[999px] border border-[#33304a] bg-[#17192580] py-[9px] pl-[15px] pr-4 text-[12px] tracking-[.2px] text-text to-800:gap-2.5 to-800:px-[13px] to-800:py-2 to-480:px-3 to-480:py-[7px]">
        <span class="whitespace-nowrap text-dim to-480:hidden">Built for</span>
        <GoMiningIcon class="h-[25px] w-[124px] shrink-0 to-800:h-[22px] to-800:w-[110px] to-480:h-[20px] to-480:w-[100px]" role="img" aria-label="GoMining" />
      </div>
    </div>
  </header>
</template>
