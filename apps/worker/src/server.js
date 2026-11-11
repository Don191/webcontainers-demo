import { createServer } from 'node:http'
import { jobTypes } from '@demo/jobs'

/**
 * The worker's HTTP API. Plain node:http, so there's nothing to install.
 *
 *   GET    /health            worker status and queue counts
 *   GET    /job-types         what can be started
 *   GET    /jobs              every job, newest first
 *   GET    /jobs/:id          one job with its log
 *   POST   /jobs              { type, source?, count? } start one or more jobs
 *   POST   /jobs/:id/cancel
 *   POST   /jobs/:id/retry
 *   DELETE /jobs?finished=1   clear completed, failed and cancelled jobs
 *   POST   /queue             { paused?, concurrency? }
 *   GET    /events            server-sent events, one per change
 *
 * @param {import('./queue.js').JobQueue} queue
 */
export function createApi(queue) {
  const startedAt = new Date()

  const routes = [
    ['GET', /^\/health$/, () => ({
      name: 'worker',
      status: 'ok',
      startedAt: startedAt.toISOString(),
      uptime: Math.round(process.uptime()),
      node: process.version,
      ...queue.stats()
    })],
    ['GET', /^\/job-types$/, () => jobTypes],
    ['GET', /^\/jobs$/, () => queue.list().map(({ logs, ...job }) => ({ ...job, lastLog: logs.at(-1)?.message ?? null }))],
    ['GET', /^\/jobs\/(\d+)$/, (_, id) => queue.get(Number(id)) ?? notFound(id)],
    ['POST', /^\/jobs$/, (body) => {
      const count = Math.min(Math.max(Number(body.count) || 1, 1), 20)
      const types = body.type === 'random' ? null : [body.type]
      const started = []
      for (let i = 0; i < count; i++) {
        const type = types?.[0] ?? jobTypes[Math.floor(Math.random() * jobTypes.length)].id
        started.push(queue.add(type, String(body.source ?? 'api')))
      }
      return count === 1 ? started[0] : started
    }],
    ['POST', /^\/jobs\/(\d+)\/cancel$/, (_, id) => queue.cancel(Number(id))],
    ['POST', /^\/jobs\/(\d+)\/retry$/, (_, id) => queue.retry(Number(id))],
    ['DELETE', /^\/jobs$/, () => ({ removed: queue.clearFinished() })],
    ['POST', /^\/queue$/, body => queue.configure(body)]
  ]

  return createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost')
    // The dashboard proxies to us, but allow direct browser calls too.
    res.setHeader('access-control-allow-origin', '*')
    res.setHeader('access-control-allow-headers', 'content-type')
    res.setHeader('access-control-allow-methods', 'GET, POST, DELETE, OPTIONS')
    if (req.method === 'OPTIONS') return res.writeHead(204).end()

    if (req.method === 'GET' && url.pathname === '/events') return streamEvents(res, queue)

    for (const [method, pattern, handler] of routes) {
      const match = url.pathname.match(pattern)
      if (!match || method !== req.method) continue
      try {
        const body = method === 'POST' ? await readJson(req) : {}
        return send(res, 200, await handler(body, ...match.slice(1)))
      } catch (error) {
        return send(res, error.status ?? 400, { error: error.message })
      }
    }
    send(res, 404, { error: `No route for ${req.method} ${url.pathname}` })
  })
}

/** @param {import('node:http').ServerResponse} res @param {import('./queue.js').JobQueue} queue */
function streamEvents(res, queue) {
  res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', 'connection': 'keep-alive' })
  res.write(': connected\n\n')
  /** @param {import('@demo/jobs').Job} [job] */
  const onChange = (job) => {
    res.write(`data: ${JSON.stringify(job ? { id: job.id, status: job.status, progress: job.progress } : { stats: queue.stats() })}\n\n`)
  }
  queue.on('change', onChange)
  res.on('close', () => queue.off('change', onChange))
}

function notFound(id) {
  throw Object.assign(new Error(`There's no job ${id}`), { status: 404 })
}

/** @param {import('node:http').IncomingMessage} req */
async function readJson(req) {
  let raw = ''
  for await (const chunk of req) raw += chunk
  if (!raw) return {}
  try {
    return JSON.parse(raw)
  } catch {
    throw new Error('The body must be JSON')
  }
}

/** @param {import('node:http').ServerResponse} res @param {number} status @param {unknown} body */
function send(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json' })
  res.end(JSON.stringify(body))
}
