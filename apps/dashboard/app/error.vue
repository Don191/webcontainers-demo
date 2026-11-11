<script setup lang="ts">
import type { NuxtError } from '#app'

defineProps<{
  error: NuxtError
}>()

useSeoMeta({ title: 'Page not found' })
</script>

<template>
  <UApp>
    <UError :error="error" />
  </UApp>
</template>
