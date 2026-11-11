// Mirrors the JSDoc types in packages/jobs/src/catalog.js.

export type JobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'

export interface JobLog {
  at: string
  level: 'info' | 'warn' | 'error'
  message: string
}

export interface Job {
  id: number
  type: string
  label: string
  status: JobStatus
  progress: number
  step: number
  steps: number
  attempts: number
  source: string
  createdAt: string
  startedAt: string | null
  finishedAt: string | null
  error: string | null
  lastLog?: string | null
  logs?: JobLog[]
}

export interface WorkerHealth {
  name: 'worker'
  status: 'ok'
  startedAt: string
  uptime: number
  node: string
  paused: boolean
  concurrency: number
  counts: Record<JobStatus, number>
}
