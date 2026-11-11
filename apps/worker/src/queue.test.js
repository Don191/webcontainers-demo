import { test } from 'node:test'
import assert from 'node:assert/strict'
import { JobQueue } from './queue.js'

const settle = queue => new Promise((resolve) => {
  const check = () => queue.list().every(j => ['completed', 'failed', 'cancelled'].includes(j.status)) && resolve()
  queue.on('change', check)
  check()
})

test('runs jobs to completion, a few at a time', async () => {
  const queue = new JobQueue({ concurrency: 2, speed: 200, random: () => 0.99 })
  for (let i = 0; i < 4; i++) queue.add('send-emails', 'test')
  assert.equal(queue.stats().counts.running, 2)
  assert.equal(queue.stats().counts.queued, 2)
  await settle(queue)
  assert.equal(queue.stats().counts.completed, 4)
  assert.ok(queue.list().every(j => j.progress === 100))
})

test('fails, then succeeds on retry', async () => {
  let rolls = [0, 0] // fail at step 0
  const queue = new JobQueue({ speed: 200, random: () => rolls.shift() ?? 0.99 })
  const job = queue.add('sync-inventory', 'test')
  await settle(queue)
  assert.equal(job.status, 'failed')
  assert.match(job.error, /failed/)
  queue.retry(job.id)
  await settle(queue)
  assert.equal(job.status, 'completed')
  assert.equal(job.attempts, 2)
})

test('cancel, pause and clear', async () => {
  const queue = new JobQueue({ concurrency: 1, speed: 1 })
  const a = queue.add('backup-database', 'test')
  const b = queue.add('backup-database', 'test')
  queue.configure({ paused: true })
  queue.cancel(a.id)
  assert.equal(a.status, 'cancelled')
  assert.equal(b.status, 'queued', 'paused queue does not start the next job')
  queue.configure({ paused: false })
  assert.equal(b.status, 'running')
  queue.cancel(b.id)
  assert.equal(queue.clearFinished(), 2)
  assert.throws(() => queue.cancel(99), /no job 99/)
  queue.stop()
})
