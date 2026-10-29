import {
  addDoc,
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  where,
  writeBatch
} from 'firebase/firestore'
import { db } from './firebase'
import { LOCAL_DEV_MODE } from '../utils/localDevMode'
import { createLocalPartner, deleteLocalPartner, listLocalPartners, setLocalPartnerDesk } from './localDevStore'

// Partner organizations (e.g. 9AM Games, DiiD). Admins attach members to one
// through members.partnerId and pick the org's desk (deskAmenityId); the
// hourly scheduler keeps those members booked on it (functions/partnerDesks.js).
const PARTNERS_COLLECTION = 'partners'
const AMENITIES_COLLECTION = 'amenities'

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

// The desk a partner picks is reserved for it (amenities.reservedForPartnerId):
// other members cannot see or book it (firestore.rules). Every desk still
// marked for the partner is released first, so a changed, cleared or deleted
// partner never leaves a stale reservation behind, even after drift.
const releasePartnerDesks = async (batch, partnerId, keepAmenityId, now) => {
  const reserved = await getDocs(query(collection(db, AMENITIES_COLLECTION), where('reservedForPartnerId', '==', partnerId)))
  reserved.docs
    .filter(d => d.id !== keepAmenityId)
    .forEach(d => batch.update(d.ref, { reservedForPartnerId: null, updatedAt: now }))
}

// deskAmenityId: a desk amenity id, or null for no automatic desk.
export const setPartnerDesk = async (id, deskAmenityId) => {
  if (LOCAL_DEV_MODE) return setLocalPartnerDesk(id, deskAmenityId)
  const now = new Date().toISOString()
  const batch = writeBatch(db)
  await releasePartnerDesks(batch, id, deskAmenityId, now)
  batch.update(doc(db, PARTNERS_COLLECTION, id), { deskAmenityId, updatedAt: now })
  if (deskAmenityId) {
    batch.update(doc(db, AMENITIES_COLLECTION, deskAmenityId), { reservedForPartnerId: id, updatedAt: now })
  }
  await batch.commit()
}

export const deletePartner = async (id) => {
  if (LOCAL_DEV_MODE) return deleteLocalPartner(id)
  const batch = writeBatch(db)
  await releasePartnerDesks(batch, id, null, new Date().toISOString())
  batch.delete(doc(db, PARTNERS_COLLECTION, id))
  await batch.commit()
}
