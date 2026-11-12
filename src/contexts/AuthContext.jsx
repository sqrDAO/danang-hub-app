import { useEffect, useRef, useState } from 'react'
import {
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail
} from 'firebase/auth'
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore'
import { auth, db, googleProvider } from '../services/firebase'
import { setAuthEmailLanguage } from '../services/emailVerification'
import { updateMember } from '../services/members'
import i18n from '../i18n'
import {
  signInWithEVMWallet as walletAuthSignInWithEVMWallet,
  signInWithSolanaWallet as walletAuthSignInWithSolanaWallet,
} from '../services/walletAuth'
// Static import: this module holds no Firebase dependency, so it costs nothing
// to bundle, and a failed dynamic import here would throw out of logout()
// before signOut ever ran.
import { resetPushOptInPrompt } from '../utils/pushOptInPrompt'
import { isDeviceOptedIn, shouldAttemptLaunchPushRefresh } from '../utils/pushDeviceOptIn'
import { AuthContext } from '../hooks/useAuth'
import { missingProfileFields } from '../utils/profileFields'

// members.email mirrors the Auth email for an account that has one, so this
// brings an older, typed-in address in line;
// functions/scripts/sync-member-emails.cjs did the same for every profile once.
// A wallet account has no Auth email and types its own contact address.
// Not awaited: a Firestore write resolves only once the server acknowledges
// it, so waiting would hold sign-in on a dropped connection. The returned
// profile already shows the Auth email, which is the true value either way.
// The rules compare against the email in the ID token, which can predate an
// email change for up to an hour, so the token is refreshed first.
const withAuthEmail = (user, profile) => {
  if (!user.email || profile.email === user.email) return profile
  user.getIdToken(true)
    .then(() => updateMember(user.uid, { email: user.email }))
    .catch((error) => console.warn('Unable to sync the profile email:', error))
  return { ...profile, email: user.email }
}

// A new email/password sign-up must verify its email before using the app
// (ProtectedRoute sends it to the verify screen). Profiles created before this
// flag existed don't have it, so verifying stays optional for them.
const verificationRequirement = (user) =>
  (user.email && !user.emailVerified ? { emailVerificationRequired: true } : {})

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
          // On for a verified (Google) email; an unverified one opts in on
          // Profile, and that save leads to the verify screen.
          emailNotifications: user.emailVerified === true,
          eventReminders: true,
          pushNotifications: false,
        },
        createdAt: new Date().toISOString(),
        ...verificationRequirement(user),
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
      const profileData = withAuthEmail(user, { ...userSnap.data(), walletAddress: extraFields.walletAddress })
      setUserProfile(profileData)
      return profileData
    }

    const profileData = withAuthEmail(user, userSnap.data())
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
  // Name is collected later on the profile page, like Google and wallet sign-ups
  const signUpWithEmail = async (email, password) => {
    try {
      const result = await createUserWithEmailAndPassword(auth, email, password)

      // Create user profile in Firestore
      await createUserProfile(result.user)

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
      setAuthEmailLanguage(i18n.language)
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
      // Not gated on this phone's marker: a phone not yet adopted can still
      // hold a live token, and logout must not leave it receiving.
      if (currentUser?.uid) {
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

  // Profile is complete when Name, Company and Role are set. Email isn't
  // required; verifying is a separate gate (isEmailVerificationPending).
  const isProfileComplete = () => missingProfileFields(userProfile).length === 0

  // reload() on the verify screen updates currentUser in place, so the next
  // render after the link is clicked lets the account through.
  const isEmailVerificationPending = () =>
    userProfile?.emailVerificationRequired === true && currentUser?.emailVerified !== true

  const refreshUserProfile = async () => {
    if (currentUser) {
      const userRef = doc(db, 'members', currentUser.uid)
      const userSnap = await getDoc(userRef)
      if (userSnap.exists()) {
        setUserProfile(withAuthEmail(currentUser, userSnap.data()))
      }
    }
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser(user)
        const userRef = doc(db, 'members', user.uid)
        const userSnap = await getDoc(userRef)
        if (userSnap.exists()) {
          setUserProfile(withAuthEmail(user, userSnap.data()))
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
  // server deletes the stored token on the first failed send but leaves the
  // account preference alone, so without a launch-time re-issue a member's
  // push stays opted in and never delivers. Deliberately outside the listener
  // effect below: that one only starts/stops the foreground handler.
  useEffect(() => {
    const uid = currentUser?.uid
    if (!uid) {
      pushRefreshedForUid.current = null
      return undefined
    }
    // Wait until the mounted profile belongs to this uid. A not-yet-loaded
    // preference must not be mistaken for an opt-out (that would skip the
    // token write for this uid for good), and a previous account's profile
    // must not burn the once-per-uid refresh against the wrong preference.
    if (!shouldAttemptLaunchPushRefresh({
      uid,
      profileUid: userProfile?.uid,
      alreadyRefreshedUid: pushRefreshedForUid.current
    })) return undefined
    pushRefreshedForUid.current = uid

    const preferenceEnabled = Boolean(userProfile?.preferences?.pushNotifications)
    import('../services/pushNotifications')
      .then(({ refreshPushToken }) => refreshPushToken(uid, { preferenceEnabled }))
      .catch((error) => {
        // Best effort: a dead push token must never break sign-in or boot.
        console.warn('Unable to refresh browser push token:', error)
      })

    return undefined
  }, [currentUser, userProfile])

  // FCM delivers to onMessage when a tab is open; without a handler Chrome shows
  // its default "site updated in the background" shell for unfocused tabs.
  useEffect(() => {
    const pushModule = () => import('../services/pushNotifications')
    // Per phone: another phone's opt-in says nothing about this one. An
    // adopted phone starts its listener from refreshPushToken instead.
    const pushEnabled = Boolean(currentUser && isDeviceOptedIn(currentUser.uid))
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
  }, [currentUser])

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
    isEmailVerificationPending,
    refreshUserProfile,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
