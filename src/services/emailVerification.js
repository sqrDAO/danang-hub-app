import { sendEmailVerification } from 'firebase/auth'
import { auth } from './firebase'
import { LOCAL_DEV_MODE } from '../utils/localDevMode'

// Firebase sends the email itself, in auth.languageCode. The continue URL
// gives Firebase's "email verified" page a Continue button back to Profile.
export const sendVerificationEmail = async (language) => {
  if (LOCAL_DEV_MODE) return
  auth.languageCode = language?.startsWith('vi') ? 'vi' : 'en'
  await sendEmailVerification(auth.currentUser, {
    url: `${window.location.origin}/member/profile`
  })
}

// Firebase restores emailVerified from its cache, so a link clicked in another
// tab only shows up after a reload of the Auth user.
export const reloadEmailVerified = async () => {
  if (LOCAL_DEV_MODE || !auth.currentUser) return false
  await auth.currentUser.reload()
  return auth.currentUser.emailVerified
}
