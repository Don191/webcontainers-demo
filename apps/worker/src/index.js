import { WORKER_PORT } from '@demo/jobs'
import { JobQueue } from './queue.js'
import { createApi } from './server.js'

const port = Number(process.env.PORT) || WORKER_PORT
const queue = new JobQueue({
  concurrency: Number(process.env.CONCURRENCY) || 3,
  speed: Number(process.env.SPEED) || 1
})

const colours = { completed: 32, failed: 31, cancelled: 33, running: 36, queued: 90 }
queue.on('change', (job) => {
  // One line per status change, not per tick, so the log stays readable.
  if (!job || job._lastLogged === job.status) return
  Object.defineProperty(job, '_lastLogged', { value: job.status, writable: true, enumerable: false })
  console.log(`\x1b[${colours[job.status]}m${job.status.padEnd(9)}\x1b[0m #${job.id} ${job.label}${job.error ? ` (${job.error})` : ''}`)
})

const server = createApi(queue)
server.listen(port, () => {
  console.log(`Worker API on http://localhost:${port} (${queue.concurrency} jobs at a time)`)
  // A few jobs so there's something to look at straight away.
  if (process.env.SEED !== 'false') {
    for (const type of ['backup-database', 'send-emails', 'resize-images']) queue.add(type, 'seed')
  }
})

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    queue.stop()
    server.close()
    process.exit(0)
  })
}
