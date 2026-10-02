import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../hooks/useAuth'
import Layout from '../../components/Layout'
import UnifiedCalendar from '../../components/UnifiedCalendar'
import { getBookings } from '../../services/bookings'
import { getUpcomingEvents } from '../../services/events'
import { getAmenities } from '../../services/amenities'
import { formatDateDDMMYYYY } from '../../utils/timezone'
import EventCard from '../../components/event/EventCard'
import './Dashboard.css'
import './Profile.css'

// Member dashboard surfaces upcoming activity; 30 back, 90 forward.
const getMemberDashboardWindow = () => {
  const start = new Date()
  start.setDate(start.getDate() - 30)
  start.setHours(0, 0, 0, 0)
  const end = new Date()
  end.setDate(end.getDate() + 90)
  end.setHours(23, 59, 59, 999)
  return { startDate: start, endDate: end }
}

const getTodayStart = () => {
  const now = new Date()
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  return start
}

const isRegistered = (event, uid) =>
  event.attendees?.includes(uid) ?? false

const isOnWaitlist = (event, uid) =>
  event.waitlist?.includes(uid) ?? false

const getWaitlistPosition = (event, uid) => {
  if (!event.waitlist?.length || !isOnWaitlist(event, uid)) return null
  return event.waitlist.indexOf(uid) + 1
}

const getMyEventStatus = (event, uid, t) => {
  if (isRegistered(event, uid)) return t('memberDashboard.attending')
  if (!isOnWaitlist(event, uid)) return null
  const position = getWaitlistPosition(event, uid)
  return position
    ? t('memberDashboard.onWaitlistPosition', { position })
    : t('memberDashboard.onWaitlist')
}

const UpcomingEventItem = ({ event, currentUid }) => {
  const { t } = useTranslation()
  const myStatus = getMyEventStatus(event, currentUid, t)
  return (
    <li>
      <EventCard
        event={event}
        view="member"
        compact
        to="/member/events"
        context={myStatus && <p className="ecard-note ecard-note-accent">{myStatus}</p>}
      />
    </li>
  )
}

const BookingsPagination = ({ page, totalPages, startIndex, endIndex, total, setPage }) => {
  const { t } = useTranslation()
  return (
    <div className="dashboard-bookings-pagination">
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        onClick={() => setPage(prev => Math.max(1, prev - 1))}
        disabled={page === 1}
      >
        {t('memberDashboard.prevPage')}
      </button>
      <div className="dashboard-bookings-pagination-info">
        <span className="dashboard-bookings-page">
          {t('memberDashboard.pageOf', { current: page, total: totalPages })}
        </span>
        <span className="dashboard-bookings-range">
          {t('memberDashboard.showingRange', {
            from: total === 0 ? 0 : startIndex + 1,
            to: Math.min(endIndex, total),
            total
          })}
        </span>
      </div>
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
        disabled={page === totalPages}
      >
        {t('memberDashboard.nextPage')}
      </button>
    </div>
  )
}

const MemberDashboard = () => {
  const { t, i18n } = useTranslation()
  const { currentUser } = useAuth()
  const locale = i18n.language?.startsWith('vi') ? 'vi-VN' : 'en-US'
  const [bookingsPage, setBookingsPage] = useState(1)
  const BOOKINGS_PAGE_SIZE = 10

  const memberDashboardWindow = getMemberDashboardWindow()

  const { data: myBookings = [] } = useQuery({
    // Scoped key: /member/bookings reads a wider window for the same uid.
    queryKey: ['bookings', currentUser?.uid, 'dashboard'],
    queryFn: () => getBookings({ memberId: currentUser?.uid, ...memberDashboardWindow }),
    enabled: !!currentUser?.uid
  })

  // Member surface: shares the approved-events cache with /member/events.
  const { data: events = [] } = useQuery({
    queryKey: ['upcomingEvents'],
    queryFn: () => getUpcomingEvents()
  })

  const { data: amenities = [] } = useQuery({
    queryKey: ['amenities'],
    queryFn: getAmenities
  })

  const todayStart = getTodayStart()

  const upcomingBookingsAll = myBookings
    .filter(b => ['pending', 'approved', 'checked-in'].includes(b.status))
    .filter(b => {
      if (!b.startTime) return false
      const start = b.startTime instanceof Date ? b.startTime : new Date(b.startTime)
      const dayStart = new Date(start)
      dayStart.setHours(0, 0, 0, 0)
      return dayStart >= todayStart
    })

  const sortedUpcomingBookings = [...upcomingBookingsAll].sort((a, b) => {
    const aStart = a.startTime ? (a.startTime instanceof Date ? a.startTime : new Date(a.startTime)) : null
    const bStart = b.startTime ? (b.startTime instanceof Date ? b.startTime : new Date(b.startTime)) : null

    if (!aStart && !bStart) return 0
    if (!aStart) return 1
    if (!bStart) return -1
    return aStart - bStart
  })

  const totalUpcomingBookings = sortedUpcomingBookings.length
  const totalBookingsPages = Math.max(1, Math.ceil(totalUpcomingBookings / BOOKINGS_PAGE_SIZE))
  const safeBookingsPage = Math.min(bookingsPage, totalBookingsPages)
  const bookingsStartIndex = (safeBookingsPage - 1) * BOOKINGS_PAGE_SIZE
  const bookingsEndIndex = bookingsStartIndex + BOOKINGS_PAGE_SIZE
  const paginatedUpcomingBookings = sortedUpcomingBookings.slice(bookingsStartIndex, bookingsEndIndex)

  const upcomingEvents = events
    .filter(e => {
      if (!e.date) return false
      const eventDate = e.date instanceof Date ? e.date : new Date(e.date)
      const now = new Date()
      return eventDate > now
    })
    .slice(0, 5)

  return (
    <Layout>
      <div className="container member-dashboard">
        <h1 className="page-title">{t('memberDashboard.title')}</h1>

        <div className="dashboard-grid">
          <div className="dashboard-section glass">
            <div className="section-title-row">
              <h2 className="section-title">{t('memberDashboard.myUpcomingBookings')}</h2>
              <Link to="/member/bookings" className="btn btn-primary btn-sm">
                {t('common.bookNow')}
              </Link>
            </div>
            {paginatedUpcomingBookings.length > 0 ? (
              <ul className="booking-list">
                {paginatedUpcomingBookings.map(booking => {
                  const amenity = amenities.find(a => a.id === booking.amenityId)
                  return (
                    <li key={booking.id} className="booking-item">
                      <div className="booking-info">
                        <span className="booking-amenity">{amenity?.name || booking.amenityId}</span>
                        <span className="booking-duration">
                          {booking.endTime && booking.startTime
                            ? (() => {
                                const hours = (new Date(booking.endTime) - new Date(booking.startTime)) / (1000 * 60 * 60)
                                // Show fractional hours (e.g., 1.5h) if not a whole number
                                return hours % 1 === 0 ? `${hours}h` : `${hours.toFixed(1)}h`
                              })()
                            : ''}
                        </span>
                      </div>
                      <div className="booking-right">
                        <span className={`status-badge ${booking.status}`}>
                          {t(`status.${booking.status || 'pending'}`)}
                        </span>
                        <div className="booking-time-info">
                          <span className="booking-time">
                            {booking.startTime ? formatDateDDMMYYYY(booking.startTime) : 'N/A'}
                          </span>
                          <span className="booking-time-small">
                            {booking.startTime ? new Date(booking.startTime).toLocaleTimeString(locale, {
                              hour: 'numeric',
                              minute: '2-digit'
                            }) : ''}
                          </span>
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="empty-state">{t('memberDashboard.noUpcomingBookings')}</p>
            )}

            {totalUpcomingBookings > BOOKINGS_PAGE_SIZE && (
              <BookingsPagination
                page={safeBookingsPage}
                totalPages={totalBookingsPages}
                startIndex={bookingsStartIndex}
                endIndex={bookingsEndIndex}
                total={totalUpcomingBookings}
                setPage={setBookingsPage}
              />
            )}
          </div>

          <div className="dashboard-section glass">
            <div className="section-title-row">
              <h2 className="section-title">{t('memberDashboard.upcomingEvents')}</h2>
              <div className="section-title-actions">
                <Link to="/member/events?action=create" className="btn btn-primary btn-sm">
                  {t('memberDashboard.createEvent')}
                </Link>
                <Link to="/member/events" className="btn btn-secondary btn-sm">{t('common.viewAll')}</Link>
              </div>
            </div>
            {upcomingEvents.length > 0 ? (
              <ul className="event-list event-list-detailed">
                {upcomingEvents.map(event => (
                  <UpcomingEventItem
                    key={event.id}
                    event={event}
                    currentUid={currentUser?.uid}
                  />
                ))}
              </ul>
            ) : (
              <p className="empty-state">{t('memberDashboard.noUpcomingEvents')}</p>
            )}
          </div>
        </div>

        <UnifiedCalendar />
      </div>

    </Layout>
  )
}

export default MemberDashboard
