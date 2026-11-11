import { test } from 'node:test'
import assert from 'node:assert/strict'
import { bar, duration, fit, windowAround } from './format.js'

test('bar', () => {
  assert.equal(bar(0, 4), '░░░░')
  assert.equal(bar(50, 4), '██░░')
  assert.equal(bar(120, 4), '████')
})

test('duration', () => {
  assert.equal(duration(5), '5s')
  assert.equal(duration(75), '1m 15s')
  assert.equal(duration(3960), '1h 6m')
})

test('fit', () => {
  assert.equal(fit('abc', 5), 'abc  ')
  assert.equal(fit('abcdef', 4), 'abc…')
})

test('windowAround keeps the selection in view', () => {
  const items = Array.from({ length: 10 }, (_, i) => i)
  assert.deepEqual(windowAround(items, 0, 3), { start: 0, rows: [0, 1, 2] })
  assert.deepEqual(windowAround(items, 5, 3), { start: 4, rows: [4, 5, 6] })
  assert.deepEqual(windowAround(items, 9, 3), { start: 7, rows: [7, 8, 9] })
})
