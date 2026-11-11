<script setup lang="ts">
import type { Job, JobStatus } from '~/types'

const { jobs, loaded, start, clearFinished } = useJobs()

const status = ref<JobStatus | 'all'>('all')
const search = ref('')
const filtered = computed(() => jobs.value.filter(job =>
  (status.value === 'all' || job.status === status.value)
  && (!search.value || job.label.toLowerCase().includes(search.value.toLowerCase()) || `#${job.id}` === search.value.trim())
))

const statusItems = [
  { label: 'All', value: 'all' },
  ...Object.entries(statusLabel).map(([value, label]) => ({ label, value }))
]

const selectedId = ref<number | null>(null)
const showJob = ref(false)
function openJob(job: Job) {
  selectedId.value = job.id
  showJob.value = true
}
</script>

<template>
  <UDashboardPanel id="jobs">
    <template #header>
      <UDashboardNavbar title="Jobs">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UButton label="Start 5 random jobs" icon="i-lucide-shuffle" @click="start('random', 5)" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="flex flex-wrap items-center justify-between gap-1.5">
        <UInput
          v-model="search"
          class="max-w-sm"
          icon="i-lucide-search"
          placeholder="Filter jobs..."
        />
        <div class="flex flex-wrap items-center gap-1.5">
          <USelect v-model="status" :items="statusItems" class="min-w-32" />
          <UButton label="Clear finished" icon="i-lucide-trash-2" color="neutral" variant="outline" @click="clearFinished" />
        </div>
      </div>

      <JobsTable :jobs="filtered" :loading="!loaded" @open="openJob" />

      <p class="text-sm text-muted">
        {{ filtered.length }} of {{ jobs.length }} jobs
      </p>

      <JobSlideover v-model:open="showJob" :job-id="selectedId" />
    </template>
  </UDashboardPanel>
</template>
