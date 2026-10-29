import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query
} from 'firebase/firestore'
import { db } from './firebase'
import { LOCAL_DEV_MODE } from '../utils/localDevMode'
import { createLocalPartner, deleteLocalPartner, listLocalPartners } from './localDevStore'

// Partner organizations (e.g. 9AM Games, DiiD). Admins attach members to one
// through members.partnerId; those members get Partner Desk plans.
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

export const deletePartner = async (id) => {
  if (LOCAL_DEV_MODE) return deleteLocalPartner(id)
  await deleteDoc(doc(db, PARTNERS_COLLECTION, id))
}
