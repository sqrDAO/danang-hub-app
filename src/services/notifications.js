import {
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  doc,
  writeBatch,
  orderBy,
  limit
} from 'firebase/firestore'
import { db } from './firebase'

const mapNotificationDoc = (docSnap) => {
  const data = docSnap.data()
  return {
    id: docSnap.id,
    ...data,
    createdAt: data.createdAt?.toDate?.() || data.createdAt || null,
  }
}

export const getUnreadNotifications = async (userId) => {
  const q = query(
    collection(db, 'notifications'),
    where('userId', '==', userId),
    where('read', '==', false),
    orderBy('createdAt', 'desc'),
    limit(50)
  )
  const snap = await getDocs(q)
  return snap.docs.map(mapNotificationDoc)
}

export const markNotificationRead = async (notificationId) => {
  await updateDoc(doc(db, 'notifications', notificationId), { read: true })
}

export const markNotificationsRead = async (notificationIds) => {
  if (!notificationIds.length) return
  const batch = writeBatch(db)
  notificationIds.forEach((notificationId) => {
    batch.update(doc(db, 'notifications', notificationId), { read: true })
  })
  await batch.commit()
}
