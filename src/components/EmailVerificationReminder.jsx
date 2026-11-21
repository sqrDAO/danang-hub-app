import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../hooks/useAuth'
import useEmailStatus from '../hooks/useEmailStatus'

const Reminder = ({ user, isAdmin }) => {
  const { t } = useTranslation()
  const [status] = useEmailStatus(user)
  if (status !== 'unverified') return null
  return (
    <aside className="email-verification-reminder" aria-label={t('profile.verifyEmailTitle')}>
      <p>{t('profile.verifyEmailReminder')}</p>
      <Link to={`${isAdmin ? '/admin' : '/member'}/verify-email`}>
        {t('profile.verifyEmailTitle')}
      </Link>
    </aside>
  )
}

const EmailVerificationReminder = ({ isAdmin }) => {
  const { currentUser, loading } = useAuth()
  const { pathname } = useLocation()
  if (loading || !currentUser?.email || /\/verify-email\/?$/.test(pathname)) return null
  return <Reminder key={currentUser.uid} user={currentUser} isAdmin={isAdmin} />
}

export default EmailVerificationReminder
