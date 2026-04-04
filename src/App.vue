<script setup lang="ts">
import { RouterView } from 'vue-router'
</script>

<template>
  <RouterView v-slot="{ Component }">
    <Suspense v-if="Component">
      <component :is="Component" />
      <template #fallback>
        <div
          class="flex min-h-svh items-center justify-center bg-[#0a0a0a] px-4 text-sm text-[#e5e5e5]"
        >
          Carregando…
        </div>
      </template>
    </Suspense>
    <div
      v-else
      class="flex min-h-svh items-center justify-center bg-[#0a0a0a] px-4 text-sm text-[#e5e5e5]"
    >
      Carregando…
    </div>
  </RouterView>
</template>
