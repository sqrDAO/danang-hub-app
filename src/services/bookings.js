import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc,
  query,
  where,
  orderBy,
  getCountFromServer,
  Timestamp
} from 'firebase/firestore'
import { db } from './firebase'
import { isHubClosed } from '../utils/hubClosures'
import { LOCAL_DEV_MODE } from '../utils/localDevMode'
import {
  cancelLocalFixedDeskPlan,
  countLocalCompletedBookings,
  createLocalBooking,
  deleteLocalBooking,
  getLocalBooking,
  listLocalBookings,
  updateLocalBooking
} from './localDevStore'

const BOOKINGS_COLLECTION = 'bookings'

export const getBookings = async (filters = {}) => {
  if (LOCAL_DEV_MODE) return listLocalBookings(filters)
  try {
    const bookingsRef = collection(db, BOOKINGS_COLLECTION)

    // Build query constraints - where clauses must come before orderBy
    const constraints = []

    if (filters.memberId) {
      constraints.push(where('memberId', '==', filters.memberId))
    }
    if (filters.amenityId) {
      constraints.push(where('amenityId', '==', filters.amenityId))
    }
    if (filters.status) {
      constraints.push(where('status', '==', filters.status))
    }
    // Optional date window — narrows the server-side read so we don't
    // pull the entire collection on dashboards/calendars.
    if (filters.startDate) {
      constraints.push(where('startTime', '>=', Timestamp.fromDate(new Date(filters.startDate))))
    }
    if (filters.endDate) {
      constraints.push(where('startTime', '<=', Timestamp.fromDate(new Date(filters.endDate))))
    }

    // Add orderBy last
    constraints.push(orderBy('startTime', 'desc'))

    const q = query(bookingsRef, ...constraints)
    
    const snapshot = await getDocs(q)
    return snapshot.docs.map(doc => ({ 
      id: doc.id, 
      ...doc.data(),
      startTime: doc.data().startTime?.toDate?.() || doc.data().startTime,
      endTime: doc.data().endTime?.toDate?.() || doc.data().endTime,
      checkInTime: doc.data().checkInTime?.toDate?.() || doc.data().checkInTime,
      checkOutTime: doc.data().checkOutTime?.toDate?.() || doc.data().checkOutTime,
    }))
  } catch (error) {
    // If index is missing for orderBy without where clauses, try without orderBy
    if (error.code === 'failed-precondition' && Object.keys(filters).length === 0) {
      console.warn('Index missing for orderBy, fetching without orderBy:', error)
      const bookingsRef = collection(db, BOOKINGS_COLLECTION)
      const snapshot = await getDocs(bookingsRef)
      const bookings = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data(),
        startTime: doc.data().startTime?.toDate?.() || doc.data().startTime,
        endTime: doc.data().endTime?.toDate?.() || doc.data().endTime,
        checkInTime: doc.data().checkInTime?.toDate?.() || doc.data().checkInTime,
        checkOutTime: doc.data().checkOutTime?.toDate?.() || doc.data().checkOutTime,
      }))
      // Sort manually
      return bookings.sort((a, b) => {
        const dateA = a.startTime instanceof Date ? a.startTime : new Date(a.startTime)
        const dateB = b.startTime instanceof Date ? b.startTime : new Date(b.startTime)
        return dateB - dateA
      })
    }
    console.error('Error fetching bookings:', error)
    throw error
  }
}

// All-time count of completed bookings, server-side aggregate: the dashboards
// read a bounded date window, so they cannot total a collection that outgrows
// it. Counts documents, so a fixed desk plan contributes one per working day.
// Admin-only in practice — the read rule lets a member list only their own
// bookings, and an aggregate is authorized against the query, not its results.
export const getCompletedBookingsCount = async () => {
  if (LOCAL_DEV_MODE) return countLocalCompletedBookings()
  const q = query(
    collection(db, BOOKINGS_COLLECTION),
    where('status', '==', 'completed')
  )
  const snapshot = await getCountFromServer(q)
  return snapshot.data().count
}

export const getBooking = async (id) => {
  if (LOCAL_DEV_MODE) return getLocalBooking(id)
  const bookingRef = doc(db, BOOKINGS_COLLECTION, id)
  const snapshot = await getDoc(bookingRef)
  if (snapshot.exists()) {
    const data = snapshot.data()
    return { 
      id: snapshot.id, 
      ...data,
      startTime: data.startTime?.toDate?.() || data.startTime,
      endTime: data.endTime?.toDate?.() || data.endTime,
      checkInTime: data.checkInTime?.toDate?.() || data.checkInTime,
      checkOutTime: data.checkOutTime?.toDate?.() || data.checkOutTime,
    }
  }
  return null
}

// Ad-hoc desk bookings are created as pending then flipped to approved by
// autoApproveDeskBooking. Poll briefly so the client can show the final status
// (and hide cancel/delete) without a full page reload.
//
// Bounded and best-effort by design: a recurring create can produce up to 52
// bookings, so we watch at most MAX_WATCHED_BOOKINGS of them and back off
// between rounds instead of re-reading every occurrence on a fixed interval.
// The caller refetches the whole list once this resolves, so occurrences beyond
// the cap are still refreshed — they just don't influence the timing.
const MAX_WATCHED_BOOKINGS = 10
const POLL_INITIAL_MS = 300
const POLL_BACKOFF = 1.6
const POLL_MAX_INTERVAL_MS = 1200

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// Individual gets rather than a `documentId() in [...]` query: the bookings
// read rule is `isOwner(resource.data.memberId)`, which a get satisfies
// per-document without the query having to prove ownership up front.
const readStatuses = async (ids) => {
  const bookings = await Promise.all(ids.map((id) => getBooking(id)))
  return bookings.filter(Boolean).map((booking) => booking.status)
}

// Resolves once no watched booking is still pending, or on timeout.
// `anySettled` reports whether anything left `pending` — when nothing did, the
// caller can skip its refetch, since the list already shows these as pending.
export const waitForBookingsSettled = async (ids, { timeoutMs = 4000 } = {}) => {
  if (LOCAL_DEV_MODE) return { anySettled: true }
  const watched = (ids || []).filter(Boolean).slice(0, MAX_WATCHED_BOOKINGS)
  if (watched.length === 0) return { anySettled: false }

  const deadline = Date.now() + timeoutMs
  let interval = POLL_INITIAL_MS

  for (;;) {
    const statuses = await readStatuses(watched)
    if (statuses.length === 0) return { anySettled: false }

    const anySettled = statuses.some((status) => status !== 'pending')
    if (statuses.every((status) => status !== 'pending')) return { anySettled: true }
    if (Date.now() + interval >= deadline) return { anySettled }

    await sleep(interval)
    interval = Math.min(Math.round(interval * POLL_BACKOFF), POLL_MAX_INTERVAL_MS)
  }
}

export const createBooking = async (data) => {
  if (LOCAL_DEV_MODE) return createLocalBooking(data)
  const bookingsRef = collection(db, BOOKINGS_COLLECTION)
  const docRef = await addDoc(bookingsRef, {
    ...data,
    startTime: Timestamp.fromDate(new Date(data.startTime)),
    endTime: Timestamp.fromDate(new Date(data.endTime)),
    status: data.status || 'pending',
    createdAt: new Date().toISOString()
  })
  return docRef.id
}

export const updateBooking = async (id, data) => {
  if (LOCAL_DEV_MODE) return updateLocalBooking(id, data)
  const bookingRef = doc(db, BOOKINGS_COLLECTION, id)
  const updateData = { ...data }
  
  if (data.startTime) {
    updateData.startTime = Timestamp.fromDate(new Date(data.startTime))
  }
  if (data.endTime) {
    updateData.endTime = Timestamp.fromDate(new Date(data.endTime))
  }
  if (data.checkInTime) {
    updateData.checkInTime = Timestamp.fromDate(new Date(data.checkInTime))
  }
  if (data.checkOutTime) {
    updateData.checkOutTime = Timestamp.fromDate(new Date(data.checkOutTime))
  }
  
  updateData.updatedAt = new Date().toISOString()
  await updateDoc(bookingRef, updateData)
}

export const deleteBooking = async (id) => {
  if (LOCAL_DEV_MODE) return deleteLocalBooking(id)
  const bookingRef = doc(db, BOOKINGS_COLLECTION, id)
  await deleteDoc(bookingRef)
}

export const checkIn = async (id) => {
  const booking = await getBooking(id)
  if (!booking) {
    throw new Error('Booking not found')
  }
  const bookingDate = new Date(booking.startTime)
  const today = new Date()
  if (bookingDate.toDateString() !== today.toDateString()) {
    throw new Error('Check in is only allowed on the same day as the booking')
  }
  await updateBooking(id, {
    status: 'checked-in',
    checkInTime: new Date()
  })
}

export const checkOut = async (id) => {
  const booking = await getBooking(id)
  if (!booking) {
    throw new Error('Booking not found')
  }
  const bookingDate = new Date(booking.startTime)
  const today = new Date()
  if (bookingDate.toDateString() !== today.toDateString()) {
    throw new Error('Check out is only allowed on the same day as the booking')
  }
  await updateBooking(id, {
    status: 'completed',
    checkOutTime: new Date()
  })
}

// Get availability for a specific date
export const getAvailabilityForDate = async (amenityId, date) => {
  const startOfDay = new Date(date)
  startOfDay.setHours(0, 0, 0, 0)
  
  const endOfDay = new Date(date)
  endOfDay.setHours(23, 59, 59, 999)

  const bookings = await getBookings({ amenityId, startDate: startOfDay, endDate: endOfDay })
  
  // Filter bookings for the specific date
  const dayBookings = bookings.filter(booking => {
    const bookingStart = new Date(booking.startTime)
    const bookingEnd = new Date(booking.endTime)
    return (
      (bookingStart >= startOfDay && bookingStart <= endOfDay) ||
      (bookingEnd >= startOfDay && bookingEnd <= endOfDay) ||
      (bookingStart <= startOfDay && bookingEnd >= endOfDay)
    )
  }).filter(b => ['pending', 'approved', 'checked-in'].includes(b.status))

  return {
    date,
    bookings: dayBookings,
    availableSlots: calculateAvailableSlots(dayBookings, date)
  }
}

// Get weekly availability
export const getWeeklyAvailability = async (amenityId, startDate) => {
  const weekStart = new Date(startDate)
  weekStart.setHours(0, 0, 0, 0)
  
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 7)
  weekEnd.setHours(23, 59, 59, 999)

  const bookings = await getBookings({ amenityId, startDate: weekStart, endDate: weekEnd })
  
  const weekBookings = bookings.filter(booking => {
    const bookingStart = new Date(booking.startTime)
    const bookingEnd = new Date(booking.endTime)
    return (
      (bookingStart >= weekStart && bookingStart <= weekEnd) ||
      (bookingEnd >= weekStart && bookingEnd <= weekEnd) ||
      (bookingStart <= weekStart && bookingEnd >= weekEnd)
    )
  }).filter(b => ['pending', 'approved', 'checked-in'].includes(b.status))

  const availability = []
  for (let i = 0; i < 7; i++) {
    const date = new Date(weekStart)
    date.setDate(weekStart.getDate() + i)
    const dayBookings = weekBookings.filter(b => {
      const bookingDate = new Date(b.startTime)
      return bookingDate.toDateString() === date.toDateString()
    })
    availability.push({
      date,
      bookings: dayBookings,
      availableSlots: calculateAvailableSlots(dayBookings, date)
    })
  }

  return availability
}

// Helper function to calculate available time slots
const calculateAvailableSlots = (bookings, date) => {
  const slots = []
  const START_HOUR = 8
  const END_HOUR = 22
  const INTERVAL = 30 // minutes

  // Create all possible slots
  for (let hour = START_HOUR; hour < END_HOUR; hour++) {
    for (let minute = 0; minute < 60; minute += INTERVAL) {
      const slotStart = new Date(date)
      slotStart.setHours(hour, minute, 0, 0)
      
      const slotEnd = new Date(slotStart)
      slotEnd.setMinutes(slotEnd.getMinutes() + INTERVAL)

      // Check if slot conflicts with any booking
      const isBooked = bookings.some(booking => {
        const bookingStart = new Date(booking.startTime)
        const bookingEnd = new Date(booking.endTime)
        return (
          (slotStart >= bookingStart && slotStart < bookingEnd) ||
          (slotEnd > bookingStart && slotEnd <= bookingEnd) ||
          (slotStart <= bookingStart && slotEnd >= bookingEnd)
        )
      })

      slots.push({
        start: slotStart,
        end: slotEnd,
        available: !isBooked
      })
    }
  }

  return slots
}

// Whether a candidate occurrence date falls on an open weekday
const isAllowedWeekday = (allowedWeekdays, date) =>
  !allowedWeekdays || allowedWeekdays.includes(date.getDay())

// Whether the Hub is open at all that day. Separate from the weekday check so a
// closure skips the date without consuming an occurrence, exactly as a
// non-working weekday does.
const isOpenDate = (date) => !isHubClosed(date)

// Check for conflicts before creating if function provided
const hasRecurringConflict = async (checkConflictsFn, amenityId, bookingStart, bookingEnd) => {
  if (!checkConflictsFn) return false
  try {
    const conflictCheck = await checkConflictsFn(
      amenityId,
      bookingStart.toISOString(),
      bookingEnd.toISOString()
    )
    return conflictCheck.hasConflicts
  } catch (error) {
    console.error(`Error checking conflicts for recurring booking:`, error)
    return false
  }
}

// Create a single occurrence of a recurring booking.
// Returns the created booking (with id) or null when skipped/failed.
const tryCreateOccurrence = async ({ baseBooking, frequency, bookingStart, bookingEnd, checkConflictsFn }) => {
  const hasConflict = await hasRecurringConflict(checkConflictsFn, baseBooking.amenityId, bookingStart, bookingEnd)
  if (hasConflict) return null

  const bookingData = {
    ...baseBooking,
    startTime: bookingStart.toISOString(),
    endTime: bookingEnd.toISOString(),
    recurrencePattern: {
      frequency,
      originalStart: baseBooking.startTime
    }
  }

  try {
    const id = await createBooking(bookingData)
    return { id, ...bookingData }
  } catch (error) {
    console.error(`Error creating recurring booking for ${bookingStart}:`, error)
    return null
  }
}

// Move to next potential occurrence date
const advanceRecurrenceDate = (currentDate, frequency) => {
  switch (frequency) {
    case 'daily':
      currentDate.setDate(currentDate.getDate() + 1)
      break
    case 'weekly':
      currentDate.setDate(currentDate.getDate() + 7)
      break
    case 'monthly':
      currentDate.setMonth(currentDate.getMonth() + 1)
      break
    default:
      break
  }
}

// Create recurring bookings
// Optional options.allowedWeekdays: array of JS getDay() numbers (0-6) that are open
export const createRecurringBooking = async (baseBooking, recurrence, checkConflictsFn, options = {}) => {
  const { frequency, endDate, occurrences } = recurrence
  const allowedWeekdays = Array.isArray(options.allowedWeekdays) ? options.allowedWeekdays : null
  const bookings = []
  const createdIds = []
  const durationMs = new Date(baseBooking.endTime) - new Date(baseBooking.startTime)

  let currentDate = new Date(baseBooking.startTime)
  const end = endDate ? new Date(endDate) : null
  let count = 0
  const maxOccurrences = occurrences || 999

  while (count < maxOccurrences && (!end || currentDate <= end)) {
    const bookingStart = new Date(currentDate)
    const bookingEnd = new Date(bookingStart)
    bookingEnd.setTime(bookingStart.getTime() + durationMs)

    if (isAllowedWeekday(allowedWeekdays, bookingStart) && isOpenDate(bookingStart)) {
      const created = await tryCreateOccurrence({ baseBooking, frequency, bookingStart, bookingEnd, checkConflictsFn })
      if (created) {
        createdIds.push(created.id)
        bookings.push(created)
      }
      count++
    }

    advanceRecurrenceDate(currentDate, frequency)
  }

  return { createdIds, bookings, totalCreated: createdIds.length }
}

// Create a fixed desk plan: books a desk for all working days (Mon–Fri, 9am–6pm)
// over a weekly (current week) or monthly (next 30 days) period.
export const createFixedDeskPlan = async ({
  memberId,
  amenityId,
  period,
  startDate,
  createdByAdmin = false,
  checkConflictsFn = null,
}) => {
  const planGroupId = crypto.randomUUID()
  const DESK_START_HOUR = 9
  const DESK_END_HOUR = 18

  const planStart = new Date(startDate)
  planStart.setHours(DESK_START_HOUR, 0, 0, 0)

  const planEnd = new Date(startDate)
  if (period === 'weekly') {
    const day = planStart.getDay()
    const daysUntilFriday = day === 0 ? 5 : (5 - day + 7) % 7
    planEnd.setDate(planEnd.getDate() + daysUntilFriday)
  } else {
    planEnd.setMonth(planEnd.getMonth() + 1)
    planEnd.setDate(planEnd.getDate() - 1)
  }
  planEnd.setHours(DESK_END_HOUR, 0, 0, 0)

  const durationMs = (DESK_END_HOUR - DESK_START_HOUR) * 60 * 60 * 1000
  const firstDayEnd = new Date(planStart.getTime() + durationMs)

  const baseBooking = {
    memberId,
    amenityId,
    startTime: planStart.toISOString(),
    endTime: firstDayEnd.toISOString(),
    planType: 'fixed-desk',
    planPeriod: period,
    planGroupId,
    ...(createdByAdmin && { status: 'approved' }),
  }

  return createRecurringBooking(
    baseBooking,
    { frequency: 'daily', endDate: planEnd.toISOString() },
    checkConflictsFn,
    { allowedWeekdays: [1, 2, 3, 4, 5] }
  )
}

// Cancel all active bookings belonging to a fixed desk plan group.
// Server-side filter on planGroupId avoids fetching the whole bookings
// collection just to cancel one plan.
export const cancelFixedDeskPlan = async (planGroupId) => {
  if (LOCAL_DEV_MODE) return cancelLocalFixedDeskPlan(planGroupId)
  const bookingsRef = collection(db, BOOKINGS_COLLECTION)
  const q = query(bookingsRef, where('planGroupId', '==', planGroupId))
  const snapshot = await getDocs(q)
  const planBookings = snapshot.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(b => ['pending', 'approved'].includes(b.status))
  await Promise.all(planBookings.map(b => updateBooking(b.id, { status: 'cancelled' })))
  return planBookings.length
}
