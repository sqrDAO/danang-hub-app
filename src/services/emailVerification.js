import { sendEmailVerification } from 'firebase/auth'
import { auth } from './firebase'
import { LOCAL_DEV_MODE } from '../utils/localDevMode'
import { recordVerifySent } from '../utils/emailVerification'

// Firebase writes its emails in auth.languageCode, which stays set for the
// session, so every email-sending call sets it from the current app language.
export const setAuthEmailLanguage = (language) => {
  auth.languageCode = language?.startsWith('vi') ? 'vi' : 'en'
}

// The continue URL gives Firebase's "email verified" page a Continue button
// back to the Profile page the member sent it from (member or admin layout).
export const sendVerificationEmail = async (language, continuePath = '/member/profile') => {
  if (LOCAL_DEV_MODE) return
  setAuthEmailLanguage(language)
  const user = auth.currentUser
  await sendEmailVerification(user, { url: `${window.location.origin}${continuePath}` })
  recordVerifySent(user.uid)
}

// Firebase restores emailVerified from its cache, so a link clicked in another
// tab only shows up after a reload of the Auth user. Resolves to the uid that
// is now verified, or null, so a caller can't credit a different account.
export const reloadEmailVerified = async () => {
  if (LOCAL_DEV_MODE || !auth.currentUser) return null
  const user = auth.currentUser
  await user.reload()
  return user.emailVerified ? user.uid : null
}
