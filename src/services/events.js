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
  arrayUnion,
  arrayRemove,
  Timestamp
} from 'firebase/firestore'
import { db } from './firebase'

const EVENTS_COLLECTION = 'events'

export const getEvents = async (filters = {}) => {
  const eventsRef = collection(db, EVENTS_COLLECTION)
  let q = query(eventsRef, orderBy('date', 'desc'))
  
  if (filters.organizerId) {
    q = query(q, where('organizerId', '==', filters.organizerId))
  }
  
  const snapshot = await getDocs(q)
  return snapshot.docs.map(doc => ({ 
    id: doc.id, 
    ...doc.data(),
    date: doc.data().date?.toDate?.() || doc.data().date,
  }))
}

export const getEvent = async (id) => {
  const eventRef = doc(db, EVENTS_COLLECTION, id)
  const snapshot = await getDoc(eventRef)
  if (snapshot.exists()) {
    const data = snapshot.data()
    return { 
      id: snapshot.id, 
      ...data,
      date: data.date?.toDate?.() || data.date,
    }
  }
  return null
}

export const createEvent = async (data) => {
  const eventsRef = collection(db, EVENTS_COLLECTION)
  const docRef = await addDoc(eventsRef, {
    ...data,
    date: Timestamp.fromDate(new Date(data.date)),
    attendees: data.attendees || [],
    status: data.status || 'pending', // pending, approved, rejected
    createdAt: new Date().toISOString()
  })
  return docRef.id
}

export const getUpcomingEvents = async () => {
  try {
    // Get both approved and pending events, then filter by date in memory
    const eventsRef = collection(db, EVENTS_COLLECTION)
    
    // Try to fetch both in parallel, with error handling for each
    const fetchApproved = async () => {
      try {
        const q = query(eventsRef, where('status', '==', 'approved'))
        const snapshot = await getDocs(q)
        return snapshot.docs.map(doc => ({ 
          id: doc.id, 
          ...doc.data(),
          date: doc.data().date?.toDate?.() || doc.data().date,
        }))
      } catch (error) {
        console.warn('Error fetching approved events:', error)
        return []
      }
    }
    
    const fetchPending = async () => {
      try {
        const q = query(eventsRef, where('status', '==', 'pending'))
        const snapshot = await getDocs(q)
        return snapshot.docs.map(doc => ({ 
          id: doc.id, 
          ...doc.data(),
          date: doc.data().date?.toDate?.() || doc.data().date,
        }))
      } catch (error) {
        console.warn('Error fetching pending events:', error)
        return []
      }
    }
    
    const [approvedEvents, pendingEvents] = await Promise.all([
      fetchApproved(),
      fetchPending()
    ])
    
    const allEvents = [...approvedEvents, ...pendingEvents]
    
    // Sort by date descending
    return allEvents.sort((a, b) => {
      const dateA = a.date instanceof Date ? a.date : new Date(a.date)
      const dateB = b.date instanceof Date ? b.date : new Date(b.date)
      return dateB - dateA
    })
  } catch (error) {
    console.error('Error fetching upcoming events:', error)
    return []
  }
}

export const getApprovedEvents = async () => {
  try {
    const eventsRef = collection(db, EVENTS_COLLECTION)
    const q = query(
      eventsRef,
      where('status', '==', 'approved'),
      orderBy('date', 'desc')
    )
    const snapshot = await getDocs(q)
    return snapshot.docs.map(doc => ({ 
      id: doc.id, 
      ...doc.data(),
      date: doc.data().date?.toDate?.() || doc.data().date,
    }))
  } catch (error) {
    console.error('Error fetching approved events:', error)
    // If index is missing, try without orderBy as fallback
    if (error.code === 'failed-precondition') {
      const eventsRef = collection(db, EVENTS_COLLECTION)
      const q = query(eventsRef, where('status', '==', 'approved'))
      const snapshot = await getDocs(q)
      const events = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data(),
        date: doc.data().date?.toDate?.() || doc.data().date,
      }))
      // Sort manually
      return events.sort((a, b) => {
        const dateA = a.date instanceof Date ? a.date : new Date(a.date)
        const dateB = b.date instanceof Date ? b.date : new Date(b.date)
        return dateB - dateA
      })
    }
    throw error
  }
}

export const getPendingEvents = async () => {
  try {
    const eventsRef = collection(db, EVENTS_COLLECTION)
    const q = query(
      eventsRef,
      where('status', '==', 'pending'),
      orderBy('date', 'desc')
    )
    const snapshot = await getDocs(q)
    return snapshot.docs.map(doc => ({ 
      id: doc.id, 
      ...doc.data(),
      date: doc.data().date?.toDate?.() || doc.data().date,
    }))
  } catch (error) {
    console.error('Error fetching pending events:', error)
    // If index is missing, try without orderBy as fallback
    if (error.code === 'failed-precondition') {
      const eventsRef = collection(db, EVENTS_COLLECTION)
      const q = query(eventsRef, where('status', '==', 'pending'))
      const snapshot = await getDocs(q)
      const events = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data(),
        date: doc.data().date?.toDate?.() || doc.data().date,
      }))
      // Sort manually
      return events.sort((a, b) => {
        const dateA = a.date instanceof Date ? a.date : new Date(a.date)
        const dateB = b.date instanceof Date ? b.date : new Date(b.date)
        return dateB - dateA
      })
    }
    throw error
  }
}

export const getMyEvents = async (organizerId) => {
  const eventsRef = collection(db, EVENTS_COLLECTION)
  const q = query(
    eventsRef,
    where('organizerId', '==', organizerId),
    orderBy('date', 'desc')
  )
  const snapshot = await getDocs(q)
  return snapshot.docs.map(doc => ({ 
    id: doc.id, 
    ...doc.data(),
    date: doc.data().date?.toDate?.() || doc.data().date,
  }))
}

export const approveEvent = async (eventId) => {
  const eventRef = doc(db, EVENTS_COLLECTION, eventId)
  await updateDoc(eventRef, {
    status: 'approved',
    approvedAt: new Date().toISOString()
  })
}

export const rejectEvent = async (eventId, reason = '') => {
  const eventRef = doc(db, EVENTS_COLLECTION, eventId)
  await updateDoc(eventRef, {
    status: 'rejected',
    rejectionReason: reason,
    rejectedAt: new Date().toISOString()
  })
}

export const updateEvent = async (id, data) => {
  const eventRef = doc(db, EVENTS_COLLECTION, id)
  const updateData = { ...data }
  
  if (data.date) {
    updateData.date = Timestamp.fromDate(new Date(data.date))
  }
  
  updateData.updatedAt = new Date().toISOString()
  await updateDoc(eventRef, updateData)
}

export const deleteEvent = async (id) => {
  const eventRef = doc(db, EVENTS_COLLECTION, id)
  await deleteDoc(eventRef)
}

export const registerForEvent = async (eventId, memberId) => {
  const eventRef = doc(db, EVENTS_COLLECTION, eventId)
  await updateDoc(eventRef, {
    attendees: arrayUnion(memberId)
  })
}

export const unregisterFromEvent = async (eventId, memberId) => {
  const eventRef = doc(db, EVENTS_COLLECTION, eventId)
  await updateDoc(eventRef, {
    attendees: arrayRemove(memberId)
  })
}

// Waitlist functions
export const addToWaitlist = async (eventId, memberId) => {
  const eventRef = doc(db, EVENTS_COLLECTION, eventId)
  const eventDoc = await getDoc(eventRef)
  
  if (!eventDoc.exists()) {
    throw new Error('Event not found')
  }
  
  const eventData = eventDoc.data()
  const waitlist = eventData.waitlist || []
  
  // Don't add if already in waitlist
  if (waitlist.includes(memberId)) {
    return
  }
  
  await updateDoc(eventRef, {
    waitlist: arrayUnion(memberId)
  })
}

export const removeFromWaitlist = async (eventId, memberId) => {
  const eventRef = doc(db, EVENTS_COLLECTION, eventId)
  await updateDoc(eventRef, {
    waitlist: arrayRemove(memberId)
  })
}

export const promoteFromWaitlist = async (eventId, count = 1) => {
  const eventRef = doc(db, EVENTS_COLLECTION, eventId)
  const eventDoc = await getDoc(eventRef)
  
  if (!eventDoc.exists()) {
    throw new Error('Event not found')
  }
  
  const eventData = eventDoc.data()
  const waitlist = eventData.waitlist || []
  const attendees = eventData.attendees || []
  const capacity = eventData.capacity
  
  // Check if there's space
  const availableSpots = capacity ? capacity - attendees.length : Infinity
  
  if (availableSpots <= 0 || waitlist.length === 0) {
    return { promoted: 0, remaining: waitlist.length }
  }
  
  const toPromote = Math.min(count, availableSpots, waitlist.length)
  const promoted = waitlist.slice(0, toPromote)
  const remaining = waitlist.slice(toPromote)
  
  await updateDoc(eventRef, {
    attendees: arrayUnion(...promoted),
    waitlist: remaining
  })
  
  return { promoted: toPromote, remaining: remaining.length }
}
