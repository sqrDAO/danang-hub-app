import { useTranslation } from 'react-i18next'
import { formatHubDate, isSameHubDay } from '../utils/timezone'
import { canShowPass, formatDurationShort, formatHubTimeRange, hasBookingTimes } from '../utils/bookingPass'
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

// On a pass-eligible card the pill itself opens the pass: the pass only exists
// for a confirmed booking, so "Entry pass" stands in for the status. Green for
// approved and checked-in alike, so the pass pill always reads the same.
const StatusPill = ({ booking, status, t, onShowPass, now }) => {
  if (onShowPass && canShowPass(booking, now)) {
    return (
      <button type="button" className="status-badge btn-pass" onClick={() => onShowPass(booking)}>
        <Icon d={STATUS_ICON.approved} />
        {t('bookingPass.show')}
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M9 6l6 6-6 6" />
        </svg>
      </button>
    )
  }
  return (
    <span className={`status-badge ${status}`}>
      {STATUS_ICON[status] && <Icon d={STATUS_ICON[status]} />}
      {t(`status.${status}`)}
    </span>
  )
}

const appLocale = (i18n) => (i18n.language?.startsWith('vi') ? 'vi-VN' : 'en-US')

// Label defaults to the short weekday; callers pass "Today" when it is true.
const DateTile = ({ date, locale, label, highlight = false }) => (
  <div className={`date-tile${highlight ? ' is-today' : ''}`}>
    <span className="date-tile-label">{label ?? formatHubDate(date, locale, { weekday: 'short' })}</span>
    <span className="date-tile-day">{formatHubDate(date, locale, { day: '2-digit' })}</span>
    <span className="date-tile-month">{formatHubDate(date, locale, { month: 'short' })}</span>
  </div>
)

// `now` comes from the page (useHubNow) so the card, the sections and the
// action buttons all read the same instant.
const BookingCard = ({ booking, amenity, onShowPass, now = new Date(), children }) => {
  const { t, i18n } = useTranslation()
  const locale = appLocale(i18n)
  // Without valid times the hub-day and format calls would throw: keep the
  // date column (it holds the tear line) but leave it and the time line empty.
  const timed = hasBookingTimes(booking)
  const isToday = timed && isSameHubDay(booking.startTime, now)
  const status = booking.status || 'pending'

  return (
    <article className="booking-tile">
      {timed ? (
        <DateTile
          date={booking.startTime}
          locale={locale}
          label={isToday ? t('calendar.today') : undefined}
          highlight={isToday}
        />
      ) : <div className="date-tile" aria-hidden="true" />}
      <div className="booking-tile-body">
        <div className="booking-tile-info">
          <h3 className="booking-tile-title">{amenity?.name || booking.amenityId}</h3>
          {timed && (
            <p className="booking-tile-time">
              <Icon d="M12 7v5l3 2" />
              <span>{formatHubTimeRange(booking)}</span>
              <span className="booking-tile-duration">({formatDurationShort(booking.startTime, booking.endTime)})</span>
            </p>
          )}
          <StatusPill booking={booking} status={status} t={t} onShowPass={onShowPass} now={now} />
        </div>
        {children}
      </div>
    </article>
  )
}

export default BookingCard
