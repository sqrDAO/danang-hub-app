import {
  collection,
  doc,
  getDocs,
  getDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy
} from 'firebase/firestore'
import { db } from './firebase'
import { getBookings } from './bookings'
import { getEvents } from './events'

const MEMBERS_COLLECTION = 'members'

export const getMembers = async () => {
  const membersRef = collection(db, MEMBERS_COLLECTION)
  const q = query(membersRef, orderBy('createdAt', 'desc'))
  const snapshot = await getDocs(q)
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
}

export const getMember = async (uid) => {
  const memberRef = doc(db, MEMBERS_COLLECTION, uid)
  const snapshot = await getDoc(memberRef)
  if (snapshot.exists()) {
    return { id: snapshot.id, ...snapshot.data() }
  }
  return null
}

export const updateMember = async (uid, data) => {
  const memberRef = doc(db, MEMBERS_COLLECTION, uid)
  await updateDoc(memberRef, {
    ...data,
    updatedAt: new Date().toISOString()
  })
}

export const deleteMember = async (uid) => {
  const memberRef = doc(db, MEMBERS_COLLECTION, uid)
  await deleteDoc(memberRef)
}

/**
 * Get aggregated activity stats for a member
 * @param {string} uid - Member's user ID
 * @returns {Promise<{ totalBookings: number, eventsAttended: number, eventsOrganized: number }>}
 */
export const getMemberStats = async (uid) => {
  // Member profile stats look at lifetime-ish activity. Use a generous
  // 2-year-back / 1-year-forward window rather than scanning the full
  // collection on every profile open.
  const start = new Date()
  start.setDate(start.getDate() - 730)
  start.setHours(0, 0, 0, 0)
  const end = new Date()
  end.setDate(end.getDate() + 365)
  end.setHours(23, 59, 59, 999)
  const window = { startDate: start, endDate: end }

  const [bookings, events] = await Promise.all([
    getBookings({ memberId: uid, ...window }),
    getEvents(window)
  ])

  return {
    totalBookings: bookings.length,
    eventsAttended: events.filter(e => e.attendees?.includes(uid)).length,
    eventsOrganized: events.filter(e => e.organizerId === uid).length
  }
}
