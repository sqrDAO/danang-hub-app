import { useEffect, useState } from 'react'
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
import { AuthContext } from '../hooks/useAuth'

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null)
  const [userProfile, setUserProfile] = useState(null)
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

  // Refresh user profile from Firestore after updates
  const refreshUserProfile = async () => {
    if (currentUser) {
      const userRef = doc(db, 'members', currentUser.uid)
      const userSnap = await getDoc(userRef)
      if (userSnap.exists()) {
        setUserProfile(userSnap.data())
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
