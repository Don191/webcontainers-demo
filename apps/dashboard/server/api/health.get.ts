// The TUI polls this to show whether the dashboard is up.
const startedAt = new Date()

export default defineEventHandler(() => ({
  name: 'dashboard',
  status: 'ok',
  startedAt: startedAt.toISOString(),
  uptime: Math.round((Date.now() - startedAt.getTime()) / 1000)
}))
