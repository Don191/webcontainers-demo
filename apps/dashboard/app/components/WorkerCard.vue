<script setup lang="ts">
const { health, workerError, setPaused, setConcurrency, clearFinished } = useJobs()

function uptime(seconds: number) {
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60)
  return m < 60 ? `${m}m ${seconds % 60}s` : `${Math.floor(m / 60)}h ${m % 60}m`
}
</script>

<template>
  <UPageCard title="Worker" variant="subtle">
    <template #description>
      <span v-if="health">Up for {{ uptime(health.uptime) }} on Node {{ health.node }}</span>
      <span v-else class="text-error">{{ workerError || 'Checking…' }}</span>
    </template>

    <div v-if="health" class="flex flex-col gap-4">
      <div class="flex items-center justify-between gap-4">
        <div>
          <p class="text-sm font-medium text-highlighted">
            Queue
          </p>
          <p class="text-xs text-muted">
            {{ health.paused ? 'Paused: queued jobs wait until you resume' : 'Picking up queued jobs' }}
          </p>
        </div>
        <USwitch
          :model-value="!health.paused"
          aria-label="Queue running"
          @update:model-value="(on: boolean) => setPaused(!on)"
        />
      </div>

      <div class="flex items-center justify-between gap-4">
        <div>
          <p class="text-sm font-medium text-highlighted">
            Jobs at a time
          </p>
          <p class="text-xs text-muted">
            How many run in parallel
          </p>
        </div>
        <UInputNumber
          :model-value="health.concurrency"
          :min="1"
          :max="10"
          class="w-28"
          @update:model-value="(n: number | null) => n && n !== health?.concurrency && setConcurrency(n)"
        />
      </div>

      <UButton
        label="Clear finished jobs"
        icon="i-lucide-trash-2"
        color="neutral"
        variant="subtle"
        class="self-start"
        @click="clearFinished"
      />
    </div>
  </UPageCard>
</template>
