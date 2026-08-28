process.env.TZ = 'America/Los_Angeles'

import test from 'node:test'
import assert from 'node:assert/strict'
import { getHubDayOfWeek, parseHubDateTime, toDateInputHub } from '../src/utils/timezone.js'
import {
  addOfficeDays,
  buildLocalDevAmenities,
  buildLocalDevBookings
} from '../src/services/localDevFixtures.js'

const OFFICE_DAYS = [1, 2, 3, 4, 5]
const fri = parseHubDateTime('2026-08-28T12:00')
const sat = parseHubDateTime('2026-08-29T12:00')
const sun = parseHubDateTime('2026-08-30T12:00')

test('addOfficeDays skips weekends in both directions', () => {
  assert.equal(toDateInputHub(addOfficeDays(fri, 0)), '2026-08-28')
  assert.equal(toDateInputHub(addOfficeDays(fri, 1)), '2026-08-31')
  assert.equal(toDateInputHub(addOfficeDays(fri, -1)), '2026-08-27')
  assert.equal(toDateInputHub(addOfficeDays(sat, 0)), '2026-08-31')
  assert.equal(toDateInputHub(addOfficeDays(sat, 1)), '2026-09-01')
  assert.equal(toDateInputHub(addOfficeDays(sat, -1)), '2026-08-28')
  assert.equal(toDateInputHub(addOfficeDays(sun, 0)), '2026-08-31')
  assert.equal(toDateInputHub(addOfficeDays(sun, -1)), '2026-08-28')
})

test('desk and meeting-room fixtures land on weekdays', () => {
  const officeIds = new Set(
    buildLocalDevAmenities()
      .filter((amenity) => amenity.type !== 'event-space')
      .map((amenity) => amenity.id)
  )
  const officeBookings = buildLocalDevBookings().filter((booking) =>
    officeIds.has(booking.amenityId)
  )
  assert.ok(officeBookings.length > 0)
  for (const booking of officeBookings) {
    const weekday = getHubDayOfWeek(booking.startTime)
    assert.ok(
      OFFICE_DAYS.includes(weekday),
      `${booking.id} should be Mon–Fri, got weekday ${weekday}`
    )
    assert.equal(getHubDayOfWeek(booking.endTime), weekday)
  }
})
