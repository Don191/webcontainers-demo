<script setup lang="ts">
const { start, jobTypes, health } = useJobs()
</script>

<template>
  <UPageCard
    title="Start a job"
    description="Each job is fake: it steps through a few stages over a few seconds, and sometimes fails so you can retry it."
    variant="subtle"
  >
    <div class="grid gap-2 sm:grid-cols-2">
      <UButton
        v-for="type in jobTypes"
        :key="type.id"
        :icon="type.icon"
        color="neutral"
        variant="outline"
        size="lg"
        :disabled="!health"
        class="justify-start"
        @click="start(type.id)"
      >
        <span class="flex-1 truncate text-left">{{ type.label }}</span>
        <span class="text-xs text-dimmed">~{{ type.seconds }}s</span>
      </UButton>
      <UButton
        icon="i-lucide-shuffle"
        label="Start 5 random jobs"
        size="lg"
        :disabled="!health"
        class="justify-start"
        @click="start('random', 5)"
      />
    </div>
  </UPageCard>
</template>
