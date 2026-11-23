import test from 'node:test'
import assert from 'node:assert/strict'
import { sortEventsNearestFirst } from '../src/utils/eventOrder.js'

test('upcoming events sort nearest first across Date and ISO string dates', () => {
  const events = [
    { id: 'far', date: '2026-12-20T18:00:00+07:00' },
    { id: 'near', date: new Date('2026-11-24T18:00:00+07:00') },
    { id: 'mid', date: '2026-12-01T09:00:00+07:00' }
  ]
  assert.deepEqual(sortEventsNearestFirst(events).map(e => e.id), ['near', 'mid', 'far'])
  assert.equal(events[0].id, 'far', 'input array is not mutated')
})

test('undated or invalid events sort after dated ones', () => {
  const events = [
    { id: 'none' },
    { id: 'bad', date: 'not a date' },
    { id: 'dated', date: '2026-12-01T09:00:00+07:00' }
  ]
  assert.equal(sortEventsNearestFirst(events)[0].id, 'dated')
})
