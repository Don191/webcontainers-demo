import { EventEmitter } from 'node:events'
import { getJobType, isFinished } from '@demo/jobs'

const MAX_JOBS = 200
const MAX_LOGS = 50

/**
 * An in-memory job queue. Jobs wait in line until a slot is free, then tick
 * through their steps on a timer. Nothing is real: it's here to give the
 * dashboard and the TUI something to watch and control.
 */
export class JobQueue extends EventEmitter {
  /** @param {{ concurrency?: number, speed?: number, random?: () => number }} [opts] */
  constructor({ concurrency = 3, speed = 1, random = Math.random } = {}) {
    super()
    this.concurrency = concurrency
    this.speed = speed
    this.random = random
    this.paused = false
    this.nextId = 1
    /** @type {Map<number, import('@demo/jobs').Job>} */
    this.jobs = new Map()
    /** @type {Map<number, NodeJS.Timeout>} */
    this.timers = new Map()
  }

  /** @param {string} type @param {string} [source] */
  add(type, source = 'api') {
    const jobType = getJobType(type)
    if (!jobType) throw new Error(`Unknown job type: ${type}`)
    /** @type {import('@demo/jobs').Job} */
    const job = {
      id: this.nextId++,
      type,
      label: jobType.label,
      status: 'queued',
      progress: 0,
      step: 0,
      steps: jobType.steps.length,
      attempts: 0,
      source,
      createdAt: new Date().toISOString(),
      startedAt: null,
      finishedAt: null,
      error: null,
      logs: []
    }
    this.jobs.set(job.id, job)
    this.log(job, 'info', `Queued by ${source}`)
    this.trim()
    this.changed(job)
    this.pump()
    return job
  }

  list() {
    return [...this.jobs.values()].sort((a, b) => b.id - a.id)
  }

  /** @param {number} id */
  get(id) {
    return this.jobs.get(id)
  }

  /** @param {number} id */
  cancel(id) {
    const job = this.mustGet(id)
    if (isFinished(job.status)) throw new Error(`Job ${id} has already ${job.status === 'cancelled' ? 'been cancelled' : job.status}`)
    this.stopTimer(id)
    this.finish(job, 'cancelled', 'Cancelled')
    return job
  }

  /** @param {number} id */
  retry(id) {
    const job = this.mustGet(id)
    if (!isFinished(job.status)) throw new Error(`Job ${id} is still ${job.status}`)
    Object.assign(job, { status: 'queued', progress: 0, step: 0, error: null, startedAt: null, finishedAt: null })
    this.log(job, 'info', 'Queued again')
    this.changed(job)
    this.pump()
    return job
  }

  clearFinished() {
    let removed = 0
    for (const job of this.jobs.values()) {
      if (isFinished(job.status)) {
        this.jobs.delete(job.id)
        removed++
      }
    }
    this.emit('change')
    return removed
  }

  /** @param {{ paused?: boolean, concurrency?: number }} settings */
  configure({ paused, concurrency }) {
    if (typeof paused === 'boolean') this.paused = paused
    if (Number.isInteger(concurrency) && concurrency >= 1 && concurrency <= 10) this.concurrency = concurrency
    this.emit('change')
    this.pump()
    return this.stats()
  }

  stats() {
    /** @type {Record<import('@demo/jobs').JobStatus, number>} */
    const counts = { queued: 0, running: 0, completed: 0, failed: 0, cancelled: 0 }
    for (const job of this.jobs.values()) counts[job.status]++
    return { paused: this.paused, concurrency: this.concurrency, counts }
  }

  stop() {
    for (const id of this.timers.keys()) this.stopTimer(id)
  }

  // Start queued jobs, oldest first, while there are free slots.
  pump() {
    if (this.paused) return
    const running = this.list().filter(j => j.status === 'running').length
    const queued = this.list().filter(j => j.status === 'queued').reverse()
    for (const job of queued.slice(0, Math.max(0, this.concurrency - running))) this.run(job)
  }

  /** @param {import('@demo/jobs').Job} job */
  run(job) {
    const jobType = getJobType(job.type)
    job.status = 'running'
    job.attempts++
    job.startedAt = new Date().toISOString()
    this.log(job, 'info', `Started (attempt ${job.attempts})`)
    this.changed(job)

    // Some runs fail partway through, at a random step.
    const failAt = this.random() < jobType.failRate ? Math.floor(this.random() * job.steps) : -1
    const stepMs = (jobType.seconds * 1000) / job.steps / this.speed

    const tick = () => {
      if (job.status !== 'running') return
      if (job.step === failAt) {
        this.finish(job, 'failed', `${jobType.steps[job.step]} failed: the fake service timed out`)
        return
      }
      this.log(job, 'info', jobType.steps[job.step])
      job.step++
      job.progress = Math.round((job.step / job.steps) * 100)
      if (job.step >= job.steps) {
        this.finish(job, 'completed', 'Done')
        return
      }
      this.changed(job)
      // A little jitter so jobs started together drift apart.
      this.timers.set(job.id, setTimeout(tick, stepMs * (0.6 + this.random() * 0.8)))
    }
    this.timers.set(job.id, setTimeout(tick, stepMs * 0.5))
  }

  /** @param {import('@demo/jobs').Job} job @param {'completed' | 'failed' | 'cancelled'} status @param {string} message */
  finish(job, status, message) {
    this.stopTimer(job.id)
    job.status = status
    job.finishedAt = new Date().toISOString()
    if (status === 'failed') job.error = message
    this.log(job, status === 'failed' ? 'error' : status === 'cancelled' ? 'warn' : 'info', message)
    this.changed(job)
    this.pump()
  }

  /** @param {import('@demo/jobs').Job} job @param {'info' | 'warn' | 'error'} level @param {string} message */
  log(job, level, message) {
    job.logs.push({ at: new Date().toISOString(), level, message })
    if (job.logs.length > MAX_LOGS) job.logs.splice(0, job.logs.length - MAX_LOGS)
  }

  /** @param {import('@demo/jobs').Job} job */
  changed(job) {
    this.emit('change', job)
  }

  /** @param {number} id */
  stopTimer(id) {
    clearTimeout(this.timers.get(id))
    this.timers.delete(id)
  }

  /** @param {number} id */
  mustGet(id) {
    const job = this.jobs.get(id)
    if (!job) throw Object.assign(new Error(`There's no job ${id}`), { status: 404 })
    return job
  }

  // Keep memory flat: drop the oldest finished jobs past the cap.
  trim() {
    if (this.jobs.size <= MAX_JOBS) return
    for (const job of [...this.jobs.values()].sort((a, b) => a.id - b.id)) {
      if (this.jobs.size <= MAX_JOBS) break
      if (isFinished(job.status)) this.jobs.delete(job.id)
    }
  }
}
