// Match the calendar date separately so Date.parse cannot silently roll an
// impossible day into the next month. Keep fractional seconds to nanoseconds.
const isoCreationTime = /^([+-]\d{6}-\d\d-\d\d|\d{4}-\d\d-\d\d)(?:T\d\d:\d\d(?::\d\d(?:\.(\d{1,9}))?)?(?:Z|[+-]\d\d:?\d\d)?)?$/i

const stringTime = (value) => {
  const match = isoCreationTime.exec(value)
  if (!match) return -Infinity
  const [, calendarDate, fraction = ''] = match
  const midnight = new Date(calendarDate + 'T00:00:00Z')
  if (!Number.isFinite(midnight.getTime()) || midnight.toISOString().split('T')[0] !== calendarDate) return -Infinity

  const millis = Date.parse(value)
  if (!Number.isFinite(millis)) return -Infinity
  return BigInt(millis) * 1000000n + BigInt(fraction.padEnd(9, '0').slice(3))
}

// Unknown creation times sort after every valid instant, including pre-epoch dates.
const creationTime = (value) => {
  if (typeof value?.toDate === 'function') {
    if (Number.isSafeInteger(value.seconds) && Number.isInteger(value.nanoseconds)) {
      return BigInt(value.seconds) * 1000000000n + BigInt(value.nanoseconds)
    }
    value = value.toDate()
  }
  if (typeof value === 'string') return stringTime(value)
  if (!(value instanceof Date) && typeof value !== 'number') return -Infinity
  const millis = new Date(value).getTime()
  return Number.isFinite(millis) ? BigInt(millis) * 1000000n : -Infinity
}

export const compareMembersCreatedAt = (a, b) => {
  const first = creationTime(a.createdAt)
  const second = creationTime(b.createdAt)
  if (first === second) return 0
  return first > second ? -1 : 1
}
