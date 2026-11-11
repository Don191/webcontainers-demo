import { Box, Text, useApp, useInput, useStdin, useStdout } from 'ink'
import { createElement as h, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createWorkerClient, DASHBOARD_PORT, isFinished, jobTypes } from '@demo/jobs'
import { bar, clock, duration, filters, fit, statusStyle, windowAround } from './format.js'

const POLL_MS = 1000

/**
 * The whole TUI. It polls the worker and the dashboard once a second and
 * draws three panels: component status, the job list and the selected job.
 * Ink re-renders only what changed, so it stays smooth in a small terminal.
 */
export function App({ workerUrl, dashboardUrl = `http://localhost:${DASHBOARD_PORT}` }) {
  const { exit } = useApp()
  const { isRawModeSupported } = useStdin()
  const size = useTerminalSize()
  const client = useMemo(() => createWorkerClient(workerUrl), [workerUrl])

  const [worker, setWorker] = useState({ up: false, checked: false })
  const [dashboard, setDashboard] = useState({ up: false, checked: false })
  const [jobs, setJobs] = useState([])
  const [detail, setDetail] = useState(null)
  const [selectedId, setSelectedId] = useState(null)
  const [filter, setFilter] = useState('all')
  const [mode, setMode] = useState('list') // list | new | help
  const [flash, setFlash] = useState(null)
  const [now, setNow] = useState(() => new Date())
  const flashTimer = useRef()

  const say = useCallback((text, color = 'green') => {
    clearTimeout(flashTimer.current)
    setFlash({ text, color })
    flashTimer.current = setTimeout(() => setFlash(null), 3000)
  }, [])

  const visible = useMemo(() => jobs.filter(j => filter === 'all' || j.status === filter), [jobs, filter])
  const selectedIndex = Math.max(0, visible.findIndex(j => j.id === selectedId))
  const selected = visible[selectedIndex]

  const refresh = useCallback(async () => {
    setNow(new Date())
    const [health, list] = await Promise.allSettled([client.health(), client.list()])
    if (health.status === 'fulfilled') setWorker({ up: true, checked: true, ...health.value })
    else setWorker({ up: false, checked: true, error: health.reason?.message })
    if (list.status === 'fulfilled') setJobs(list.value)

    try {
      const res = await fetch(`${dashboardUrl}/api/health`, { signal: AbortSignal.timeout(1500) })
      const body = await res.json()
      setDashboard({ up: res.ok, checked: true, ...body })
    } catch (e) {
      setDashboard({ up: false, checked: true, error: e.message })
    }
  }, [client, dashboardUrl])

  useEffect(() => {
    refresh()
    const timer = setInterval(refresh, POLL_MS)
    return () => clearInterval(timer)
  }, [refresh])

  // Keep the selection on a real row, and load that job's log.
  useEffect(() => {
    if (!selected && visible.length) setSelectedId(visible[0].id)
  }, [selected, visible])
  useEffect(() => {
    if (!selected) return setDetail(null)
    client.get(selected.id).then(setDetail).catch(() => setDetail(null))
  }, [client, selected?.id, selected?.status, selected?.step])

  const act = useCallback(async (label, fn) => {
    try {
      await fn()
      say(label)
      refresh()
    } catch (e) {
      say(e.message, 'red')
    }
  }, [refresh, say])

  const move = (by) => {
    const next = visible[Math.min(Math.max(0, selectedIndex + by), visible.length - 1)]
    if (next) setSelectedId(next.id)
  }

  useInput((input, key) => {
    if (mode === 'new') {
      if (key.escape || input === 'n') return setMode('list')
      const n = Number(input)
      if (n >= 1 && n <= jobTypes.length) {
        const type = jobTypes[n - 1]
        setMode('list')
        return act(`Started ${type.label}`, () => client.start(type.id, { source: 'tui' }))
      }
      if (input === 'a') {
        setMode('list')
        return act('Started 5 random jobs', () => client.start('random', { source: 'tui', count: 5 }))
      }
      return
    }
    if (mode === 'help') return setMode('list')

    if (input === 'q') return exit()
    if (input === '?' || input === 'h') return setMode('help')
    if (key.upArrow || input === 'k') return move(-1)
    if (key.downArrow || input === 'j') return move(1)
    if (key.pageUp) return move(-10)
    if (key.pageDown) return move(10)
    if (input === 'g') return visible[0] && setSelectedId(visible[0].id)
    if (input === 'G') return visible.at(-1) && setSelectedId(visible.at(-1).id)
    if (input === 'n') return setMode('new')
    if (input === 'f') return setFilter(filters[(filters.indexOf(filter) + 1) % filters.length])
    if (input === 'c' && selected) return act(`Cancelled #${selected.id}`, () => client.cancel(selected.id))
    if (input === 'r' && selected) return act(`Queued #${selected.id} again`, () => client.retry(selected.id))
    if (input === 'p') return act(worker.paused ? 'Queue resumed' : 'Queue paused', () => client.setQueue({ paused: !worker.paused }))
    if (input === '+' || input === '=') return act(`Running ${(worker.concurrency ?? 3) + 1} at a time`, () => client.setQueue({ concurrency: (worker.concurrency ?? 3) + 1 }))
    if (input === '-') return act(`Running ${Math.max(1, (worker.concurrency ?? 3) - 1)} at a time`, () => client.setQueue({ concurrency: Math.max(1, (worker.concurrency ?? 3) - 1) }))
    if (input === 'x') return act('Cleared finished jobs', () => client.clearFinished())
  }, { isActive: isRawModeSupported })

  const wide = size.columns >= 96
  // Rows left for the job list after the header, status panel and footer.
  const listRows = Math.max(3, size.rows - 12)

  return h(Box, { flexDirection: 'column', width: size.columns },
    h(Header, { now, worker }),
    h(Components, { worker, dashboard, dashboardUrl, width: size.columns }),
    h(Box, null,
      mode === 'new'
        ? h(NewJob, { width: wide ? Math.floor(size.columns * 0.58) : size.columns, height: listRows })
        : mode === 'help'
          ? h(Help, { width: wide ? Math.floor(size.columns * 0.58) : size.columns, height: listRows })
          : h(JobList, { jobs: visible, total: jobs.length, selectedIndex, filter, width: wide ? Math.floor(size.columns * 0.58) : size.columns, height: listRows, workerUp: worker.up }),
      wide && h(JobDetail, { job: detail ?? selected, width: size.columns - Math.floor(size.columns * 0.58), height: listRows })
    ),
    h(Footer, { flash, interactive: isRawModeSupported, paused: worker.paused })
  )
}

function Header({ now, worker }) {
  return h(Box, { justifyContent: 'space-between', paddingX: 1 },
    h(Text, null, h(Text, { bold: true, color: 'magentaBright' }, 'Jobs demo'), h(Text, { dimColor: true }, '  terminal UI · worker, dashboard and queue')),
    h(Text, { dimColor: true }, worker.node ? `node ${worker.node}  ` : '', clock(now.toISOString()))
  )
}

function Dot({ up, checked }) {
  return h(Text, { color: !checked ? 'gray' : up ? 'green' : 'red' }, '●')
}

function Components({ worker, dashboard, dashboardUrl, width }) {
  const counts = worker.counts ?? {}
  return h(Box, { borderStyle: 'round', borderColor: 'gray', flexDirection: 'column', paddingX: 1, width },
    h(Text, { bold: true }, 'Components'),
    h(Box, { gap: 1 },
      h(Dot, worker),
      h(Text, null, fit('Worker', 10)),
      worker.up
        ? h(Text, null, h(Text, { color: 'green' }, 'up'), h(Text, { dimColor: true }, ` ${duration(worker.uptime)} · :4100 · ${worker.concurrency} at a time`))
        : h(Text, { color: worker.checked ? 'red' : 'gray' }, worker.checked ? 'down · start it with yarn dev' : 'checking…')
    ),
    h(Box, { gap: 1 },
      h(Dot, dashboard),
      h(Text, null, fit('Dashboard', 10)),
      dashboard.up
        ? h(Text, null, h(Text, { color: 'green' }, 'up'), h(Text, { dimColor: true }, ` ${duration(dashboard.uptime ?? 0)} · ${dashboardUrl.replace(/^https?:\/\//, '')}`))
        : h(Text, { color: dashboard.checked ? 'yellow' : 'gray' }, dashboard.checked ? 'not answering yet (Nuxt takes a moment to start)' : 'checking…')
    ),
    h(Box, { gap: 1 },
      h(Dot, { up: worker.up && !worker.paused, checked: worker.checked }),
      h(Text, null, fit('Queue', 10)),
      worker.up
        ? h(Text, null,
            h(Text, { color: worker.paused ? 'yellow' : 'green' }, worker.paused ? 'paused' : 'running'),
            h(Text, { color: 'cyan' }, `  ${counts.running ?? 0} running`),
            h(Text, { color: 'gray' }, `  ${counts.queued ?? 0} queued`),
            h(Text, { color: 'green' }, `  ${counts.completed ?? 0} done`),
            h(Text, { color: 'red' }, `  ${counts.failed ?? 0} failed`),
            h(Text, { color: 'yellow' }, `  ${counts.cancelled ?? 0} cancelled`))
        : h(Text, { dimColor: true }, '–')
    )
  )
}

function JobList({ jobs, total, selectedIndex, filter, width, height, workerUp }) {
  const { start, rows } = windowAround(jobs, selectedIndex, height)
  const inner = width - 4
  const labelWidth = Math.max(8, inner - 32)
  return h(Box, { borderStyle: 'round', borderColor: 'gray', flexDirection: 'column', paddingX: 1, width, height: height + 3 },
    h(Text, { bold: true }, 'Jobs ', h(Text, { dimColor: true }, filter === 'all' ? `(${total})` : `(${jobs.length} ${filter} of ${total})`)),
    !rows.length && h(Text, { dimColor: true }, workerUp ? 'No jobs here. Press n to start one, or use the dashboard.' : 'Waiting for the worker…'),
    ...rows.map((job, i) => {
      const style = statusStyle[job.status]
      const isSelected = start + i === selectedIndex
      return h(Box, { key: job.id },
        h(Text, { color: 'magentaBright' }, isSelected ? '› ' : '  '),
        h(Text, { inverse: isSelected }, fit(`#${job.id}`, 5), fit(job.label, labelWidth)),
        h(Text, { color: style.color }, ` ${style.symbol} `),
        job.status === 'running'
          ? h(Text, { color: 'cyan' }, `${bar(job.progress, 10)} ${String(job.progress).padStart(3)}%`)
          : h(Text, { color: style.color }, fit(style.word, 15))
      )
    })
  )
}

function JobDetail({ job, width, height }) {
  if (!job) {
    return h(Box, { borderStyle: 'round', borderColor: 'gray', paddingX: 1, width, height: height + 3 },
      h(Text, { dimColor: true }, 'Select a job to see its log.'))
  }
  const style = statusStyle[job.status]
  const logs = (job.logs ?? []).slice(-(height - 3))
  return h(Box, { borderStyle: 'round', borderColor: style.color, flexDirection: 'column', paddingX: 1, width, height: height + 3 },
    h(Text, { bold: true, wrap: 'truncate' }, `#${job.id} ${job.label}`),
    h(Text, { wrap: 'truncate' },
      h(Text, { color: style.color }, style.word),
      h(Text, { dimColor: true }, ` · step ${job.step}/${job.steps} · attempt ${job.attempts} · from ${job.source}`)),
    job.error ? h(Text, { color: 'red', wrap: 'truncate' }, job.error) : h(Text, { dimColor: true }, isFinished(job.status) ? 'Press r to run it again.' : 'Press c to cancel it.'),
    ...logs.map((log, i) => h(Text, { key: i, wrap: 'truncate' },
      h(Text, { dimColor: true }, `${clock(log.at)} `),
      h(Text, { color: log.level === 'error' ? 'red' : log.level === 'warn' ? 'yellow' : undefined }, log.message)))
  )
}

function NewJob({ width, height }) {
  return h(Box, { borderStyle: 'round', borderColor: 'magentaBright', flexDirection: 'column', paddingX: 1, width, height: height + 3 },
    h(Text, { bold: true }, 'Start a job'),
    ...jobTypes.map((type, i) => h(Text, { key: type.id },
      h(Text, { color: 'magentaBright' }, ` ${i + 1} `), type.label, h(Text, { dimColor: true }, `  about ${type.seconds}s`))),
    h(Text, null, h(Text, { color: 'magentaBright' }, ' a '), '5 random jobs'),
    h(Text, { dimColor: true }, ' esc to go back')
  )
}

const keys = [
  ['↑ ↓', 'select a job (or j and k)'],
  ['n', 'start a job'],
  ['c', 'cancel the selected job'],
  ['r', 'retry the selected job'],
  ['p', 'pause or resume the queue'],
  ['+ -', 'run more or fewer jobs at once'],
  ['f', 'filter by status'],
  ['x', 'clear finished jobs'],
  ['q', 'quit']
]

function Help({ width, height }) {
  return h(Box, { borderStyle: 'round', borderColor: 'magentaBright', flexDirection: 'column', paddingX: 1, width, height: height + 3 },
    h(Text, { bold: true }, 'Keys'),
    ...keys.map(([k, what]) => h(Text, { key: k }, h(Text, { color: 'magentaBright' }, fit(k, 6)), what)),
    h(Text, { dimColor: true }, 'Any key to go back')
  )
}

function Footer({ flash, interactive, paused }) {
  if (!interactive) return h(Text, { color: 'yellow' }, ' This terminal can\'t send key presses, so the TUI is read-only here.')
  if (flash) return h(Text, { color: flash.color }, ` ${flash.text}`)
  return h(Text, { dimColor: true, wrap: 'truncate' },
    ' ↑↓ select  n new  c cancel  r retry  ', paused ? 'p resume' : 'p pause', '  f filter  x clear  ? help  q quit')
}

function useTerminalSize() {
  const { stdout } = useStdout()
  const read = () => ({ columns: stdout.columns || 100, rows: stdout.rows || 30 })
  const [size, setSize] = useState(read)
  useEffect(() => {
    const onResize = () => setSize(read())
    stdout.on('resize', onResize)
    return () => stdout.off('resize', onResize)
  }, [stdout])
  return size
}
