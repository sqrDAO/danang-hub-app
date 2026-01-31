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
  Timestamp
} from 'firebase/firestore'
import { db } from './firebase'

const BOOKINGS_COLLECTION = 'bookings'

export const getBookings = async (filters = {}) => {
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

export const getBooking = async (id) => {
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

export const createBooking = async (data) => {
  const bookingsRef = collection(db, BOOKINGS_COLLECTION)
  const docRef = await addDoc(bookingsRef, {
    ...data,
    startTime: Timestamp.fromDate(new Date(data.startTime)),
    endTime: Timestamp.fromDate(new Date(data.endTime)),
    status: 'pending',
    createdAt: new Date().toISOString()
  })
  return docRef.id
}

// Create booking and a linked event when amenity is event-space (for AI chatbot)
export const createBookingWithEventIfEventSpace = async (
  { amenityId, memberId, startTime, endTime },
  { getAmenities, createEvent }
) => {
  const amenities = await getAmenities()
  const amenity = amenities.find((a) => a.id === amenityId)

  const bookingId = await createBooking({
    amenityId,
    memberId,
    startTime,
    endTime
  })

  if (amenity?.type === 'event-space') {
    const start = new Date(startTime)
    const end = new Date(endTime)
    const durationMinutes = Math.round((end - start) / (60 * 1000))

    await createEvent({
      title: `${amenity.name} Booking`,
      description: 'Booking made via AI assistant',
      date: startTime,
      duration: durationMinutes,
      organizerId: memberId,
      status: 'pending',
      requestedAmenityId: amenityId,
      bookingId,
      capacity: amenity.capacity || 80,
      waitlist: []
    })
  }

  return bookingId
}

export const updateBooking = async (id, data) => {
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
  const bookingRef = doc(db, BOOKINGS_COLLECTION, id)
  await deleteDoc(bookingRef)
}

export const checkIn = async (id) => {
  await updateBooking(id, {
    status: 'checked-in',
    checkInTime: new Date()
  })
}

export const checkOut = async (id) => {
  await updateBooking(id, {
    status: 'completed',
    checkOutTime: new Date()
  })
}

// Check if a specific time slot is available for an amenity
export const checkSlotAvailability = async (amenityId, startTime, endTime) => {
  const start = new Date(startTime)
  const end = new Date(endTime)
  const bookings = await getBookings({ amenityId })
  const activeBookings = bookings.filter(b =>
    ['pending', 'approved', 'checked-in'].includes(b.status)
  )
  const conflicts = activeBookings.filter(booking => {
    const bookingStart = new Date(booking.startTime)
    const bookingEnd = new Date(booking.endTime)
    return (
      (start >= bookingStart && start < bookingEnd) ||
      (end > bookingStart && end <= bookingEnd) ||
      (start <= bookingStart && end >= bookingEnd)
    )
  })
  return {
    available: conflicts.length === 0,
    conflicts: conflicts.map(c => ({
      id: c.id,
      startTime: c.startTime,
      endTime: c.endTime
    }))
  }
}

// Get availability for a specific date
export const getAvailabilityForDate = async (amenityId, date) => {
  const startOfDay = new Date(date)
  startOfDay.setHours(0, 0, 0, 0)
  
  const endOfDay = new Date(date)
  endOfDay.setHours(23, 59, 59, 999)

  const bookings = await getBookings({ amenityId })
  
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

  const bookings = await getBookings({ amenityId })
  
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

// Create recurring bookings
export const createRecurringBooking = async (baseBooking, recurrence, checkConflictsFn) => {
  const { frequency, endDate, occurrences } = recurrence
  const bookings = []
  const createdIds = []

  let currentDate = new Date(baseBooking.startTime)
  const end = endDate ? new Date(endDate) : null
  let count = 0
  const maxOccurrences = occurrences || 999

  while (count < maxOccurrences && (!end || currentDate <= end)) {
    const bookingStart = new Date(currentDate)
    const bookingEnd = new Date(bookingStart)
    bookingEnd.setTime(bookingStart.getTime() + (new Date(baseBooking.endTime) - new Date(baseBooking.startTime)))

    const bookingData = {
      ...baseBooking,
      startTime: bookingStart.toISOString(),
      endTime: bookingEnd.toISOString(),
      recurrencePattern: {
        frequency,
        originalStart: baseBooking.startTime
      }
    }

    // Check for conflicts before creating if function provided
    let hasConflict = false
    if (checkConflictsFn) {
      try {
        const conflictCheck = await checkConflictsFn(
          baseBooking.amenityId,
          bookingStart.toISOString(),
          bookingEnd.toISOString()
        )
        hasConflict = conflictCheck.hasConflicts
      } catch (error) {
        console.error(`Error checking conflicts for recurring booking:`, error)
      }
    }

    if (!hasConflict) {
      try {
        const id = await createBooking(bookingData)
        createdIds.push(id)
        bookings.push({ id, ...bookingData })
      } catch (error) {
        console.error(`Error creating recurring booking for ${currentDate}:`, error)
      }
    }

    // Move to next occurrence
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
    count++
  }

  return { createdIds, bookings, totalCreated: createdIds.length }
}
