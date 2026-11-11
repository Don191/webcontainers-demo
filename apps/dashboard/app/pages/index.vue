<script setup lang="ts">
import type { Job } from '~/types'

const { jobs, loaded, workerError } = useJobs()
const recent = computed(() => jobs.value.slice(0, 8))

const selectedId = ref<number | null>(null)
const showJob = ref(false)
function openJob(job: Job) {
  selectedId.value = job.id
  showJob.value = true
}
</script>

<template>
  <UDashboardPanel id="overview">
    <template #header>
      <UDashboardNavbar title="Overview">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UButton label="All jobs" to="/jobs" color="neutral" variant="ghost" trailing-icon="i-lucide-arrow-right" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <UAlert
        v-if="loaded && workerError"
        color="error"
        variant="subtle"
        icon="i-lucide-plug-zap"
        title="The worker isn't answering"
        :description="`${workerError} The dashboard keeps trying every second.`"
      />

      <JobStats />

      <div class="grid gap-4 lg:grid-cols-3 sm:gap-6">
        <StartJobs class="lg:col-span-2" />
        <WorkerCard />
      </div>

      <div>
        <h2 class="mb-3 font-semibold text-highlighted">
          Latest jobs
        </h2>
        <JobsTable :jobs="recent" :loading="!loaded" @open="openJob" />
      </div>

      <JobSlideover v-model:open="showJob" :job-id="selectedId" />
    </template>
  </UDashboardPanel>
</template>
