import { createSharedComposable, useIntervalFn } from '@vueuse/core'
import { jobTypes } from '@demo/jobs'
import type { Job, WorkerHealth } from '~/types'

/**
 * Jobs and worker status, polled once a second while the page is open, plus
 * the actions the dashboard offers. Shared, so every page sees the same data.
 */
const _useJobs = () => {
  const toast = useToast()
  const jobs = ref<Job[]>([])
  const health = ref<WorkerHealth | null>(null)
  const workerError = ref('')
  const loaded = ref(false)

  async function refresh() {
    try {
      const [list, status] = await Promise.all([
        $fetch<Job[]>('/api/worker/jobs'),
        $fetch<WorkerHealth>('/api/worker/health')
      ])
      jobs.value = list
      health.value = status
      workerError.value = ''
    } catch (e: any) {
      health.value = null
      workerError.value = e?.data?.statusMessage || e?.message || 'The worker isn\'t answering.'
    } finally {
      loaded.value = true
    }
  }

  const { pause, resume } = useIntervalFn(refresh, 1000, { immediate: false })
  onMounted(() => {
    refresh()
    resume()
  })
  onBeforeUnmount(pause)

  async function act(fn: () => Promise<unknown>, title: string) {
    try {
      await fn()
      toast.add({ title, icon: 'i-lucide-check', color: 'success', duration: 2000 })
    } catch (e: any) {
      toast.add({ title: 'That didn\'t work', description: e?.data?.error || e?.message, icon: 'i-lucide-circle-x', color: 'error' })
    }
    await refresh()
  }

  const post = (path: string, body?: object) => $fetch(`/api/worker${path}`, { method: 'POST', body })

  return {
    jobs,
    health,
    workerError,
    loaded,
    jobTypes,
    refresh,
    start: (type: string, count = 1) => {
      const label = type === 'random' ? `${count} random jobs` : jobTypes.find(t => t.id === type)?.label
      return act(() => post('/jobs', { type, count, source: 'dashboard' }), `Started ${label}`)
    },
    cancel: (job: Job) => act(() => post(`/jobs/${job.id}/cancel`), `Cancelled #${job.id}`),
    retry: (job: Job) => act(() => post(`/jobs/${job.id}/retry`), `Queued #${job.id} again`),
    clearFinished: () => act(() => $fetch('/api/worker/jobs?finished=1', { method: 'DELETE' }), 'Cleared finished jobs'),
    setPaused: (paused: boolean) => act(() => post('/queue', { paused }), paused ? 'Queue paused' : 'Queue resumed'),
    setConcurrency: (concurrency: number) => act(() => post('/queue', { concurrency }), `Running ${concurrency} at a time`)
  }
}

export const useJobs = createSharedComposable(_useJobs)

export const statusColor = {
  queued: 'neutral',
  running: 'info',
  completed: 'success',
  failed: 'error',
  cancelled: 'warning'
} as const

export const statusLabel = {
  queued: 'Queued',
  running: 'Running',
  completed: 'Done',
  failed: 'Failed',
  cancelled: 'Cancelled'
} as const
