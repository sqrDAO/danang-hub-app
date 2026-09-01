import { useState, useMemo, memo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../hooks/useAuth'
import { getBookings } from '../services/bookings'
import { getApprovedEvents } from '../services/events'
import { getAmenities } from '../services/amenities'
import { addHubDays, formatHubDate, parseHubDateTime } from '../utils/timezone'
import './UnifiedCalendar.css'

const EMPTY_ITEMS = []
const WEEKDAY_SUNDAY = parseHubDateTime('2026-08-02')
const HUB_WEEKDAYS = [0, 1, 2, 3, 4, 5, 6].map((i) => addHubDays(WEEKDAY_SUNDAY, i))
const LEGEND_ITEMS = [
  { swatch: 'legend-color day-item-booking', key: 'unifiedCalendar.legendBooking' },
  { swatch: 'legend-color day-item-event', key: 'unifiedCalendar.legendEvent' },
  { swatch: 'legend-color pending', key: 'unifiedCalendar.legendPending' },
  { swatch: 'legend-color mine', key: 'unifiedCalendar.legendYours' }
]

// Inline so a failed fetch is visible in place of a silently empty calendar.
const CalendarErrorBanner = ({ message }) => (
  <div className="error-message" style={{
    padding: '1rem',
    marginBottom: '1rem',
    backgroundColor: '#fee',
    color: '#c33',
    borderRadius: '4px'
  }}>
    {message}
  </div>
)

const chipClassName = (item, extraClass = '') => [
  'day-item',
  `day-item-${item.type}`,
  item.isMine ? 'mine' : '',
  item.status === 'pending' ? 'pending' : '',
  extraClass
].filter(Boolean).join(' ')

const chipTitle = (item, t) => {
  const kind = t(item.type === 'event'
    ? 'unifiedCalendar.legendEvent'
    : 'unifiedCalendar.legendBooking')
  if (item.status === 'pending') {
    return t('unifiedCalendar.chipPending', {
      kind,
      title: item.title,
      status: t('unifiedCalendar.legendPending')
    })
  }
  return t('unifiedCalendar.chip', { kind, title: item.title })
}

const DayItemChip = ({ item, t, className = '' }) => (
  <div className={chipClassName(item, className)} title={chipTitle(item, t)}>
    {item.title}
  </div>
)

const DayCell = memo(function DayCell({ date, isToday, items, t }) {
  if (!date) return <div className="calendar-day empty" />
  const first = items[0]
  const second = items[1]
  const desktopExtra = items.length - 2
  const mobileExtra = items.length - 1
  return (
    <div className={`calendar-day ${isToday ? 'today' : ''}`}>
      <div className="day-number">{date.getDate()}</div>
      <div className="day-items">
        {first && <DayItemChip item={first} t={t} />}
        {second && (
          <DayItemChip item={second} t={t} className="day-item-secondary" />
        )}
        {desktopExtra > 0 && (
          <div className="day-item-more day-item-more-desktop">
            {t('unifiedCalendar.more', { count: desktopExtra })}
          </div>
        )}
        {mobileExtra > 0 && (
          <div className="day-item-more day-item-more-mobile">
            {t('unifiedCalendar.more', { count: mobileExtra })}
          </div>
        )}
      </div>
    </div>
  )
})

// Determine ownership:
// - For members: All bookings in the query result are theirs (query filters by memberId)
//   But we still verify to catch any data issues
// - For admins: Check if booking.memberId matches currentUser.uid
const bookingBelongsToUser = (booking, currentUserId, userIsAdmin) => {
  const bookingMemberId = booking.memberId

  if (!currentUserId) {
    return false
  }
  if (userIsAdmin) {
    return String(bookingMemberId || '') === String(currentUserId)
  }

  const bookingIdStr = String(bookingMemberId || '').trim()
  const userIdStr = String(currentUserId).trim()
  const belongsToUser = bookingIdStr === userIdStr && bookingIdStr !== ''

  if (!belongsToUser && bookingIdStr !== '') {
    console.warn('UnifiedCalendar: Booking memberId mismatch (but query filtered by memberId)', {
      bookingId: booking.id,
      bookingMemberId: bookingIdStr,
      currentUserId: userIdStr,
      booking
    })
    return true
  }
  if (bookingIdStr === '') {
    console.warn('UnifiedCalendar: Booking missing memberId', {
      bookingId: booking.id,
      booking
    })
    return false
  }
  return belongsToUser
}

const UnifiedCalendar = () => {
  const { t, i18n } = useTranslation()
  const locale = i18n.language?.startsWith('vi') ? 'vi-VN' : 'en-US'
  const { currentUser, isAdmin } = useAuth()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedAmenityType, setSelectedAmenityType] = useState('')

  // Calendar shows one month at a time; fetch a buffered window around the
  // currently viewed month so prev/next navigation doesn't refetch the world.
  const calendarYear = currentDate.getFullYear()
  const calendarMonth = currentDate.getMonth()
  const calendarWindowStart = new Date(calendarYear, calendarMonth - 1, 1)
  const calendarWindowEnd = new Date(calendarYear, calendarMonth + 2, 0, 23, 59, 59, 999)

  const { data: bookings = [], error: bookingsError } = useQuery({
    queryKey: ['bookings', 'calendar', isAdmin() ? 'admin' : currentUser?.uid, calendarYear, calendarMonth],
    queryFn: () => getBookings({
      startDate: calendarWindowStart,
      endDate: calendarWindowEnd,
      ...(isAdmin() ? {} : { memberId: currentUser?.uid })
    }),
    enabled: !!currentUser?.uid
  })

  const { data: events = [], error: eventsError } = useQuery({
    queryKey: ['approvedEvents'],
    queryFn: getApprovedEvents
  })

  const { data: amenities = [] } = useQuery({
    queryKey: ['amenities'],
    queryFn: getAmenities
  })

  const amenitiesById = useMemo(() => {
    const map = new Map()
    amenities.forEach(a => map.set(a.id, a))
    return map
  }, [amenities])

  // Filter bookings
  const filteredBookings = useMemo(() => {
    if (!bookings || bookings.length === 0) {
      if (bookingsError) {
        console.error('UnifiedCalendar: Error loading bookings', bookingsError)
      }
      return []
    }

    let filtered = bookings.filter(b => {
      if (!b || !b.status || !b.startTime) {
        return false
      }
      return ['pending', 'approved', 'checked-in'].includes(b.status)
    })

    if (selectedAmenityType) {
      filtered = filtered.filter(b => amenitiesById.get(b.amenityId)?.type === selectedAmenityType)
    }

    return filtered
  }, [bookings, selectedAmenityType, amenitiesById, bookingsError])

  // Filter events - only show approved events that are today or in the future
  const filteredEvents = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0) // Normalize to start of day
    
    return events.filter(e => {
      if (!e.date) return false
      const eventDate = new Date(e.date)
      eventDate.setHours(0, 0, 0, 0) // Normalize to start of day
      return eventDate >= today
    })
  }, [events])

  // Get items for current month
  const calendarItems = useMemo(() => {
    const items = []
    // Hoist user state out of the per-booking loop — invariant across this memo run
    const userIsAdmin = isAdmin()
    const currentUserId = currentUser?.uid

    filteredBookings.forEach(booking => {
      if (!booking.startTime) return

      const startDate = new Date(booking.startTime)
      const endDate = booking.endTime ? new Date(booking.endTime) : startDate

      if (isNaN(startDate.getTime())) return

      const belongsToUser = bookingBelongsToUser(booking, currentUserId, userIsAdmin)

      items.push({
        type: 'booking',
        id: booking.id,
        title: amenitiesById.get(booking.amenityId)?.name || t('unifiedCalendar.unknownAmenity'),
        start: startDate,
        end: endDate,
        isMine: belongsToUser,
        status: booking.status,
        data: booking
      })
    })

    filteredEvents.forEach(event => {
      if (!event.date) return

      const eventDate = new Date(event.date)
      if (isNaN(eventDate.getTime())) return

      items.push({
        type: 'event',
        id: event.id,
        title: event.title || t('memberDashboard.untitledEvent'),
        start: eventDate,
        end: eventDate,
        isMine: event.attendees?.includes(currentUserId) || false,
        data: event
      })
    })

    return items
  }, [filteredBookings, filteredEvents, amenitiesById, currentUser, isAdmin, t])

  // Group items by date
  const itemsByDate = useMemo(() => {
    const grouped = {}
    calendarItems.forEach(item => {
      const dateKey = item.start.toDateString()
      if (!grouped[dateKey]) {
        grouped[dateKey] = []
      }
      grouped[dateKey].push(item)
    })
    return grouped
  }, [calendarItems])

  // Generate calendar days
  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startingDayOfWeek = firstDay.getDay()

    const days = []
    
    // Add empty cells for days before month starts
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null)
    }

    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day)
      days.push(date)
    }

    return days
  }, [currentDate])

  const handlePrevMonth = () => {
    const newDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1)
    setCurrentDate(newDate)
  }

  const handleNextMonth = () => {
    const newDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1)
    setCurrentDate(newDate)
  }

  const handleToday = () => {
    setCurrentDate(new Date())
  }

  const todayKey = new Date().toDateString()

  const uniqueAmenityTypes = useMemo(() => {
    const types = new Set()
    amenities.forEach(a => {
      if (a.type) types.add(a.type)
    })
    return Array.from(types)
  }, [amenities])

  // Log both query failures; each renders its own banner below.
  if (bookingsError) {
    console.error('UnifiedCalendar: Bookings query error', bookingsError)
  }
  if (eventsError) {
    console.error('UnifiedCalendar: Events query error', eventsError)
  }

  return (
    <div className="unified-calendar">
      <div className="unified-calendar-header">
        <h2 className="section-title">{t('memberDashboard.unifiedCalendar')}</h2>
      </div>

      {bookingsError && (
        <CalendarErrorBanner
          message={t('calendar.errorLoadingBookings', { message: bookingsError.message })}
        />
      )}
      {eventsError && (
        <CalendarErrorBanner
          message={t('calendar.errorLoadingEvents', { message: eventsError.message })}
        />
      )}

      <div className="calendar-controls">
        <div className="calendar-nav">
          <button
            type="button"
            className="btn btn-secondary btn-sm calendar-nav-arrow"
            onClick={handlePrevMonth}
            aria-label={t('calendar.prevMonth')}
          >
            ←
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={handleToday}>
            {t('calendar.today')}
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm calendar-nav-arrow"
            onClick={handleNextMonth}
            aria-label={t('calendar.nextMonth')}
          >
            →
          </button>
        </div>
        <h3 className="calendar-title">
          {currentDate.toLocaleDateString(locale, { month: 'long', year: 'numeric' })}
        </h3>
        <div className="calendar-filters">
          <select
            className="form-field filter-select"
            value={selectedAmenityType}
            onChange={(e) => setSelectedAmenityType(e.target.value)}
            aria-label={t('unifiedCalendar.filterBookingsByType')}
          >
            <option value="">{t('unifiedCalendar.allAmenityTypes')}</option>
            {uniqueAmenityTypes.map(type => (
              <option key={type} value={type}>
                {t(`amenityTypes.${type}`, { defaultValue: type })}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="calendar-grid-month">
        <div className="calendar-weekdays">
          {HUB_WEEKDAYS.map((day) => (
            <div key={day.getTime()} className="weekday-header">
              {formatHubDate(day, locale, { weekday: 'short' })}
            </div>
          ))}
        </div>
        <div className="calendar-days">
          {calendarDays.map((date, index) => (
            <DayCell
              key={index}
              date={date}
              isToday={date ? date.toDateString() === todayKey : false}
              items={date ? (itemsByDate[date.toDateString()] || EMPTY_ITEMS) : EMPTY_ITEMS}
              t={t}
            />
          ))}
        </div>
      </div>

      <div className="calendar-legend">
        {LEGEND_ITEMS.map((item) => (
          <div key={item.key} className="legend-item">
            <div className={item.swatch} />
            <span>{t(item.key)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default UnifiedCalendar
