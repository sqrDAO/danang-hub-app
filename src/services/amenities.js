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
import { EVENT_SPACE_AVAILABILITY } from '../utils/eventSpaceHours'
import { LOCAL_DEV_MODE } from '../utils/localDevMode'
import {
  createLocalAmenity,
  deleteLocalAmenity,
  getLocalAmenity,
  listLocalAmenities,
  updateLocalAmenity
} from './localDevStore'

const AMENITIES_COLLECTION = 'amenities'

export const getAmenities = async () => {
  if (LOCAL_DEV_MODE) return listLocalAmenities()
  const amenitiesRef = collection(db, AMENITIES_COLLECTION)
  const q = query(amenitiesRef, orderBy('name'))
  const snapshot = await getDocs(q)
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
}

export const getAmenity = async (id) => {
  if (LOCAL_DEV_MODE) return getLocalAmenity(id)
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

export const getDefaultAvailability = (type) =>
  type === 'event-space' ? EVENT_SPACE_AVAILABILITY : DEFAULT_AVAILABILITY

export const getDayAvailability = (dayOfWeek, amenity) => {
  const defaults = getDefaultAvailability(amenity?.type)
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6

  let startHour = amenity?.startHour ?? defaults.startHour
  if (amenity?.type === 'event-space' || defaults.weekdayStartHour !== undefined) {
    if (!isWeekend) {
      startHour = amenity?.weekdayStartHour ?? defaults.weekdayStartHour ?? startHour
    }
  }

  const endHour = amenity?.endHour ?? defaults.endHour
  const availableDays = amenity?.availableDays ?? defaults.availableDays
  const isDayAvailable = availableDays.includes(dayOfWeek)

  return {
    startHour,
    endHour,
    availableDays,
    isDayAvailable,
  }
}


export const createAmenity = async (data) => {
  if (LOCAL_DEV_MODE) return createLocalAmenity(data)
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
  if (LOCAL_DEV_MODE) return updateLocalAmenity(id, data)
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
  if (LOCAL_DEV_MODE) return deleteLocalAmenity(id)
  const amenityRef = doc(db, AMENITIES_COLLECTION, id)
  await deleteDoc(amenityRef)
}
