import {
  addDoc,
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  runTransaction,
  where
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
// Runs in a transaction: a desk another partner holds is refused (the panel's
// disabled option reads a cached list), and two quick changes for the same
// partner retry on its doc instead of both reserving a desk.
export const PARTNER_DESK_TAKEN = 'partner-desk-taken'

const reservedDeskRefs = async (partnerId) => {
  const reserved = await getDocs(query(collection(db, AMENITIES_COLLECTION), where('reservedForPartnerId', '==', partnerId)))
  return reserved.docs.map(d => d.ref)
}

const releaseDesks = async (tx, partnerId, refs, now) => {
  const snaps = await Promise.all(refs.map(ref => tx.get(ref)))
  snaps
    .filter(snap => snap.exists() && snap.data().reservedForPartnerId === partnerId)
    .forEach(snap => tx.update(snap.ref, { reservedForPartnerId: null, updatedAt: now }))
}

const reserveDesk = async (tx, partnerId, deskAmenityId, now) => {
  const desk = await tx.get(doc(db, AMENITIES_COLLECTION, deskAmenityId))
  const holder = desk.data()?.reservedForPartnerId
  if (!desk.exists() || (holder != null && holder !== partnerId)) throw new Error(PARTNER_DESK_TAKEN)
  return () => tx.update(desk.ref, { reservedForPartnerId: partnerId, updatedAt: now })
}

// deskAmenityId: a desk amenity id, or null for no automatic desk.
export const setPartnerDesk = async (id, deskAmenityId) => {
  if (LOCAL_DEV_MODE) return setLocalPartnerDesk(id, deskAmenityId)
  const now = new Date().toISOString()
  const found = await reservedDeskRefs(id)
  await runTransaction(db, async (tx) => {
    const partnerRef = doc(db, PARTNERS_COLLECTION, id)
    const current = (await tx.get(partnerRef)).data()?.deskAmenityId
    const release = [...found, ...(current ? [doc(db, AMENITIES_COLLECTION, current)] : [])]
      .filter((ref, i, all) => ref.id !== deskAmenityId && all.findIndex(r => r.id === ref.id) === i)
    // Firestore transactions read everything before the first write.
    const reserve = deskAmenityId ? await reserveDesk(tx, id, deskAmenityId, now) : null
    await releaseDesks(tx, id, release, now)
    reserve?.()
    tx.update(partnerRef, { deskAmenityId, updatedAt: now })
  })
}

export const deletePartner = async (id) => {
  if (LOCAL_DEV_MODE) return deleteLocalPartner(id)
  const now = new Date().toISOString()
  const found = await reservedDeskRefs(id)
  await runTransaction(db, async (tx) => {
    await releaseDesks(tx, id, found, now)
    tx.delete(doc(db, PARTNERS_COLLECTION, id))
  })
}
