import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  query,
  orderBy
} from 'firebase/firestore'
import { db } from './firebase'

const PROJECTS_COLLECTION = 'projects'

export const getProjects = async () => {
  const projectsRef = collection(db, PROJECTS_COLLECTION)
  const q = query(projectsRef, orderBy('name'))
  const snapshot = await getDocs(q)
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
}

export const getProject = async (id) => {
  const projectRef = doc(db, PROJECTS_COLLECTION, id)
  const snapshot = await getDoc(projectRef)
  if (snapshot.exists()) {
    return { id: snapshot.id, ...snapshot.data() }
  }
  return null
}
