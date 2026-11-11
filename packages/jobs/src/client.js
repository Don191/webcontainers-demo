import { WORKER_PORT } from './catalog.js'

/**
 * A tiny client for the worker's HTTP API. Works anywhere `fetch` does:
 * Node 18+, the browser and a WebContainer.
 *
 * @param {string} [baseUrl]
 */
export function createWorkerClient(baseUrl = `http://localhost:${WORKER_PORT}`) {
  const base = baseUrl.replace(/\/$/, '')

  /**
   * @param {string} path
   * @param {RequestInit & { json?: unknown }} [init]
   */
  async function request(path, init = {}) {
    const { json, ...rest } = init
    const res = await fetch(`${base}${path}`, {
      ...rest,
      headers: json === undefined ? rest.headers : { 'content-type': 'application/json', ...rest.headers },
      body: json === undefined ? rest.body : JSON.stringify(json),
      signal: rest.signal ?? AbortSignal.timeout(4000)
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(body.error || `${res.status} ${res.statusText}`)
    return body
  }

  return {
    /** @returns {Promise<object>} */
    health: () => request('/health'),
    /** @returns {Promise<import('./catalog.js').Job[]>} */
    list: () => request('/jobs'),
    /** @param {number} id @returns {Promise<import('./catalog.js').Job>} */
    get: id => request(`/jobs/${id}`),
    /** @param {string} type @param {{ source?: string, count?: number }} [opts] */
    start: (type, opts = {}) => request('/jobs', { method: 'POST', json: { type, ...opts } }),
    /** @param {number} id */
    cancel: id => request(`/jobs/${id}/cancel`, { method: 'POST' }),
    /** @param {number} id */
    retry: id => request(`/jobs/${id}/retry`, { method: 'POST' }),
    clearFinished: () => request('/jobs?finished=1', { method: 'DELETE' }),
    /** @param {{ paused?: boolean, concurrency?: number }} settings */
    setQueue: settings => request('/queue', { method: 'POST', json: settings })
  }
}
