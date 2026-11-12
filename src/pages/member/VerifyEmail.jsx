import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import useEmailStatus from '../../hooks/useEmailStatus'
import Layout from '../../components/Layout'
import { changeSignInEmail, sendVerificationEmail } from '../../services/emailVerification'
import {
  changeEmailErrorKey,
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

const SendLinkCard = ({ uid, email, onAlreadyVerified, introKey, footer }) => {
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
        {footer}
      </VerifyCard>
    )
  }
  return (
    <VerifyCard
      title={t('profile.verifyEmailTitle')}
      intro={t(introKey)}
      email={email}
      tag={<span className="status-badge pending">{t('profile.verifyEmailNotVerified')}</span>}
    >
      <button type="button" className="btn btn-primary verify-email-btn" onClick={link.send} disabled={link.busy}>
        {t('profile.verifyEmail')}
      </button>
      {footer}
    </VerifyCard>
  )
}

// A mistyped sign-up address: the link goes to the new address, and the
// sign-in email changes only once it is clicked there.
const useChangeEmail = (currentEmail, onSent) => {
  const { pathname } = useLocation()
  const { t, i18n } = useTranslation()
  const [sending, setSending] = useState(false)
  const submit = async (event) => {
    event.preventDefault()
    const newEmail = new FormData(event.target).get('newEmail').trim()
    if (newEmail.toLowerCase() === currentEmail.toLowerCase()) {
      showToast(t('profile.changeEmailSame'), 'error')
      return
    }
    setSending(true)
    try {
      await changeSignInEmail(newEmail, i18n.language, pathname)
      onSent(newEmail)
    } catch (error) {
      console.error('Error changing the sign-in email:', error)
      showToast(t(changeEmailErrorKey(error)), 'error')
    } finally {
      setSending(false)
    }
  }
  return { submit, sending }
}

const ChangeEmailForm = ({ currentEmail, onSent }) => {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const change = useChangeEmail(currentEmail, onSent)
  if (!open) {
    return (
      <p className="verify-email-text verify-email-text--after">
        <button type="button" className="profile-link verify-email-change" onClick={() => setOpen(true)}>
          {t('profile.changeEmailToggle')}
        </button>
      </p>
    )
  }
  return (
    <form className="verify-email-change-form" onSubmit={change.submit}>
      <label className="form-label" htmlFor="verify-new-email">{t('profile.changeEmailLabel')}</label>
      <input id="verify-new-email" type="email" name="newEmail" className="form-field" required autoFocus />
      <div className="verify-email-change-actions">
        <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>{t('common.cancel')}</button>
        <button type="submit" className="btn btn-primary" disabled={change.sending}>{t('profile.changeEmailSend')}</button>
      </div>
    </form>
  )
}

const ChangeSentCard = ({ email, onBack }) => {
  const { t } = useTranslation()
  return (
    <VerifyCard
      title={t('profile.changeEmailSentTitle')}
      intro={t('profile.changeEmailSent')}
      email={email}
      tag={<span className="status-badge pending">{t('profile.verifyEmailLinkSentTag')}</span>}
    >
      <button type="button" className="btn btn-secondary verify-email-btn" onClick={onBack}>{t('profile.changeEmailBack')}</button>
    </VerifyCard>
  )
}

const UnverifiedView = ({ currentUser, onAlreadyVerified, introKey }) => {
  const [changeSentTo, setChangeSentTo] = useState(null)
  if (changeSentTo) return <ChangeSentCard email={changeSentTo} onBack={() => setChangeSentTo(null)} />
  return (
    <SendLinkCard
      uid={currentUser.uid}
      email={currentUser.email}
      onAlreadyVerified={onAlreadyVerified}
      introKey={introKey}
      footer={<ChangeEmailForm currentEmail={currentUser.email} onSent={setChangeSentTo} />}
    />
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

const verifyIntroKey = (required, forNotifications) => {
  if (required) return 'profile.verifyEmailRequired'
  return forNotifications ? 'profile.verifyEmailForNotifications' : 'profile.verifyEmailHelp'
}

// Required for a new email sign-up (ProtectedRoute keeps it here until it
// verifies); optional for older accounts, where it only unlocks event emails.
// Reached from the email notifications value on Profile, after a save with
// them on (which passes forNotifications), and from the Continue button in
// the email.
const VerifyEmail = () => {
  const { currentUser, userProfile, isEmailVerificationPending } = useAuth()
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
            <UnverifiedView
              currentUser={currentUser}
              onAlreadyVerified={markVerified}
              introKey={verifyIntroKey(isEmailVerificationPending(), state?.forNotifications)}
            />
          )}
      </div>
    </Layout>
  )
}

export default VerifyEmail
