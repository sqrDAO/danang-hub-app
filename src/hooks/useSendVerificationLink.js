import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { sendVerificationEmail } from '../services/emailVerification'
import { readVerifySentAt, verifyCooldownSecondsLeft, verifyErrorKey } from '../utils/emailVerification'
import { showToast } from '../utils/toast'

// Sends the verification email whose Continue button returns to
// `continuePath` (the verify screen, or the OAuth consent request). The last
// send time lives in session storage, so leaving the screen and coming back
// can't reset the cooldown or forget that a link went out.
const useSendVerificationLink = (uid, continuePath, onAlreadyVerified) => {
  const { t, i18n } = useTranslation()
  const [sending, setSending] = useState(false)
  const [sentAt, setSentAt] = useState(() => readVerifySentAt(uid))
  const [now, setNow] = useState(Date.now)
  const secondsLeft = verifyCooldownSecondsLeft(sentAt, now)

  useEffect(() => {
    if (secondsLeft <= 0) return undefined
    const timer = setTimeout(() => setNow(Date.now()), 1000)
    return () => clearTimeout(timer)
  }, [secondsLeft, now])

  const send = async () => {
    setSending(true)
    try {
      if (await sendVerificationEmail(i18n.language, continuePath)) {
        setSentAt(Date.now())
      } else {
        onAlreadyVerified()
      }
      setNow(Date.now())
    } catch (error) {
      console.error('Error sending verification email:', error)
      showToast(t(verifyErrorKey(error)), 'error')
    } finally {
      setSending(false)
    }
  }

  return { send, secondsLeft, sent: sentAt > 0, busy: sending || secondsLeft > 0 }
}

export default useSendVerificationLink
