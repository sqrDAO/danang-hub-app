// Upcoming-event lists read nearest first. Past-event lists keep their own
// newest-first order and do not use this.

const eventTime = (event) => {
  const date = event?.date instanceof Date ? event.date : new Date(event?.date)
  const ms = date.getTime()
  // Undated or unparseable events sort last instead of breaking the order.
  return Number.isNaN(ms) ? Infinity : ms
}

export const compareEventsNearestFirst = (a, b) => {
  const left = eventTime(a)
  const right = eventTime(b)
  if (left === right) return 0
  return left < right ? -1 : 1
}

export const sortEventsNearestFirst = (events) => [...events].sort(compareEventsNearestFirst)
