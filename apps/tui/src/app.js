import { emitKeypressEvents } from 'node:readline'
import { createWorkerClient, DASHBOARD_PORT, isFinished, jobTypes } from '@demo/jobs'
import { bar, clock, duration, filters, fit, statusStyle, windowAround } from './format.js'
import { beside, box, c, fitAnsi, paint, screen, width } from './screen.js'

const POLL_MS = 1000

const serviceStyle = {
  stopped: { color: 'gray', word: 'stopped' },
  starting: { color: 'yellow', word: 'starting' },
  running: { color: 'green', word: 'running' },
  stopping: { color: 'yellow', word: 'stopping' },
  crashed: { color: 'red', word: 'crashed' },
  external: { color: 'green', word: 'running, started outside the TUI' }
}

const keys = [
  ['↑ ↓', 'select a job (or j and k)'],
  ['w d', 'start or stop the worker or the dashboard'],
  ['W D', 'restart the worker or the dashboard'],
  ['l', 'show the job log, worker log or dashboard log'],
  ['n', 'start a job'],
  ['c', 'cancel the selected job'],
  ['r', 'retry the selected job'],
  ['p', 'pause or resume the queue'],
  ['+ -', 'run more or fewer jobs at once'],
  ['f', 'filter by status'],
  ['x', 'clear finished jobs'],
  ['q', 'quit (stops what the TUI started)']
]

/**
 * The TUI: polls the worker and the dashboard once a second, starts and stops
 * them through the ServiceManager, and redraws the whole screen on change.
 */
export class App {
  constructor({ manager, workerUrl, dashboardUrl = `http://localhost:${DASHBOARD_PORT}`, stdin = process.stdin, stdout = process.stdout }) {
    this.manager = manager
    this.client = createWorkerClient(workerUrl)
    this.dashboardUrl = dashboardUrl
    this.stdin = stdin
    this.stdout = stdout
    this.state = {
      worker: { up: false, checked: false },
      dashboard: { up: false, checked: false },
      jobs: [],
      detail: null,
      selectedId: null,
      filter: 'all',
      mode: 'list', // list | new | help
      view: 'job', // job | worker | dashboard: what the right panel shows
      flash: null
    }
    this.interactive = Boolean(stdin.isTTY && stdin.setRawMode)
  }

  start() {
    this.stdout.write(screen.enter())
    if (this.interactive) {
      emitKeypressEvents(this.stdin)
      this.stdin.setRawMode(true)
      this.stdin.on('keypress', (str, key) => this.onKey(str ?? '', key ?? {}))
      this.stdin.resume()
    }
    this.stdout.on('resize', () => this.draw())
    this.manager.on('change', () => this.scheduleDraw())
    this.timer = setInterval(() => this.refresh(), POLL_MS)
    this.refresh()
    this.draw()
    return new Promise((resolve) => {
      this.resolveExit = resolve
    })
  }

  quit() {
    clearInterval(this.timer)
    this.manager.stopAll()
    if (this.interactive) this.stdin.setRawMode(false)
    this.stdin.pause()
    this.stdout.write(screen.leave())
    this.resolveExit?.()
  }

  set(patch) {
    Object.assign(this.state, patch)
    this.scheduleDraw()
  }

  scheduleDraw() {
    this.drawTimer ??= setTimeout(() => {
      this.drawTimer = undefined
      this.draw()
    }, 30)
  }

  say(text, color = 'green') {
    clearTimeout(this.flashTimer)
    this.set({ flash: { text, color } })
    this.flashTimer = setTimeout(() => this.set({ flash: null }), 3000)
  }

  get visible() {
    const { jobs, filter } = this.state
    return jobs.filter(j => filter === 'all' || j.status === filter)
  }

  get selectedIndex() {
    return Math.max(0, this.visible.findIndex(j => j.id === this.state.selectedId))
  }

  get selected() {
    return this.visible[this.selectedIndex]
  }

  async refresh() {
    this.manager.refresh()
    const [health, list] = await Promise.allSettled([this.client.health(), this.client.list()])
    const patch = {}
    patch.worker = health.status === 'fulfilled' ? { up: true, checked: true, ...health.value } : { up: false, checked: true }
    patch.jobs = list.status === 'fulfilled' ? list.value : (health.status === 'fulfilled' ? this.state.jobs : [])
    try {
      const res = await fetch(`${this.dashboardUrl}/api/health`, { signal: AbortSignal.timeout(1500) })
      patch.dashboard = { up: res.ok, checked: true, ...(await res.json()) }
    } catch {
      patch.dashboard = { up: false, checked: true }
    }
    this.set(patch)
    // Keep the selection on a real row, and load that job's log.
    const first = this.visible[0]
    if (!this.selected && first) this.state.selectedId = first.id
    const job = this.selected
    if (job && this.state.view === 'job') {
      this.client.get(job.id).then(detail => this.set({ detail }), () => this.set({ detail: null }))
    }
  }

  async act(label, fn) {
    try {
      await fn()
      this.say(label)
      this.refresh()
    } catch (e) {
      this.say(e.message, 'red')
    }
  }

  move(by) {
    const next = this.visible[Math.min(Math.max(0, this.selectedIndex + by), this.visible.length - 1)]
    if (next) {
      this.set({ selectedId: next.id, detail: null })
      this.refresh()
    }
  }

  onKey(input, key) {
    const { mode, worker, filter, view } = this.state
    if (key.ctrl && key.name === 'c') return this.quit()

    if (mode === 'new') {
      if (key.name === 'escape' || input === 'n') return this.set({ mode: 'list' })
      const n = Number(input)
      if (n >= 1 && n <= jobTypes.length) {
        const type = jobTypes[n - 1]
        this.set({ mode: 'list' })
        return this.act(`Started ${type.label}`, () => this.client.start(type.id, { source: 'tui' }))
      }
      if (input === 'a') {
        this.set({ mode: 'list' })
        return this.act('Started 5 random jobs', () => this.client.start('random', { source: 'tui', count: 5 }))
      }
      return
    }
    if (mode === 'help') return this.set({ mode: 'list' })

    if (input === 'q') return this.quit()
    if (input === '?' || input === 'h') return this.set({ mode: 'help' })
    if (key.name === 'up' || input === 'k') return this.move(-1)
    if (key.name === 'down' || input === 'j') return this.move(1)
    if (key.name === 'pageup') return this.move(-10)
    if (key.name === 'pagedown') return this.move(10)

    const service = this.manager.services.find(s => s.key === input.toLowerCase())
    if (service) {
      const name = service.label.toLowerCase()
      if (input === service.key.toUpperCase()) return this.act(`Restarted the ${name}`, () => this.manager.restart(service.id))
      if (service.status === 'external') return this.say(`The ${name} was started outside the TUI, so it can't be stopped here.`, 'yellow')
      return this.act(service.child ? `Stopped the ${name}` : `Starting the ${name}`, () => this.manager.toggle(service.id))
    }
    if (input === 'l') {
      const views = ['job', ...this.manager.services.map(s => s.id)]
      return this.set({ view: views[(views.indexOf(view) + 1) % views.length] })
    }
    if (input === 'n') return this.set({ mode: 'new' })
    if (input === 'f') return this.set({ filter: filters[(filters.indexOf(filter) + 1) % filters.length] })
    const job = this.selected
    if (input === 'c' && job) return this.act(`Cancelled #${job.id}`, () => this.client.cancel(job.id))
    if (input === 'r' && job) return this.act(`Queued #${job.id} again`, () => this.client.retry(job.id))
    if (input === 'p') return this.act(worker.paused ? 'Queue resumed' : 'Queue paused', () => this.client.setQueue({ paused: !worker.paused }))
    const slots = worker.concurrency ?? 3
    if (input === '+' || input === '=') return this.act(`Running ${slots + 1} at a time`, () => this.client.setQueue({ concurrency: slots + 1 }))
    if (input === '-') return this.act(`Running ${Math.max(1, slots - 1)} at a time`, () => this.client.setQueue({ concurrency: Math.max(1, slots - 1) }))
    if (input === 'x') return this.act('Cleared finished jobs', () => this.client.clearFinished())
  }

  draw() {
    this.stdout.write(screen.frame(this.render(this.stdout.columns || 100, this.stdout.rows || 30)))
  }

  /** The whole screen as an array of lines. Pure, so it's easy to test. */
  render(cols, rows) {
    const { worker, mode, view } = this.state
    const services = this.manager.services
    const wide = cols >= 80
    const leftW = wide ? Math.floor(cols * 0.58) : cols
    const listRows = Math.max(3, rows - 10)

    const header = `${c.bold(c.magenta(' Jobs demo'))}${c.dim(cols >= 70 ? '  terminal UI · services, queue and jobs' : '')}`
    const right = c.dim(`${worker.node && cols >= 90 ? `node ${worker.node}  ` : ''}${clock(new Date().toISOString())} `)
    const lines = [header + ' '.repeat(Math.max(1, cols - width(header) - width(right))) + right]

    lines.push(...box({ title: `${c.bold('Services')} ${c.dim('w/d start or stop · W/D restart · l logs')}`, w: cols, rows: services.length + 1, lines: [
      ...services.map(s => this.serviceLine(s)),
      this.queueLine()
    ] }))

    const left = mode === 'new'
      ? box({ title: c.bold('Start a job'), w: leftW, rows: listRows, color: 'magenta', lines: [
          ...jobTypes.map((t, i) => `${c.magenta(` ${i + 1} `)}${t.label}${c.dim(`  about ${t.seconds}s`)}`),
          `${c.magenta(' a ')}5 random jobs`,
          c.dim(' esc to go back')
        ] })
      : mode === 'help'
        ? box({ title: c.bold('Keys'), w: leftW, rows: listRows, color: 'magenta', lines: [
            ...keys.map(([k, what]) => `${c.magenta(fit(k, 6))}${what}`),
            c.dim('Any key to go back')
          ] })
        : !wide && view !== 'job'
          // Too narrow for two panels: the log takes the list's place.
          ? this.serviceLog(services.find(s => s.id === view), cols, listRows)
          : this.jobList(leftW, listRows)

    const rightPanel = !wide
      ? []
      : view === 'job' ? this.jobDetail(cols - leftW, listRows) : this.serviceLog(services.find(s => s.id === view), cols - leftW, listRows)

    lines.push(...beside(left, rightPanel))
    lines.push(this.footer())
    // Never wider or taller than the terminal: a wrapped line would scroll
    // the whole screen up by one.
    return lines.slice(0, rows).map(l => fitAnsi(l, cols))
  }

  serviceLine(s) {
    const style = serviceStyle[s.status]
    const uptime = s.startedAt ? duration((Date.now() - s.startedAt.getTime()) / 1000) : (s.exitCode != null ? `exit ${s.exitCode}` : '')
    const { worker, dashboard } = this.state
    const health = s.id === 'worker' && worker.up
      ? `${worker.concurrency} jobs at a time`
      : s.id === 'dashboard' && dashboard.up ? 'answering' : ''
    const note = s.status === 'starting' || s.status === 'crashed' ? (s.logs.at(-1)?.message ?? '') : health
    return `${paint(style.color, '●')} ${c.magenta(`[${s.key}]`)} ${fit(s.label, 10)}${paint(style.color, fit(style.word, s.status === 'external' ? 33 : 9))} ${c.dim(fit(`:${s.port}`, 6))}${c.dim(fit(uptime, 8))}${c.dim(note)}`
  }

  queueLine() {
    const { worker } = this.state
    const counts = worker.counts ?? {}
    const dot = paint(!worker.up ? 'gray' : worker.paused ? 'yellow' : 'green', '●')
    if (!worker.up) return `${dot} ${c.magenta('[p]')} ${fit('Queue', 10)}${c.dim('needs the worker')}`
    return `${dot} ${c.magenta('[p]')} ${fit('Queue', 10)}${paint(worker.paused ? 'yellow' : 'green', fit(worker.paused ? 'paused' : 'running', 9))} `
      + `${c.cyan(`${counts.running ?? 0} running`)}  ${c.gray(`${counts.queued ?? 0} queued`)}  ${c.green(`${counts.completed ?? 0} done`)}  ${c.red(`${counts.failed ?? 0} failed`)}  ${c.yellow(`${counts.cancelled ?? 0} cancelled`)}`
  }

  jobList(w, rows) {
    const { jobs, filter, worker } = this.state
    const visible = this.visible
    const { start, rows: shown } = windowAround(visible, this.selectedIndex, rows)
    const labelWidth = Math.max(8, w - 36)
    const title = `${c.bold('Jobs')} ${c.dim(filter === 'all' ? `(${jobs.length})` : `(${visible.length} ${filter} of ${jobs.length})`)}`
    const lines = shown.map((job, i) => {
      const style = statusStyle[job.status]
      const selected = start + i === this.selectedIndex
      const name = `${fit(`#${job.id}`, 5)}${fit(job.label, labelWidth)}`
      return `${c.magenta(selected ? '› ' : '  ')}${selected ? c.inverse(name) : name}${paint(style.color, ` ${style.symbol} `)}${job.status === 'running'
        ? c.cyan(`${bar(job.progress, 10)} ${String(job.progress).padStart(3)}%`)
        : paint(style.color, style.word)}`
    })
    if (!lines.length) lines.push(c.dim(worker.up ? 'No jobs here. Press n to start one, or use the dashboard.' : 'The worker isn\'t running. Press w to start it.'))
    return box({ title, w, rows, lines })
  }

  jobDetail(w, rows) {
    const job = this.state.detail?.id === this.selected?.id ? this.state.detail : this.selected
    if (!job) return box({ w, rows, lines: [c.dim('Select a job to see its log. l shows the service logs.')] })
    const style = statusStyle[job.status]
    return box({
      title: c.bold(`#${job.id} ${job.label}`),
      w,
      rows,
      color: style.color,
      lines: [
        `${paint(style.color, style.word)}${c.dim(` · step ${job.step}/${job.steps} · attempt ${job.attempts} · from ${job.source}`)}`,
        job.error ? c.red(job.error) : c.dim(isFinished(job.status) ? 'Press r to run it again.' : 'Press c to cancel it.'),
        ...(job.logs ?? []).slice(-(rows - 2)).map(log =>
          `${c.dim(clock(log.at))} ${paint(log.level === 'error' ? 'red' : log.level === 'warn' ? 'yellow' : null, log.message)}`)
      ]
    })
  }

  serviceLog(s, w, rows) {
    const style = serviceStyle[s.status]
    const lines = s.logs.slice(-rows).map(log => `${c.dim(clock(log.at))} ${log.message}`)
    if (!lines.length) lines.push(c.dim(s.status === 'external' ? 'Started outside the TUI, so its output goes elsewhere.' : `Nothing yet. Press ${s.key} to start it.`))
    return box({ title: `${c.bold(`${s.label} log`)} ${c.dim('l for the next one')}`, w, rows, color: style.color, lines })
  }

  footer() {
    const { flash, worker } = this.state
    if (!this.interactive) return c.yellow(' This terminal can\'t send key presses, so the TUI is read-only here.')
    if (flash) return paint(flash.color, ` ${flash.text}`)
    return c.dim(` ↑↓ select  n new  c cancel  r retry  ${worker.paused ? 'p resume' : 'p pause'}  w worker  d dashboard  l logs  ? help  q quit`)
  }
}
