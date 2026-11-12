import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import useEmailStatus from '../../hooks/useEmailStatus'
import Layout from '../../components/Layout'
import { sendVerificationEmail } from '../../services/emailVerification'
import {
  formatCooldown,
  readVerifySentAt,
  verifyCooldownSecondsLeft,
  verifyErrorKey
} from '../../utils/emailVerification'
import { showToast } from '../../utils/toast'
import './Profile.css'

// The last send time lives in session storage, so leaving this screen and
// coming back can't reset the cooldown or forget that a link went out.
const useSendLink = (uid, onAlreadyVerified) => {
  const { pathname } = useLocation()
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
      if (await sendVerificationEmail(i18n.language, pathname)) {
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

// One layout for every state: title, intro, the address with a status tag,
// then the state's own action. Built from Profile's card and detail row.
const VerifyCard = ({ title, intro, email, tag, children }) => (
  <>
    <h1 className="page-title">{title}</h1>
    <div className="profile-card glass">
      <p className="verify-email-text">{intro}</p>
      <div className="profile-detail-item verify-email-row">
        <span className="detail-value">{email}</span>
        {tag}
      </div>
      {children}
    </div>
  </>
)

const SendLinkCard = ({ uid, email, onAlreadyVerified, forNotifications }) => {
  const { t } = useTranslation()
  const link = useSendLink(uid, onAlreadyVerified)
  if (link.sent) {
    return (
      <VerifyCard
        title={t('profile.verifyEmailSentTitle')}
        intro={t('profile.emailLinkSent')}
        email={email}
        tag={<span className="status-badge pending">{t('profile.verifyEmailLinkSentTag')}</span>}
      >
        <button type="button" className="btn btn-secondary verify-email-btn" onClick={link.send} disabled={link.busy}>
          {link.secondsLeft > 0
            ? t('profile.verifyEmailResendIn', { time: formatCooldown(link.secondsLeft) })
            : t('profile.verifyEmailResend')}
        </button>
        <p className="verify-email-text verify-email-text--after">{t('profile.verifyEmailSpam')}</p>
      </VerifyCard>
    )
  }
  return (
    <VerifyCard
      title={t('profile.verifyEmailTitle')}
      intro={t(forNotifications ? 'profile.verifyEmailForNotifications' : 'profile.verifyEmailHelp')}
      email={email}
      tag={<span className="status-badge pending">{t('profile.verifyEmailNotVerified')}</span>}
    >
      <button type="button" className="btn btn-primary verify-email-btn" onClick={link.send} disabled={link.busy}>
        {t('profile.verifyEmail')}
      </button>
    </VerifyCard>
  )
}

const VerifiedCard = ({ email, emailNotificationsOn, profilePath }) => {
  const { t } = useTranslation()
  return (
    <VerifyCard
      title={t('profile.verifyEmailDoneTitle')}
      intro={t(emailNotificationsOn ? 'profile.verifyEmailDone' : 'profile.verifyEmailDoneOff')}
      email={email}
      tag={<span className="status-badge approved">{t('profile.emailVerified')}</span>}
    >
      <Link to={profilePath} className="btn btn-primary verify-email-btn">{t('profile.backToProfile')}</Link>
    </VerifyCard>
  )
}

// Optional: verifying only unlocks event emails. Reached from the email
// notifications value on Profile, after a save with them on (which passes
// forNotifications), and from the Continue button in the email.
const VerifyEmail = () => {
  const { currentUser, userProfile } = useAuth()
  const { state, pathname } = useLocation()
  const [status, markVerified] = useEmailStatus(currentUser)
  const isAdminRoute = pathname.startsWith('/admin')
  const profilePath = isAdminRoute ? '/admin/profile' : '/member/profile'
  // A wallet account has no sign-in email to verify.
  if (status === 'none') return <Navigate to={profilePath} replace />
  return (
    <Layout isAdmin={isAdminRoute}>
      <div className="container">
        {status === 'verified'
          ? <VerifiedCard email={currentUser.email} emailNotificationsOn={userProfile?.preferences?.emailNotifications !== false} profilePath={profilePath} />
          : (
            <SendLinkCard
              uid={currentUser.uid}
              email={currentUser.email}
              onAlreadyVerified={markVerified}
              forNotifications={state?.forNotifications}
            />
          )}
      </div>
    </Layout>
  )
}

export default VerifyEmail
