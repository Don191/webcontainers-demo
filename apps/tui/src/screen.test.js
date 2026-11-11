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
