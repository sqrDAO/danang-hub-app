import { useTranslation } from 'react-i18next'
import { formatHubDate, isSameHubDay } from '../utils/timezone'
import { canShowPass, formatDurationShort } from '../utils/bookingPass'
import './BookingCard.css'

const STATUS_ICON = {
  approved: 'M8.5 12.5l2.5 2.5 4.5-5',
  'checked-in': 'M8.5 12.5l2.5 2.5 4.5-5',
  completed: 'M8.5 12.5l2.5 2.5 4.5-5',
  pending: 'M12 7v5l3 2',
  cancelled: 'M9.5 9.5l5 5M14.5 9.5l-5 5',
  rejected: 'M9.5 9.5l5 5M14.5 9.5l-5 5',
}

const Icon = ({ d }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    <path d={d} />
  </svg>
)

// ID-card icon for the pass button
const PassIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <circle cx="9" cy="10" r="2" />
    <path d="M15 9h3M15 13h3M5.5 16.5c.6-1.6 1.9-2.3 3.5-2.3s2.9.7 3.5 2.3" />
  </svg>
)

const appLocale = (i18n) => (i18n.language?.startsWith('vi') ? 'vi-VN' : 'en-US')

// Label defaults to the short weekday; callers pass "Today" when it is true.
export const DateTile = ({ date, locale, label, highlight = false, large = false }) => (
  <div className={`date-tile${highlight ? ' is-today' : ''}${large ? ' is-lg' : ''}`}>
    <span className="date-tile-label">{label ?? formatHubDate(date, locale, { weekday: 'short' })}</span>
    <span className="date-tile-day">{formatHubDate(date, locale, { day: '2-digit' })}</span>
    <span className="date-tile-month">{formatHubDate(date, locale, { month: 'short' })}</span>
  </div>
)

const timeRange = (booking, locale) => {
  const time = (d) => formatHubDate(d, locale, { hour: 'numeric', minute: '2-digit' })
  return `${time(booking.startTime)} – ${time(booking.endTime)}`
}

const BookingCard = ({ booking, amenity, onShowPass, children }) => {
  const { t, i18n } = useTranslation()
  const locale = appLocale(i18n)
  const isToday = isSameHubDay(booking.startTime, new Date())
  const status = booking.status || 'pending'

  return (
    <article className="booking-tile">
      <div className="booking-tile-top">
        <DateTile
          date={booking.startTime}
          locale={locale}
          label={isToday ? t('memberBookings.today') : undefined}
          highlight={isToday}
        />
        <div className="booking-tile-info">
          <h3 className="booking-tile-title">{amenity?.name || booking.amenityId}</h3>
          <p className="booking-tile-time">
            <Icon d="M12 7v5l3 2" />
            <span>{timeRange(booking, locale)}</span>
            <span className="booking-tile-duration">({formatDurationShort(booking.startTime, booking.endTime)})</span>
          </p>
          <span className={`status-badge ${status}`}>
            {STATUS_ICON[status] && <Icon d={STATUS_ICON[status]} />}
            {t(`status.${status}`)}
          </span>
        </div>
      </div>
      {onShowPass && canShowPass(booking) && (
        <button type="button" className="btn-pass" onClick={() => onShowPass(booking)}>
          <PassIcon />
          {t('bookingPass.show')}
        </button>
      )}
      {children}
    </article>
  )
}

export default BookingCard
