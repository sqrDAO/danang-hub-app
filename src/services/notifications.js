import {
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  doc,
  orderBy
} from 'firebase/firestore'
import { db } from './firebase'

export const getUnreadNotifications = async (userId) => {
  const q = query(
    collection(db, 'notifications'),
    where('userId', '==', userId),
    where('read', '==', false),
    orderBy('createdAt', 'desc')
  )
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export const markNotificationRead = async (notificationId) => {
  await updateDoc(doc(db, 'notifications', notificationId), { read: true })
}
