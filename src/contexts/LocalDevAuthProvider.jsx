import { useEffect, useMemo } from 'react'
import { AuthContext } from '../hooks/useAuth'
import { getLocalDevProfile, getLocalDevUser } from '../utils/localDevMode'

const asyncNoop = async () => {}

const buildLocalDevAuthValue = () => {
  const userProfile = getLocalDevProfile()
  return {
    currentUser: getLocalDevUser(),
    userProfile,
    loading: false,
    signInWithGoogle: asyncNoop,
    signUpWithEmail: asyncNoop,
    signInWithEmail: asyncNoop,
    signInWithEVMWallet: asyncNoop,
    signInWithSolana: asyncNoop,
    resetPassword: asyncNoop,
    logout: asyncNoop,
    isAdmin: () => userProfile.membershipType === 'admin',
    isProfileComplete: () => true,
    refreshUserProfile: asyncNoop
  }
}

export const LocalDevAuthProvider = ({ children }) => {
  const value = useMemo(() => buildLocalDevAuthValue(), [])

  useEffect(() => {
    console.info('[local-dev] skip-auth on; Firebase login is not used')
  }, [])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
