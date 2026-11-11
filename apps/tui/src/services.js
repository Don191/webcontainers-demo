import { spawn } from 'node:child_process'
import { EventEmitter } from 'node:events'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DASHBOARD_PORT, WORKER_PORT } from '@demo/jobs'

const root = fileURLToPath(new URL('../../../', import.meta.url))
const require = createRequire(`${root}apps/dashboard/package.json`)
const MAX_LINES = 300

// eslint-disable-next-line no-control-regex
const ansi = /\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~]|\][^\x07]*\x07)/g

/**
 * The apps the TUI can start and stop. Each one is run straight with Node
 * (no `yarn run`), which works the same on a laptop and in a WebContainer.
 */
export const serviceDefs = [
  {
    id: 'worker',
    label: 'Worker',
    key: 'w',
    port: WORKER_PORT,
    health: `http://localhost:${WORKER_PORT}/health`,
    cwd: `${root}apps/worker`,
    args: () => ['src/index.js'],
    env: {}
  },
  {
    id: 'dashboard',
    label: 'Dashboard',
    key: 'd',
    port: DASHBOARD_PORT,
    health: `http://localhost:${DASHBOARD_PORT}/api/health`,
    cwd: `${root}apps/dashboard`,
    // --no-fork keeps Nuxt in this one process, so stopping it stops the server.
    args: () => [join(dirname(require.resolve('nuxt/package.json')), 'bin/nuxt.mjs'), 'dev', '--port', String(DASHBOARD_PORT), '--no-fork'],
    // Plain log lines instead of Nuxt's own interactive screen.
    env: { NUXT_TUI: 'plain' }
  }
]

/**
 * Starts, stops and restarts the services, keeping a short log for each.
 * Emits 'change' whenever a status or log changes.
 *
 * Status is one of: stopped, starting, running, stopping, crashed, external
 * (something else is already serving that port, so the TUI leaves it alone).
 */
export class ServiceManager extends EventEmitter {
  constructor(defs = serviceDefs) {
    super()
    this.services = defs.map(def => ({
      ...def,
      status: 'stopped',
      pid: null,
      startedAt: null,
      exitCode: null,
      logs: [],
      child: null
    }))
  }

  get(id) {
    return this.services.find(s => s.id === id)
  }

  /** Is anything answering on this service's health URL? */
  async probe(service) {
    try {
      const res = await fetch(service.health, { signal: AbortSignal.timeout(1500) })
      return res.ok
    } catch {
      return false
    }
  }

  /** Called on every poll: moves starting → running once it answers. */
  async refresh() {
    await Promise.all(this.services.map(async (s) => {
      const up = await this.probe(s)
      if (s.child) {
        if (up && s.status === 'starting') this.set(s, { status: 'running' })
      } else if (up && s.status !== 'external') {
        this.set(s, { status: 'external' })
      } else if (!up && s.status === 'external') {
        this.set(s, { status: 'stopped' })
      }
    }))
  }

  async start(id) {
    const s = this.get(id)
    if (s.child) return
    if (await this.probe(s)) {
      this.set(s, { status: 'external' })
      this.log(s, `Something is already serving port ${s.port}, so it wasn't started again.`)
      return
    }
    this.log(s, `Starting ${s.label}…`)
    const child = spawn(process.execPath, s.args(), {
      cwd: s.cwd,
      env: { ...process.env, FORCE_COLOR: '0', NODE_NO_WARNINGS: '1', ...s.env },
      stdio: ['ignore', 'pipe', 'pipe']
    })
    this.set(s, { child, status: 'starting', pid: child.pid, startedAt: new Date(), exitCode: null })
    let partial = ''
    const onData = (chunk) => {
      const lines = (partial + chunk).split(/\r?\n/)
      partial = lines.pop()
      for (const line of lines) {
        const clean = line.replace(ansi, '').trimEnd()
        if (clean) this.log(s, clean)
      }
    }
    child.stdout.setEncoding('utf8').on('data', onData)
    child.stderr.setEncoding('utf8').on('data', onData)
    child.on('exit', (code, signal) => {
      if (s.child !== child) return
      const stopped = s.status === 'stopping'
      this.log(s, stopped ? 'Stopped' : `Exited with ${signal ?? `code ${code}`}`)
      this.set(s, { child: null, pid: null, startedAt: null, status: stopped || code === 0 ? 'stopped' : 'crashed', exitCode: code })
    })
  }

  async stop(id) {
    const s = this.get(id)
    if (!s.child) {
      if (s.status === 'external') this.log(s, `${s.label} wasn't started by the TUI, so it can't stop it.`)
      return
    }
    this.set(s, { status: 'stopping' })
    const child = s.child
    child.kill('SIGTERM')
    // Give it a moment to exit cleanly, then make sure.
    const timer = setTimeout(() => child.kill('SIGKILL'), 4000)
    await new Promise(resolve => child.once('exit', resolve))
    clearTimeout(timer)
  }

  async toggle(id) {
    const s = this.get(id)
    return s.child ? this.stop(id) : this.start(id)
  }

  async restart(id) {
    await this.stop(id)
    await this.start(id)
  }

  /** Start everything that isn't already up. */
  async startAll() {
    await Promise.all(this.services.map(s => this.start(s.id)))
  }

  /** Stop what the TUI started. Used on quit. */
  stopAll() {
    for (const s of this.services) s.child?.kill('SIGTERM')
  }

  log(s, message) {
    s.logs.push({ at: new Date().toISOString(), message })
    if (s.logs.length > MAX_LINES) s.logs.splice(0, s.logs.length - MAX_LINES)
    this.emit('change')
  }

  set(s, patch) {
    Object.assign(s, patch)
    this.emit('change')
  }

  /** A plain copy for React state. */
  snapshot() {
    return this.services.map(({ child, ...s }) => ({ ...s, logs: s.logs.slice(-60), owned: Boolean(child) }))
  }
}
