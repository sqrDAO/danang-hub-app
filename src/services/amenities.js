import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc,
  query,
  orderBy
} from 'firebase/firestore'
import { db } from './firebase'

const AMENITIES_COLLECTION = 'amenities'

export const getAmenities = async () => {
  const amenitiesRef = collection(db, AMENITIES_COLLECTION)
  const q = query(amenitiesRef, orderBy('name'))
  const snapshot = await getDocs(q)
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
}

export const getAmenity = async (id) => {
  const amenityRef = doc(db, AMENITIES_COLLECTION, id)
  const snapshot = await getDoc(amenityRef)
  if (snapshot.exists()) {
    return { id: snapshot.id, ...snapshot.data() }
  }
  return null
}

// Main event space (e.g. Main Hall) accommodates up to 80 people
export const EVENT_SPACE_CAPACITY = 80

// Default capacity by amenity type
export const DEFAULT_CAPACITY_BY_TYPE = {
  desk: 1,
  'meeting-room': 10,
  'podcast-room': 5,
  'event-space': EVENT_SPACE_CAPACITY
}

// Default availability settings
export const DEFAULT_AVAILABILITY = {
  isAvailable: true,
  startHour: 9,  // 9 AM VN time
  endHour: 18,   // 6 PM VN time
  availableDays: [1, 2, 3, 4, 5], // Monday to Friday (0=Sunday, 1=Monday, etc.)
  slotDuration: 30, // minutes
  timezone: 'Asia/Ho_Chi_Minh'
}

// Event spaces: after 6 PM on weekdays, 9 AM–10 PM on weekends
export const EVENT_SPACE_AVAILABILITY = {
  isAvailable: true,
  startHour: 9,          // Weekend start: 9 AM
  weekdayStartHour: 18,  // Weekday start: 6 PM (after office hours)
  endHour: 22,           // All days end: 10 PM
  availableDays: [0, 1, 2, 3, 4, 5, 6],
  slotDuration: 60,
  timezone: 'Asia/Ho_Chi_Minh'
}

export const getDefaultAvailability = (type) =>
  type === 'event-space' ? EVENT_SPACE_AVAILABILITY : DEFAULT_AVAILABILITY

// Returns a translation key if the date/duration violates event-space hours, null if valid.
export const validateEventSpaceTime = (dateValue, durationMinutes = 60) => {
  if (!dateValue) return null
  const date = new Date(dateValue)
  const dayOfWeek = date.getDay()
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
  const startHour = date.getHours() + date.getMinutes() / 60
  const endHour = startHour + durationMinutes / 60

  if (!isWeekend && startHour < EVENT_SPACE_AVAILABILITY.weekdayStartHour) {
    return 'memberEvents.modal.weekdayHoursError'
  }
  if (isWeekend && startHour < EVENT_SPACE_AVAILABILITY.startHour) {
    return 'memberEvents.modal.weekendHoursError'
  }
  if (endHour > EVENT_SPACE_AVAILABILITY.endHour) {
    return 'memberEvents.modal.endTimeError'
  }
  return null
}

export const createAmenity = async (data) => {
  const amenitiesRef = collection(db, AMENITIES_COLLECTION)
  const defaultCapacity = DEFAULT_CAPACITY_BY_TYPE[data.type] ?? 1
  const defaults = getDefaultAvailability(data.type)
  const docRef = await addDoc(amenitiesRef, {
    ...data,
    capacity: data.capacity ?? defaultCapacity,
    isAvailable: data.isAvailable !== undefined ? data.isAvailable : defaults.isAvailable,
    startHour: data.startHour !== undefined ? data.startHour : defaults.startHour,
    endHour: data.endHour !== undefined ? data.endHour : defaults.endHour,
    availableDays: data.availableDays || defaults.availableDays,
    slotDuration: data.slotDuration || defaults.slotDuration,
    photos: data.photos || [],
    createdAt: new Date().toISOString()
  })
  return docRef.id
}

export const updateAmenity = async (id, data) => {
  const amenityRef = doc(db, AMENITIES_COLLECTION, id)
  const updateData = {
    ...data,
    updatedAt: new Date().toISOString()
  }
  // Preserve photos array if not provided in update
  if (!('photos' in data)) {
    const currentDoc = await getDoc(amenityRef)
    if (currentDoc.exists()) {
      updateData.photos = currentDoc.data().photos || []
    }
  }
  await updateDoc(amenityRef, updateData)
}

export const deleteAmenity = async (id) => {
  const amenityRef = doc(db, AMENITIES_COLLECTION, id)
  await deleteDoc(amenityRef)
}
