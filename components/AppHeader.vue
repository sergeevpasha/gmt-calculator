<script setup lang="ts">
import type { Ref } from 'vue'
import GoMiningIcon from '~/components/svg/GoMiningIcon.vue'

const menu: Ref<boolean> = ref(false)
</script>
<template>
  <header>
    <nav class="border-gray-200 bg-gray-50 dark:bg-gray-800 dark:border-gray-700">
      <div class="container flex flex-wrap items-center justify-between mx-auto p-4">
        <a href="/" class="flex space-x-1">
          <GoMiningIcon />
          <span class="bg-gradient-to-r from-purple-600 via-pink-300 to-red-300 inline-block text-transparent bg-clip-text font-bold text-xs uppercase">Calculator</span>
        </a>
        <button
          type="button"
          class="inline-flex items-center p-2 w-10 h-10 justify-center text-sm text-gray-500 rounded-lg md:hidden hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-200 dark:text-gray-400 dark:hover:bg-gray-700 dark:focus:ring-gray-600"
          aria-controls="navbar-solid-bg"
          aria-expanded="false"
          @click="menu = !menu"
        >
          <svg class="w-5 h-5" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 17 14">
            <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M1 1h15M1 7h15M1 13h15" />
          </svg>
        </button>
        <div
          id="navbar-solid-bg"
          :class="{
            'hidden': menu,
            'w-full': true,
            'md:block': true,
            'md:w-auto': true
          }"
        >
          <ul class="flex flex-col font-medium mt-4 rounded-lg bg-gray-50 md:space-x-8 rtl:space-x-reverse md:flex-row md:mt-0 md:border-0 md:bg-transparent dark:bg-gray-800 md:dark:bg-transparent dark:border-gray-700">
            <!--            <li>-->
            <!--              <a href="#" class="block py-2 px-3 md:p-0 text-white bg-blue-700 rounded md:bg-transparent md:text-blue-700 md:dark:text-blue-500 dark:bg-blue-600 md:dark:bg-transparent" aria-current="page">Home</a>-->
            <!--            </li>-->
          </ul>
        </div>
      </div>
    </nav>
  </header>
</template>
