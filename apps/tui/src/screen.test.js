import { test } from 'node:test'
import assert from 'node:assert/strict'
import { box, c, fitAnsi, width } from './screen.js'

test('width ignores colour codes', () => {
  assert.equal(width(c.green('done')), 4)
})

test('fitAnsi pads and cuts by visible width', () => {
  assert.equal(width(fitAnsi(c.red('ab'), 5)), 5)
  assert.equal(width(fitAnsi(c.red('abcdefgh'), 5)), 5)
})

test('box lines are all the same width', () => {
  const lines = box({ title: 'Jobs', w: 20, rows: 3, lines: ['one', c.cyan('a much longer line than fits')] })
  assert.equal(lines.length, 5)
  assert.ok(lines.every(l => width(l) === 20))
})

test('a rendered screen fits the terminal exactly', async () => {
  const { App } = await import('./app.js')
  const { ServiceManager } = await import('./services.js')
  const app = new App({ manager: new ServiceManager(), stdin: { isTTY: false }, stdout: {} })
  for (const [cols, rows] of [[60, 20], [100, 30], [140, 40]]) {
    const lines = app.render(cols, rows)
    assert.ok(lines.length <= rows, `${lines.length} lines for ${rows} rows`)
    assert.ok(lines.every(l => width(l) === cols), `every line is ${cols} wide`)
  }
})
