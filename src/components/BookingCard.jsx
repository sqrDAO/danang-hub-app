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

// On a pass-eligible card the pill itself opens the pass: the pass only exists
// for a confirmed booking, so "Entry pass" stands in for the status. Always the
// green approved look, checked-in too, so the pass pill reads the same.
const StatusPill = ({ booking, status, t, onShowPass }) => {
  if (onShowPass && canShowPass(booking)) {
    return (
      <button type="button" className="status-badge approved btn-pass" onClick={() => onShowPass(booking)}>
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

const timeRange = (booking, locale) => {
  // 24h HH:mm in both languages, matching the pass (h23: never "24:00").
  const time = (d) => formatHubDate(d, locale, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
  return `${time(booking.startTime)} – ${time(booking.endTime)}`
}

const BookingCard = ({ booking, amenity, onShowPass, children }) => {
  const { t, i18n } = useTranslation()
  const locale = appLocale(i18n)
  const isToday = isSameHubDay(booking.startTime, new Date())
  const status = booking.status || 'pending'

  return (
    <article className="booking-tile">
      <DateTile
        date={booking.startTime}
        locale={locale}
        label={isToday ? t('memberBookings.today') : undefined}
        highlight={isToday}
      />
      <div className="booking-tile-body">
        <div className="booking-tile-info">
          <h3 className="booking-tile-title">{amenity?.name || booking.amenityId}</h3>
          <p className="booking-tile-time">
            <Icon d="M12 7v5l3 2" />
            <span>{timeRange(booking, locale)}</span>
            <span className="booking-tile-duration">({formatDurationShort(booking.startTime, booking.endTime)})</span>
          </p>
          <StatusPill booking={booking} status={status} t={t} onShowPass={onShowPass} />
        </div>
        {children}
      </div>
    </article>
  )
}

export default BookingCard
