import {
  buildLocalDevAmenities,
  buildLocalDevBookings,
  buildLocalDevEvents,
  buildLocalDevMembers,
  buildLocalDevProjects
} from './localDevFixtures.js'

const ACTIVE_BOOKING_STATUSES = ['pending', 'approved', 'checked-in']
const STORE_KEY = '__DANANG_LOCAL_DEV_STORE__'
const SEQ_KEY = '__DANANG_LOCAL_DEV_SEQ__'

const createInitialStore = () => ({
  amenities: buildLocalDevAmenities(),
  bookings: buildLocalDevBookings(),
  events: buildLocalDevEvents(),
  members: buildLocalDevMembers(),
  projects: buildLocalDevProjects()
})

export const resetLocalDevStore = () => {
  globalThis[STORE_KEY] = createInitialStore()
  globalThis[SEQ_KEY] = 0
  return globalThis[STORE_KEY]
}

const getStore = () => {
  globalThis[STORE_KEY] ??= createInitialStore()
  return globalThis[STORE_KEY]
}

const nextId = (prefix) => {
  globalThis[SEQ_KEY] = (globalThis[SEQ_KEY] || 0) + 1
  return `${prefix}-${globalThis[SEQ_KEY]}`
}

const cloneDates = (value, keys) => {
  const copy = { ...value }
  keys.forEach((key) => {
    if (copy[key]) copy[key] = new Date(copy[key])
  })
  return copy
}

export const listLocalAmenities = () => getStore().amenities.map((item) => ({ ...item }))
export const getLocalAmenity = (id) => getStore().amenities.find((item) => item.id === id) || null

export const createLocalAmenity = (data) => {
  const id = nextId('amenity')
  getStore().amenities.push({ id, photos: [], isAvailable: true, ...data })
  return id
}

export const updateLocalAmenity = (id, data) => {
  const amenity = getStore().amenities.find((item) => item.id === id)
  if (!amenity) return
  Object.assign(amenity, data, { updatedAt: new Date().toISOString() })
}

export const deleteLocalAmenity = (id) => {
  const store = getStore()
  store.amenities = store.amenities.filter((item) => item.id !== id)
}

const fieldMatches = (expected, actual) => !expected || expected === actual

const bookingInWindow = (booking, startBound, endBound) => {
  const start = new Date(booking.startTime)
  if (startBound && start < startBound) return false
  if (endBound && start > endBound) return false
  return true
}

const bookingMatchesFilters = (booking, filters, startBound, endBound) => (
  fieldMatches(filters.memberId, booking.memberId) &&
  fieldMatches(filters.amenityId, booking.amenityId) &&
  fieldMatches(filters.status, booking.status) &&
  bookingInWindow(booking, startBound, endBound)
)

export const filterLocalBookings = (bookings, filters = {}) => {
  const startBound = filters.startDate ? new Date(filters.startDate) : null
  const endBound = filters.endDate ? new Date(filters.endDate) : null
  return bookings
    .filter((booking) => bookingMatchesFilters(booking, filters, startBound, endBound))
    .sort((left, right) => new Date(right.startTime) - new Date(left.startTime))
}

export const listLocalBookings = (filters = {}) =>
  filterLocalBookings(getStore().bookings, filters).map((booking) =>
    cloneDates(booking, ['startTime', 'endTime', 'checkInTime', 'checkOutTime'])
  )

export const getLocalBooking = (id) => {
  const booking = getStore().bookings.find((item) => item.id === id)
  return booking ? cloneDates(booking, ['startTime', 'endTime', 'checkInTime', 'checkOutTime']) : null
}

export const createLocalBooking = (data) => {
  const id = nextId('booking')
  getStore().bookings.push({
    ...data,
    id,
    status: data.status || 'approved',
    startTime: new Date(data.startTime),
    endTime: new Date(data.endTime),
    createdAt: new Date().toISOString()
  })
  return id
}

export const updateLocalBooking = (id, data) => {
  const booking = getStore().bookings.find((item) => item.id === id)
  if (!booking) return
  const next = { ...data }
  if (data.startTime) next.startTime = new Date(data.startTime)
  if (data.endTime) next.endTime = new Date(data.endTime)
  if (data.checkInTime) next.checkInTime = new Date(data.checkInTime)
  if (data.checkOutTime) next.checkOutTime = new Date(data.checkOutTime)
  Object.assign(booking, next, { updatedAt: new Date().toISOString() })
}

export const deleteLocalBooking = (id) => {
  const store = getStore()
  store.bookings = store.bookings.filter((item) => item.id !== id)
}

export const cancelLocalFixedDeskPlan = async (planGroupId) => {
  const matches = getStore().bookings.filter((booking) => (
    booking.planGroupId === planGroupId && ACTIVE_BOOKING_STATUSES.includes(booking.status)
  ))
  matches.forEach((booking) => {
    booking.status = 'cancelled'
    booking.updatedAt = new Date().toISOString()
  })
  return matches.length
}

const rangesOverlap = (startA, endA, startB, endB) => startA < endB && endA > startB

export const overlappingLocalBookings = (bookings, amenityId, startTime, endTime, excludeId) => {
  const startMs = new Date(startTime).getTime()
  const endMs = new Date(endTime).getTime()
  return bookings.filter((booking) => {
    if (booking.amenityId !== amenityId) return false
    if (excludeId && booking.id === excludeId) return false
    if (!ACTIVE_BOOKING_STATUSES.includes(booking.status)) return false
    return rangesOverlap(startMs, endMs, new Date(booking.startTime).getTime(), new Date(booking.endTime).getTime())
  })
}

export const findLocalBookingConflicts = (bookings, amenities, query) => {
  const overlaps = overlappingLocalBookings(
    bookings,
    query.amenityId,
    query.startTime,
    query.endTime,
    query.excludeId
  )
  const amenity = amenities.find((item) => item.id === query.amenityId)
  if (amenity?.type === 'desk') {
    const capacity = amenity.capacity || 1
    return { hasConflicts: overlaps.length >= capacity, conflicts: overlaps }
  }
  return { hasConflicts: overlaps.length > 0, conflicts: overlaps }
}

export const listLocalAmenityRanges = (amenityId, startTime, endTime) => (
  overlappingLocalBookings(getStore().bookings, amenityId, startTime, endTime)
    .map((booking) => ({
      startTime: new Date(booking.startTime),
      endTime: new Date(booking.endTime),
      status: booking.status
    }))
)

export const checkLocalBookingConflicts = (amenityId, startTime, endTime, excludeBookingId) => {
  const store = getStore()
  return findLocalBookingConflicts(store.bookings, store.amenities, {
    amenityId,
    startTime,
    endTime,
    excludeId: excludeBookingId
  })
}

const eventMatches = (event, filters = {}) => {
  if (filters.organizerId && event.organizerId !== filters.organizerId) return false
  const date = new Date(event.date)
  if (filters.startDate && date < new Date(filters.startDate)) return false
  if (filters.endDate && date > new Date(filters.endDate)) return false
  return true
}

const sortEventsByDateDesc = (events) =>
  [...events].sort((left, right) => new Date(right.date) - new Date(left.date))

export const listLocalEvents = (filters = {}) =>
  sortEventsByDateDesc(getStore().events.filter((event) => eventMatches(event, filters)))
    .map((event) => cloneDates(event, ['date']))

export const listLocalUpcomingEvents = ({ includePending = false } = {}) =>
  sortEventsByDateDesc(getStore().events.filter((event) => (
    event.status === 'approved' || (includePending && event.status === 'pending')
  ))).map((event) => cloneDates(event, ['date']))

export const listLocalApprovedEvents = () =>
  listLocalUpcomingEvents({ includePending: false })

export const listLocalPendingEvents = () =>
  sortEventsByDateDesc(getStore().events.filter((event) => event.status === 'pending'))
    .map((event) => cloneDates(event, ['date']))

export const listLocalMyEvents = (organizerId) =>
  listLocalEvents({ organizerId })

export const getLocalEvent = (id) => {
  const event = getStore().events.find((item) => item.id === id)
  return event ? cloneDates(event, ['date']) : null
}

export const createLocalEvent = (data) => {
  const id = nextId('event')
  getStore().events.push({
    attendees: [],
    waitlist: [],
    revision: 1,
    everApproved: false,
    ...data,
    id,
    date: new Date(data.date),
    status: data.status || 'pending',
    createdAt: new Date().toISOString()
  })
  return id
}

const requireLocalEvent = (id) => {
  const event = getStore().events.find((item) => item.id === id)
  if (!event) throw new Error('Event not found')
  return event
}

export const updateLocalEvent = (id, data) => {
  const event = requireLocalEvent(id)
  const next = { ...data }
  if (data.date) next.date = new Date(data.date)
  Object.assign(event, next, {
    revision: (event.revision || 1) + 1,
    updatedAt: new Date().toISOString()
  })
}

export const deleteLocalEvent = (id) => {
  const store = getStore()
  store.events = store.events.filter((item) => item.id !== id)
}

export const registerLocalEvent = (eventId, memberId) => {
  const event = requireLocalEvent(eventId)
  if (!event.attendees.includes(memberId)) event.attendees = [...event.attendees, memberId]
}

export const unregisterLocalEvent = (eventId, memberId) => {
  const event = requireLocalEvent(eventId)
  event.attendees = event.attendees.filter((id) => id !== memberId)
}

export const addLocalWaitlist = (eventId, memberId) => {
  const event = requireLocalEvent(eventId)
  if (!event.waitlist.includes(memberId)) event.waitlist = [...event.waitlist, memberId]
}

export const removeLocalWaitlist = (eventId, memberId) => {
  const event = requireLocalEvent(eventId)
  event.waitlist = event.waitlist.filter((id) => id !== memberId)
}

export const promoteLocalWaitlist = (eventId, count = 1) => {
  const event = requireLocalEvent(eventId)
  const take = event.waitlist.slice(0, count)
  event.waitlist = event.waitlist.slice(take.length)
  take.forEach((memberId) => {
    if (!event.attendees.includes(memberId)) event.attendees = [...event.attendees, memberId]
  })
  return { promoted: take.length }
}

export const editLocalOwnEvent = ({ eventId, expectedRevision, data }) => {
  const event = requireLocalEvent(eventId)
  if (expectedRevision != null && event.revision !== expectedRevision) {
    throw new Error('Event has already been updated')
  }
  const resubmitted = event.status === 'approved' || event.status === 'rejected'
  updateLocalEvent(eventId, {
    ...data,
    status: resubmitted ? 'pending' : event.status
  })
  return { resubmitted }
}

export const reviewLocalEvent = ({ eventId, action, reason = '' }) => {
  const event = requireLocalEvent(eventId)
  if (action === 'approved') {
    event.status = 'approved'
    event.everApproved = true
    event.approvedAt = new Date().toISOString()
  } else {
    event.status = 'rejected'
    event.rejectionReason = reason
    event.rejectedAt = new Date().toISOString()
  }
  event.revision = (event.revision || 1) + 1
  return { ok: true }
}

export const listLocalProjects = () => getStore().projects.map((item) => ({ ...item }))
export const getLocalProject = (id) => getStore().projects.find((item) => item.id === id) || null

export const listLocalMembers = () => getStore().members.map((item) => ({ ...item }))
export const getLocalMember = (uid) => getStore().members.find((item) => item.id === uid || item.uid === uid) || null

export const updateLocalMember = (uid, data) => {
  const member = getStore().members.find((item) => item.id === uid || item.uid === uid)
  if (!member) return
  Object.assign(member, data, { updatedAt: new Date().toISOString() })
}
