import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import * as client from '../src/utils/monthlyHours.js'

const require = createRequire(import.meta.url)
const server = require('../functions/monthlyHours.js')

const at = (date, hour) => new Date(`${date}T${String(hour).padStart(2, '0')}:00:00+07:00`)
const amenityList = [{ id: 'desk-1', type: 'desk' }, { id: 'room', type: 'meeting-room' }]
const amenityMap = new Map(amenityList.map(a => [a.id, a]))
let seq = 0
const booking = (date, from, to, extra = {}) => ({
  id: `b${++seq}`,
  memberId: 'm1',
  amenityId: 'desk-1',
  status: 'approved',
  startTime: at(date, from),
  endTime: at(date, to),
  ...extra
})
// 36h already booked in March 2030: four 9h days.
const march = ['2030-03-04', '2030-03-05', '2030-03-06', '2030-03-07'].map(d => booking(d, 9, 18))

test('only plain desk bookings that are live or done count', () => {
  for (const counts of [b => client.countsTowardLimit(b, amenityList), b => server.countsTowardLimit(b, amenityMap)]) {
    assert.equal(counts(booking('2030-03-01', 9, 10)), true)
    assert.equal(counts(booking('2030-03-01', 9, 10, { status: 'completed' })), true)
    assert.equal(counts(booking('2030-03-01', 9, 10, { status: 'pending' })), true)
    assert.equal(counts(booking('2030-03-01', 9, 10, { status: 'cancelled' })), false)
    assert.equal(counts(booking('2030-03-01', 9, 10, { planType: 'fixed-desk' })), false)
    assert.equal(counts(booking('2030-03-01', 9, 10, { planType: 'partner-desk' })), false)
    assert.equal(counts(booking('2030-03-01', 9, 10, { amenityId: 'room' })), false)
  }
})

test('months are hub months, and a booking is split across them', () => {
  // 22:00 on 31 Mar to 02:00 on 1 Apr, hub time.
  const split = server.hoursByMonth(at('2030-03-31', 22), at('2030-04-01', 2))
  assert.deepEqual([...split.entries()], [['2030-03', 2], ['2030-04', 2]])
  assert.deepEqual([...client.hoursByMonth(at('2030-03-31', 22), at('2030-04-01', 2)).entries()], [...split.entries()])
  // 06:00 hub time on 1 Apr is still 31 Mar in UTC.
  assert.equal(client.hubMonthKey(at('2030-04-01', 6).getTime()), '2030-04')
})

test('a booking that fits is allowed, one that goes over is not', () => {
  const fits = booking('2030-03-08', 9, 13)
  assert.equal(server.monthOverLimit(fits, [...march, fits], amenityMap), null)
  const over = booking('2030-03-08', 9, 14, { status: 'pending' })
  assert.deepEqual(server.monthOverLimit(over, [...march, over], amenityMap), { month: '2030-03', hoursLeft: 4 })
})

test('exactly 40 hours is allowed', () => {
  const forty = Array.from({ length: 40 }, (_, i) => booking('2030-05-02', 0, 1, { id: `h${i}`, startTime: new Date(at('2030-05-02', 0).getTime() + i * 3600e3), endTime: new Date(at('2030-05-02', 1).getTime() + i * 3600e3) }))
  const last = forty[39]
  assert.equal(server.monthOverLimit(last, forty, amenityMap), null)
})

test('cancelled bookings give their hours back; desk plans never take any', () => {
  const freed = march.map((b, i) => (i === 0 ? { ...b, status: 'cancelled' } : b))
  const plan = booking('2030-03-11', 9, 18, { planType: 'fixed-desk' })
  const next = booking('2030-03-08', 9, 18, { status: 'pending' })
  assert.equal(server.monthOverLimit(next, [...freed, plan, next], amenityMap), null)
})

test('other months are not affected', () => {
  const april = booking('2030-04-01', 9, 18, { status: 'pending' })
  assert.equal(server.monthOverLimit(april, [...march, april], amenityMap), null)
})

test('the client blocks a series in the first month it would go over', () => {
  const series = ['2030-03-29', '2030-04-01'].map(d => ({ amenityId: 'desk-1', startTime: at(d, 9), endTime: at(d, 18) }))
  assert.deepEqual(client.monthOverLimit(series, march, amenityList), { month: '2030-03', hoursLeft: 4 })
  // Within a single month, each occurrence uses up hours for the next.
  const may = ['2030-05-06', '2030-05-07', '2030-05-08', '2030-05-09', '2030-05-10'].map(d => ({ amenityId: 'desk-1', startTime: at(d, 9), endTime: at(d, 18) }))
  assert.deepEqual(client.monthOverLimit(may, [], amenityList), { month: '2030-05', hoursLeft: 4 })
  assert.equal(client.monthOverLimit(may.slice(0, 4), [], amenityList), null)
})

test('hours used this month reads the hub month of now', () => {
  assert.equal(client.hoursUsedThisMonth(march, amenityList, at('2030-03-20', 12)), 36)
  assert.equal(client.hoursUsedThisMonth(march, amenityList, at('2030-04-01', 6)), 0)
})
