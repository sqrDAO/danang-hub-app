import { useTranslation } from 'react-i18next'
import { useAuth } from '../hooks/useAuth'
import Modal from './Modal'
import Avatar from './Avatar'
import { formatDateDDMMYYYY } from '../utils/timezone'
import { formatHubTimeRange } from '../utils/bookingPass'
import './BookingPass.css'

// The card is read by a Vietnamese guard, so its text is always Vietnamese;
// with the app in English each label gets a small English gloss.
const Label = ({ k, vi, t, gloss }) => (
  <span className="booking-pass-label">
    {vi(k)}
    {gloss && <span className="booking-pass-gloss" lang="en">{t(k)}</span>}
  </span>
)


const PassCard = ({ booking, profile, t, vi, gloss }) => (
  <section className="booking-pass" lang="vi" aria-label={vi('bookingPass.title')}>
    <div className="booking-pass-head">
      <div className="booking-pass-head-text">
        <p className="booking-pass-kicker">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d="M8.5 12.5l2.5 2.5 4.5-5" />
          </svg>
          {vi('bookingPass.confirmed')}
        </p>
        {gloss && <p className="booking-pass-gloss" lang="en">{t('bookingPass.confirmed')}</p>}
        <p className="booking-pass-date">{formatDateDDMMYYYY(booking.startTime)}</p>
      </div>
    </div>

    <div className="booking-pass-details">
      <div className="booking-pass-guest">
        <Avatar src={profile?.photoURL} name={profile?.displayName} size="lg" />
        <div>
          <Label k="bookingPass.guest" vi={vi} t={t} gloss={gloss} />
          <span className="booking-pass-value">{profile?.displayName}</span>
        </div>
      </div>
      <div className="booking-pass-row">
        <Label k="bookingPass.company" vi={vi} t={t} gloss={gloss} />
        <span className="booking-pass-value is-clamped">{profile?.company}</span>
        <span className="booking-pass-sub">{profile?.jobTitle}</span>
      </div>
      <div className="booking-pass-row">
        <Label k="bookingPass.time" vi={vi} t={t} gloss={gloss} />
        <span className="booking-pass-value is-time">{formatHubTimeRange(booking)}</span>
      </div>
    </div>

    <div className="booking-pass-brand">
      <img src="/assets/logo.svg" alt="Da Nang Blockchain Hub" />
    </div>
  </section>
)

const BookingPass = ({ booking, onClose }) => {
  const { t, i18n } = useTranslation()
  const { userProfile } = useAuth()

  return (
    <Modal isOpen={!!booking} onClose={onClose} title={t('bookingPass.title')} className="pass-modal">
      {booking && (
        <>
          <PassCard
            booking={booking}
            profile={userProfile}
            t={t}
            vi={i18n.getFixedT('vi')}
            gloss={!i18n.language?.startsWith('vi')}
          />
          <p className="booking-pass-hint">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            <span>{t('bookingPass.hint')}</span>
          </p>
        </>
      )}
    </Modal>
  )
}

export default BookingPass
