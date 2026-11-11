// Small, pure helpers for the TUI, kept apart so they're easy to test.

export const statusStyle = {
  queued: { color: 'gray', symbol: '○', word: 'queued' },
  running: { color: 'cyan', symbol: '◐', word: 'running' },
  completed: { color: 'green', symbol: '●', word: 'done' },
  failed: { color: 'red', symbol: '✕', word: 'failed' },
  cancelled: { color: 'yellow', symbol: '–', word: 'cancelled' }
}

export const filters = ['all', 'running', 'queued', 'completed', 'failed', 'cancelled']

/** A text progress bar, e.g. "████░░░░". */
export function bar(progress, width = 10) {
  const filled = Math.round((Math.max(0, Math.min(100, progress)) / 100) * width)
  return '█'.repeat(filled) + '░'.repeat(width - filled)
}

/** 75 -> "1m 15s", 4000 -> "1h 6m" */
export function duration(seconds) {
  const s = Math.max(0, Math.round(seconds))
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`
}

/** "2026-11-10T12:01:33.000Z" -> local "12:01:33" */
export function clock(iso) {
  return new Date(iso).toLocaleTimeString('en-GB', { hour12: false })
}

/** Pad or cut a string to exactly `width` characters. */
export function fit(text, width) {
  const s = String(text)
  if (width <= 0) return ''
  return s.length > width ? `${s.slice(0, Math.max(0, width - 1))}…` : s.padEnd(width)
}

/** The rows to show so the selected one stays in view. */
export function windowAround(items, selected, size) {
  if (items.length <= size) return { start: 0, rows: items }
  const start = Math.min(Math.max(0, selected - Math.floor(size / 2)), items.length - size)
  return { start, rows: items.slice(start, start + size) }
}
