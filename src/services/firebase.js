import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider, connectAuthEmulator } from 'firebase/auth'
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore'
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions'
import { getStorage, connectStorageEmulator } from 'firebase/storage'

// Firebase configuration
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
}

// Initialize Firebase
const app = initializeApp(firebaseConfig)

// Initialize services
export const auth = getAuth(app)
export const db = getFirestore(app)
// Region pinned to us-central1 to match where the Functions are actually
// deployed; an attempted move to asia-southeast1 was rolled back due to an
// IAM permission gap on the deploying account.
export const functions = getFunctions(app, 'us-central1')
export const storage = getStorage(app)

// Connect to local emulators when VITE_USE_EMULATORS=true.
// Guarded against HMR double-connects via a window flag.
if (import.meta.env.VITE_USE_EMULATORS === 'true' && !globalThis.__FIREBASE_EMULATORS_CONNECTED__) {
  const host = import.meta.env.VITE_EMULATOR_HOST || 'localhost'
  connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true })
  connectFirestoreEmulator(db, host, 8080)
  connectFunctionsEmulator(functions, host, 5001)
  connectStorageEmulator(storage, host, 9199)
  globalThis.__FIREBASE_EMULATORS_CONNECTED__ = true
  console.info('[firebase] Connected to local emulators on', host)
}

// Auth providers
export const googleProvider = new GoogleAuthProvider()
googleProvider.setCustomParameters({
  prompt: 'select_account'
})

export default app
