import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  updateDoc
} from 'firebase/firestore'
import { db } from './firebase'
import { LOCAL_DEV_MODE } from '../utils/localDevMode'
import { createLocalPartner, deleteLocalPartner, listLocalPartners, updateLocalPartner } from './localDevStore'

// Partner organizations (e.g. 9AM Games, DiiD). Admins attach members to one
// through members.partnerId and pick the org's desk (deskAmenityId); the
// hourly scheduler keeps those members booked on it (functions/partnerDesks.js).
const PARTNERS_COLLECTION = 'partners'

export const getPartners = async () => {
  if (LOCAL_DEV_MODE) return listLocalPartners()
  const q = query(collection(db, PARTNERS_COLLECTION), orderBy('name'))
  const snapshot = await getDocs(q)
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }))
}

export const createPartner = async (name) => {
  const data = { name: name.trim() }
  if (LOCAL_DEV_MODE) return createLocalPartner(data)
  const now = new Date().toISOString()
  const ref = await addDoc(collection(db, PARTNERS_COLLECTION), { ...data, createdAt: now, updatedAt: now })
  return { id: ref.id, ...data, createdAt: now, updatedAt: now }
}

// deskAmenityId: a desk amenity id, or null for no automatic desk.
export const updatePartner = async (id, data) => {
  if (LOCAL_DEV_MODE) return updateLocalPartner(id, data)
  await updateDoc(doc(db, PARTNERS_COLLECTION, id), { ...data, updatedAt: new Date().toISOString() })
}

export const deletePartner = async (id) => {
  if (LOCAL_DEV_MODE) return deleteLocalPartner(id)
  await deleteDoc(doc(db, PARTNERS_COLLECTION, id))
}
