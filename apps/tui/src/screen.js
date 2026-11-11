// A very small terminal drawing kit: colours, boxes and width-aware padding.
// No dependencies, so it starts instantly and runs anywhere Node does,
// including a WebContainer (where Ink's WebAssembly layout engine won't load).

const codes = {
  bold: [1, 22],
  dim: [2, 22],
  inverse: [7, 27],
  red: [31, 39],
  green: [32, 39],
  yellow: [33, 39],
  cyan: [36, 39],
  gray: [90, 39],
  magenta: [95, 39]
}

/** c.green('ok'), c.bold('x') … */
export const c = Object.fromEntries(Object.entries(codes).map(([name, [open, close]]) =>
  [name, text => `\x1b[${open}m${text}\x1b[${close}m`]))

/** Paint with a colour name, or leave as is. */
export const paint = (color, text) => (color && c[color] ? c[color](text) : text)

// eslint-disable-next-line no-control-regex
const ansi = /\x1b\[[0-9;?]*[A-Za-z]/g

export const strip = text => String(text).replace(ansi, '')

/** Visible length (ANSI codes don't count). */
export const width = text => [...strip(text)].length

/**
 * Pad or cut to exactly `w` visible characters, keeping colour codes intact.
 * Cut text ends in "…".
 */
export function fitAnsi(text, w) {
  const s = String(text)
  if (w <= 0) return ''
  const len = width(s)
  if (len <= w) return s + ' '.repeat(w - len)
  let out = ''
  let seen = 0
  for (const part of s.split(/(\x1b\[[0-9;?]*[A-Za-z])/)) {
    if (part.startsWith('\x1b')) {
      out += part
      continue
    }
    for (const ch of part) {
      if (seen >= w - 1) break
      out += ch
      seen++
    }
  }
  return `${out}…\x1b[0m`
}

/**
 * A rounded box `w` wide with `rows` lines inside (padded or cut to fit).
 * Returns an array of lines.
 */
export function box({ title = '', lines = [], w, rows, color = 'gray' }) {
  const inner = w - 4
  const top = paint(color, '╭') + (title ? ` ${fitAnsi(title, Math.min(width(title), inner - 1))} ` : '') + paint(color, '─'.repeat(Math.max(0, w - 2 - (title ? Math.min(width(title), inner - 1) + 2 : 0))) + '╮')
  const body = Array.from({ length: rows }, (_, i) => `${paint(color, '│')} ${fitAnsi(lines[i] ?? '', inner)} ${paint(color, '│')}`)
  return [top, ...body, paint(color, `╰${'─'.repeat(w - 2)}╯`)]
}

/** Put two blocks of lines side by side. */
export function beside(left, right) {
  const n = Math.max(left.length, right.length)
  return Array.from({ length: n }, (_, i) => (left[i] ?? '') + (right[i] ?? ''))
}

export const screen = {
  enter: () => '\x1b[?1049h\x1b[?25l',
  leave: () => '\x1b[?25h\x1b[?1049l',
  // Home, draw each line clearing what's left of it, clear below.
  frame: lines => `\x1b[H${lines.map(l => `${l}\x1b[0m\x1b[K`).join('\r\n')}\x1b[J`
}
