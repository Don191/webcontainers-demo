<script setup lang="ts">
const { health } = useJobs()

const stats = computed(() => {
  const counts = health.value?.counts
  return [
    { title: 'Running', icon: 'i-lucide-loader', value: counts?.running ?? 0 },
    { title: 'Queued', icon: 'i-lucide-hourglass', value: counts?.queued ?? 0 },
    { title: 'Done', icon: 'i-lucide-circle-check', value: counts?.completed ?? 0 },
    { title: 'Failed', icon: 'i-lucide-circle-x', value: counts?.failed ?? 0 }
  ]
})
</script>

<template>
  <UPageGrid class="gap-4 sm:gap-6 lg:grid-cols-4 lg:gap-px">
    <UPageCard
      v-for="stat in stats"
      :key="stat.title"
      :icon="stat.icon"
      :title="stat.title"
      to="/jobs"
      variant="subtle"
      :ui="{
        container: 'gap-y-1.5',
        wrapper: 'items-start',
        leading: 'p-2.5 rounded-full bg-primary/10 ring ring-inset ring-primary/25 flex-col',
        title: 'font-normal text-muted text-xs uppercase'
      }"
      class="first:rounded-l-lg last:rounded-r-lg hover:z-1 lg:rounded-none"
    >
      <span class="text-2xl font-semibold text-highlighted tabular-nums">
        {{ stat.value }}
      </span>
    </UPageCard>
  </UPageGrid>
</template>
