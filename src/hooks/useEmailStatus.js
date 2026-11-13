import { useCallback, useEffect, useState } from 'react'
import { reloadEmailVerified } from '../services/emailVerification'
import { getEmailStatus } from '../utils/emailVerification'

// Reloads an unverified Auth user on mount and whenever the window regains
// focus, so a link clicked in another tab (or its Continue button landing
// here) shows up. Keyed by uid, so it never credits another account.
// markVerified is for a send that finds the account already verified: that
// send has just reloaded the user, so no second reload is needed.
const useEmailStatus = (user) => {
  const [verifiedUid, setVerifiedUid] = useState(null)
  const status = getEmailStatus(user)
  const uid = user?.uid
  const markVerified = useCallback(() => setVerifiedUid(uid), [uid])
  const check = useCallback(() =>
    reloadEmailVerified()
      .then((nowVerifiedUid) => { if (nowVerifiedUid) setVerifiedUid(nowVerifiedUid) })
      .catch((error) => console.warn('Unable to refresh email verification:', error)), [])
  useEffect(() => {
    if (status !== 'unverified') return undefined
    check()
    window.addEventListener('focus', check)
    return () => window.removeEventListener('focus', check)
  }, [status, uid, check])
  return [uid && verifiedUid === uid ? 'verified' : status, markVerified]
}

export default useEmailStatus
