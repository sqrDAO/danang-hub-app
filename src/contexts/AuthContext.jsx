import { useCallback, useEffect, useRef, useState } from 'react'
import {
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail
} from 'firebase/auth'
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore'
import { auth, db, googleProvider } from '../services/firebase'
import {
  signInWithEVMWallet as walletAuthSignInWithEVMWallet,
  signInWithSolanaWallet as walletAuthSignInWithSolanaWallet,
} from '../services/walletAuth'
// Static import: this module holds no Firebase dependency, so it costs nothing
// to bundle, and a failed dynamic import here would throw out of logout()
// before signOut ever ran.
import { resetPushOptInPrompt } from '../utils/pushOptInPrompt'
import { AuthContext } from '../hooks/useAuth'

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null)
  const [userProfile, setUserProfile] = useState(null)
  // Guards the launch-time push token re-issue to once per signed-in uid.
  const pushRefreshedForUid = useRef(null)
  const [loading, setLoading] = useState(true)

  // Create or update user profile in Firestore
  const createUserProfile = async (user, extraFields = {}) => {
    const userRef = doc(db, 'members', user.uid)
    const userSnap = await getDoc(userRef)

    if (!userSnap.exists()) {
      const baseProfile = {
        uid: user.uid,
        displayName: user.displayName || '',
        email: user.email || '',
        photoURL: user.photoURL || '',
        membershipType: 'member',
        preferences: {
          emailNotifications: true,
          eventReminders: true,
          pushNotifications: false,
        },
        createdAt: new Date().toISOString(),
        ...(extraFields.walletAddress && { walletAddress: extraFields.walletAddress }),
      }
      await setDoc(userRef, baseProfile)
      setUserProfile(baseProfile)
      return baseProfile
    }

    // Doc already exists — always persist walletAddress if provided
    // (handles race where onAuthStateChanged created the doc before the wallet method ran)
    if (extraFields.walletAddress) {
      await updateDoc(userRef, { walletAddress: extraFields.walletAddress })
      const profileData = { ...userSnap.data(), walletAddress: extraFields.walletAddress }
      setUserProfile(profileData)
      return profileData
    }

    const profileData = userSnap.data()
    setUserProfile(profileData)
    return profileData
  }

  // Sign in with Google
  const signInWithGoogle = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider)
      await createUserProfile(result.user)
    } catch (error) {
      console.error('Error signing in with Google:', error)
      throw error
    }
  }

  // Sign up with Email and Password
  const signUpWithEmail = async (email, password, displayName) => {
    try {
      const result = await createUserWithEmailAndPassword(auth, email, password)
      
      // Update the user's display name
      await updateProfile(result.user, { displayName })
      
      // Create user profile in Firestore
      await createUserProfile({ ...result.user, displayName })
      
      return result.user
    } catch (error) {
      console.error('Error signing up with email:', error)
      throw error
    }
  }

  // Sign in with Email and Password
  const signInWithEmail = async (email, password) => {
    try {
      const result = await signInWithEmailAndPassword(auth, email, password)
      await createUserProfile(result.user)
      return result.user
    } catch (error) {
      console.error('Error signing in with email:', error)
      throw error
    }
  }

  // Reset password
  const resetPassword = async (email) => {
    try {
      await sendPasswordResetEmail(auth, email)
    } catch (error) {
      console.error('Error sending password reset email:', error)
      throw error
    }
  }

  // Sign in with EVM wallet (EIP-6963 provider)
  const signInWithEVMWallet = async (provider, address) => {
    try {
      const firebaseUser = await walletAuthSignInWithEVMWallet(provider, address)
      await createUserProfile(firebaseUser, {
        walletAddress: address,
      })
    } catch (error) {
      console.error('Error signing in with EVM wallet:', error)
      throw error
    }
  }

  // Sign in with a Solana wallet (Wallet Standard or legacy)
  const signInWithSolana = async (walletEntry) => {
    try {
      const { user: firebaseUser, address } = await walletAuthSignInWithSolanaWallet(walletEntry)
      await createUserProfile(firebaseUser, {
        walletAddress: address,
      })
    } catch (error) {
      console.error('Error signing in with Solana wallet:', error)
      throw error
    }
  }

  // Sign out
  const logout = async () => {
    try {
      resetPushOptInPrompt()
      if (currentUser?.uid && userProfile?.preferences?.pushNotifications) {
        try {
          const { disablePushNotificationsOnLogout } = await import('../services/pushNotifications')
          await disablePushNotificationsOnLogout(currentUser.uid)
        } catch (error) {
          console.warn('Unable to clear browser push notifications during logout:', error)
        }
      }
      await signOut(auth)
      setUserProfile(null)
    } catch (error) {
      console.error('Error signing out:', error)
      throw error
    }
  }

  // Check if user is admin
  const isAdmin = () => {
    return userProfile?.membershipType === 'admin'
  }

  // Profile is complete when Name, Email, Company and Role are all set
  const isProfileComplete = () => {
    const displayName = userProfile?.displayName?.trim()
    const email = userProfile?.email?.trim()
    const company = userProfile?.company?.trim()
    const jobTitle = userProfile?.jobTitle?.trim()
    return !!(displayName && email && company && jobTitle)
  }

  // Refresh user profile from Firestore after updates. Memoized because the
  // push token refresh effect below depends on it.
  const refreshUserProfile = useCallback(async () => {
    if (currentUser) {
      const userRef = doc(db, 'members', currentUser.uid)
      const userSnap = await getDoc(userRef)
      if (userSnap.exists()) {
        setUserProfile(userSnap.data())
      }
    }
  }, [currentUser])

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser(user)
        const userRef = doc(db, 'members', user.uid)
        const userSnap = await getDoc(userRef)
        if (userSnap.exists()) {
          setUserProfile(userSnap.data())
        } else {
          await createUserProfile(user)
        }
      } else {
        setCurrentUser(null)
        setUserProfile(null)
      }
      setLoading(false)
    })

    return unsubscribe
  }, [])

  // An FCM token is minted once at opt-in and then goes stale on its own —
  // cleared site data, a reinstalled PWA, the push service resubscribing. The
  // server drops preferences.pushNotifications to false on the first failed
  // send, so without a launch-time re-issue a member's push dies permanently
  // with nothing in the UI to say so. Deliberately outside the listener effect
  // below: that one gates on the very preference this heals.
  useEffect(() => {
    const uid = currentUser?.uid
    if (!uid) {
      pushRefreshedForUid.current = null
      return undefined
    }
    // Wait for the profile so a not-yet-loaded preference is not mistaken for
    // an opt-out and needlessly rewritten on every launch.
    if (!userProfile || pushRefreshedForUid.current === uid) return undefined
    pushRefreshedForUid.current = uid

    // No in-flight cancellation guard: userProfile is a dependency, so the
    // effect re-runs on any profile write, and a per-run flag would abort the
    // heal whenever an unrelated update landed mid-request. The ref above
    // already stops duplicate work, and refreshUserProfile is idempotent.
    const preferenceEnabled = Boolean(userProfile?.preferences?.pushNotifications)
    import('../services/pushNotifications')
      .then(({ refreshPushToken }) => refreshPushToken(uid, { preferenceEnabled }))
      .then((healed) => (healed ? refreshUserProfile() : undefined))
      .catch((error) => {
        // Best effort: a dead push token must never break sign-in or boot.
        console.warn('Unable to refresh browser push token:', error)
      })

    return undefined
  }, [currentUser, userProfile, refreshUserProfile])

  // FCM delivers to onMessage when a tab is open; without a handler Chrome shows
  // its default "site updated in the background" shell for unfocused tabs.
  useEffect(() => {
    const pushModule = () => import('../services/pushNotifications')
    const pushEnabled = Boolean(
      currentUser && userProfile?.preferences?.pushNotifications
    )
    if (!pushEnabled) {
      pushModule()
        .then(({ stopForegroundPushListener }) => stopForegroundPushListener())
        .catch(() => {})
      return undefined
    }

    let cancelled = false
    pushModule()
      .then(async ({ ensureForegroundPushListener, stopForegroundPushListener }) => {
        await ensureForegroundPushListener()
        // Effect cleaned up while ensure was in flight — drop the listener.
        if (cancelled) stopForegroundPushListener()
      })
      .catch((error) => {
        console.warn('Unable to start foreground push listener:', error)
      })

    return () => {
      cancelled = true
      pushModule()
        .then(({ stopForegroundPushListener }) => stopForegroundPushListener())
        .catch(() => {})
    }
  }, [currentUser, userProfile?.preferences?.pushNotifications])

  const value = {
    currentUser,
    userProfile,
    loading,
    signInWithGoogle,
    signUpWithEmail,
    signInWithEmail,
    signInWithEVMWallet,
    signInWithSolana,
    resetPassword,
    logout,
    isAdmin,
    isProfileComplete,
    refreshUserProfile,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
