<script setup lang="ts">
import type { Job } from '~/types'

const props = defineProps<{
  jobId: number | null
}>()
const open = defineModel<boolean>('open', { default: false })

const { jobs, cancel, retry } = useJobs()
const job = ref<Job | null>(null)

// Reload the full job (with its log) whenever its row changes.
const summary = computed(() => jobs.value.find(j => j.id === props.jobId))
watch([() => props.jobId, () => summary.value?.status, () => summary.value?.step, open], async () => {
  if (!open.value || props.jobId == null) return
  job.value = await $fetch<Job>(`/api/worker/jobs/${props.jobId}`).catch(() => null)
}, { immediate: true })

const finished = computed(() => job.value && ['completed', 'failed', 'cancelled'].includes(job.value.status))
</script>

<template>
  <USlideover v-model:open="open" :title="job ? `#${job.id} ${job.label}` : 'Job'">
    <template #body>
      <div v-if="job" class="flex flex-col gap-4">
        <div class="flex items-center gap-2">
          <UBadge variant="subtle" :color="statusColor[job.status]">
            {{ statusLabel[job.status] }}
          </UBadge>
          <span class="text-sm text-muted">Step {{ job.step }} of {{ job.steps }} · attempt {{ job.attempts }} · from {{ job.source }}</span>
        </div>
        <UProgress :model-value="job.progress" :color="statusColor[job.status] === 'neutral' ? 'neutral' : statusColor[job.status]" />
        <UAlert v-if="job.error" color="error" variant="subtle" icon="i-lucide-circle-x" :title="job.error" />

        <div>
          <p class="mb-2 text-xs font-medium text-muted uppercase">
            Log
          </p>
          <ol class="flex flex-col gap-1 font-mono text-xs">
            <li v-for="(log, i) in job.logs" :key="i" class="flex gap-3">
              <span class="shrink-0 text-dimmed">{{ new Date(log.at).toLocaleTimeString() }}</span>
              <span :class="{ 'text-error': log.level === 'error', 'text-warning': log.level === 'warn' }">{{ log.message }}</span>
            </li>
          </ol>
        </div>
      </div>
    </template>

    <template #footer>
      <div v-if="job" class="flex gap-2">
        <UButton v-if="finished" label="Retry" icon="i-lucide-rotate-ccw" @click="retry(job)" />
        <UButton v-else label="Cancel" icon="i-lucide-square" color="error" variant="subtle" @click="cancel(job)" />
      </div>
    </template>
  </USlideover>
</template>
