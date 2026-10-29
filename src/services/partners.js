import {
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
import { PARTNER_DESK_MISSING, PARTNER_DESK_TAKEN } from '../utils/deskPlans'
import { createLocalPartner, deleteLocalPartner, listLocalPartners, setLocalPartnerDesk } from './localDevStore'

// Partner organizations (e.g. 9AM Games, DiiD). Admins attach members to one
// through members.partnerId and pick the org's desk (deskAmenityId); the
// hourly scheduler keeps those members booked on it (functions/partnerDesks.js).
const PARTNERS_COLLECTION = 'partners'
const AMENITIES_COLLECTION = 'amenities'
const MEMBERS_COLLECTION = 'members'

export const getPartners = async () => {
  if (LOCAL_DEV_MODE) return listLocalPartners()
  const q = query(collection(db, PARTNERS_COLLECTION), orderBy('name'))
  const snapshot = await getDocs(q)
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }))
}


// The desk a partner picks is reserved for it (amenities.reservedForPartnerId):
// other members cannot see or book it (firestore.rules). Every desk still
// marked for the partner is released first, so a changed, cleared or deleted
// partner never leaves a stale reservation behind, even after drift.
// Runs in a transaction: a desk another partner holds is refused (the panel's
// disabled option reads a cached list), and two quick changes for the same
// partner retry on its doc instead of both reserving a desk. A reservation
// left by a partner that no longer exists is taken over, so it never sticks.
export { PARTNER_DESK_TAKEN }

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
  if (!desk.exists()) throw new Error(PARTNER_DESK_MISSING)
  const holder = desk.data().reservedForPartnerId
  if (holder != null && holder !== partnerId &&
      (await tx.get(doc(db, PARTNERS_COLLECTION, holder))).exists()) {
    throw new Error(PARTNER_DESK_TAKEN)
  }
  return () => tx.update(desk.ref, { reservedForPartnerId: partnerId, updatedAt: now })
}

// A partner is created with its desk, reserved in the same transaction, so
// it never exists without one.
export const createPartner = async ({ name, deskAmenityId }) => {
  const data = { name: name.trim(), deskAmenityId }
  if (LOCAL_DEV_MODE) return createLocalPartner(data)
  const now = new Date().toISOString()
  const ref = doc(collection(db, PARTNERS_COLLECTION))
  await runTransaction(db, async (tx) => {
    const reserve = await reserveDesk(tx, ref.id, deskAmenityId, now)
    reserve()
    tx.set(ref, { ...data, createdAt: now, updatedAt: now })
  })
  return { id: ref.id, ...data, createdAt: now, updatedAt: now }
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

// Removing a partner detaches its members, releases its desk and deletes it,
// all at once. The hourly sync then cancels the members' upcoming partner
// days and notifies them (partner-removed).
export const deletePartner = async (id) => {
  if (LOCAL_DEV_MODE) return deleteLocalPartner(id)
  const now = new Date().toISOString()
  const found = await reservedDeskRefs(id)
  const attached = await getDocs(query(collection(db, MEMBERS_COLLECTION), where('partnerId', '==', id)))
  await runTransaction(db, async (tx) => {
    // Reads first: only members still attached here are detached.
    const members = await Promise.all(attached.docs.map(d => tx.get(d.ref)))
    await releaseDesks(tx, id, found, now)
    members
      .filter(snap => snap.exists() && snap.data().partnerId === id)
      .forEach(snap => tx.update(snap.ref, { partnerId: null, updatedAt: now }))
    tx.delete(doc(db, PARTNERS_COLLECTION, id))
  })
}
