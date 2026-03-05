import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../contexts/AuthContext'
import Layout from '../../components/Layout'
import UnifiedCalendar from '../../components/UnifiedCalendar'
import { getBookings } from '../../services/bookings'
import { getUpcomingEvents } from '../../services/events'
import { getAmenities } from '../../services/amenities'
import { getMembers } from '../../services/members'
import { formatEventDate, formatEventTime } from '../../utils/timezone'
import './Dashboard.css'

const DESCRIPTION_MAX_LENGTH = 120

const MemberDashboard = () => {
  const { t, i18n } = useTranslation()
  const { currentUser } = useAuth()
  const locale = i18n.language?.startsWith('vi') ? 'vi-VN' : 'en-US'
  const [showCalendar, setShowCalendar] = useState(false)
  const [bookingsPage, setBookingsPage] = useState(1)
  const BOOKINGS_PAGE_SIZE = 10
  
  const { data: myBookings = [] } = useQuery({
    queryKey: ['bookings', currentUser?.uid],
    queryFn: () => getBookings({ memberId: currentUser?.uid }),
    enabled: !!currentUser?.uid
  })
  
  const { data: events = [] } = useQuery({
    queryKey: ['upcomingEvents'],
    queryFn: getUpcomingEvents
  })
  
  const { data: amenities = [] } = useQuery({
    queryKey: ['amenities'],
    queryFn: getAmenities
  })

  const { data: members = [] } = useQuery({
    queryKey: ['members'],
    queryFn: getMembers
  })

  const todayStart = (() => {
    const now = new Date()
    const start = new Date(now)
    start.setHours(0, 0, 0, 0)
    return start
  })()

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

  const availableAmenities = amenities.filter(a => a.isAvailable !== false).length

  const getOrganizerName = (organizerId) => {
    const organizer = members.find(m => m.id === organizerId)
    return organizer?.displayName || '—'
  }

  const isRegistered = (event) =>
    event.attendees?.includes(currentUser?.uid) ?? false

  const isFull = (event) =>
    event.capacity != null && (event.attendees?.length ?? 0) >= event.capacity

  const isOnWaitlist = (event) =>
    event.waitlist?.includes(currentUser?.uid) ?? false

  const getWaitlistPosition = (event) => {
    if (!event.waitlist?.length || !isOnWaitlist(event)) return null
    return event.waitlist.indexOf(currentUser?.uid) + 1
  }

  const truncateDescription = (text) => {
    if (!text || typeof text !== 'string') return ''
    return text.length <= DESCRIPTION_MAX_LENGTH
      ? text
      : `${text.slice(0, DESCRIPTION_MAX_LENGTH).trim()}…`
  }

  return (
    <Layout>
      <div className="container">
        <h1 className="page-title">{t('memberDashboard.title')}</h1>
        
        <div className="stats-grid">
          <div className="stat-card glass">
            <h3 className="stat-value">{totalUpcomingBookings}</h3>
            <p className="stat-label">{t('memberDashboard.upcomingBookings')}</p>
          </div>
          <div className="stat-card glass">
            <h3 className="stat-value">{upcomingEvents.length}</h3>
            <p className="stat-label">{t('memberDashboard.upcomingEvents')}</p>
          </div>
          <div className="stat-card glass">
            <h3 className="stat-value">{availableAmenities}</h3>
            <p className="stat-label">{t('memberDashboard.availableAmenities')}</p>
          </div>
        </div>

        <div className="dashboard-section glass" style={{ marginBottom: 'var(--spacing-xl)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-md)' }}>
            <h2 className="section-title">{t('memberDashboard.unifiedCalendar')}</h2>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowCalendar(!showCalendar)}>
              {showCalendar ? t('memberDashboard.hideCalendar') : t('memberDashboard.showCalendar')}
            </button>
          </div>
          {showCalendar && <UnifiedCalendar />}
        </div>

        <div className="dashboard-grid">
          <div className="dashboard-section glass">
            <h2 className="section-title">{t('memberDashboard.myUpcomingBookings')}</h2>
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
                            {booking.startTime ? new Date(booking.startTime).toLocaleDateString(locale, {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric'
                            }) : 'N/A'}
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
              <div className="dashboard-bookings-pagination">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setBookingsPage(prev => Math.max(1, prev - 1))}
                  disabled={safeBookingsPage === 1}
                >
                  {t('memberDashboard.prevPage')}
                </button>
                <div className="dashboard-bookings-pagination-info">
                  <span className="dashboard-bookings-page">
                    {t('memberDashboard.pageOf', { current: safeBookingsPage, total: totalBookingsPages })}
                  </span>
                  <span className="dashboard-bookings-range">
                    {t('memberDashboard.showingRange', {
                      from: totalUpcomingBookings === 0 ? 0 : bookingsStartIndex + 1,
                      to: Math.min(bookingsEndIndex, totalUpcomingBookings),
                      total: totalUpcomingBookings
                    })}
                  </span>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setBookingsPage(prev => Math.min(totalBookingsPages, prev + 1))}
                  disabled={safeBookingsPage === totalBookingsPages}
                >
                  {t('memberDashboard.nextPage')}
                </button>
              </div>
            )}
          </div>

          <div className="dashboard-section glass">
            <div className="section-title-row">
              <h2 className="section-title">{t('memberDashboard.upcomingEvents')}</h2>
              <Link to="/member/events" className="btn btn-secondary btn-sm">{t('common.viewAll')}</Link>
            </div>
            {upcomingEvents.length > 0 ? (
              <ul className="event-list event-list-detailed">
                {upcomingEvents.map(event => {
                  const registered = isRegistered(event)
                  const full = isFull(event)
                  const onWaitlist = isOnWaitlist(event)
                  const waitlistPosition = getWaitlistPosition(event)
                  const attendeeCount = event.attendees?.length ?? 0
                  const capacity = event.capacity ?? 0
                  const spotsLeft = capacity > 0 ? Math.max(0, capacity - attendeeCount) : null
                  const title = event.title || event.name || t('memberDashboard.untitledEvent')
                  const isExternal = Boolean(event.eventLink)
                  return (
                    <li key={event.id} className="event-item event-item-detailed">
                      {event.bannerUrl && (
                        <div className="event-item-banner">
                          <img src={event.bannerUrl} alt="" />
                        </div>
                      )}
                      <div className="event-item-main">
                        <div className="event-item-header">
                          <h4 className="event-title">{title}</h4>
                        </div>
                        <div className="event-meta">
                          <span className="event-datetime">
                            {event.date ? formatEventDate(event.date) : 'N/A'}
                            {event.date && (
                              <span className="event-time"> {t('memberDashboard.at')} {formatEventTime(event.date)}</span>
                            )}
                          </span>
                          <span className="event-organizer">
                            {t('memberDashboard.organizer', { name: getOrganizerName(event.organizerId) })}
                          </span>
                        </div>
                        {event.description && (
                          <p className="event-description-truncated">
                            {truncateDescription(event.description)}
                          </p>
                        )}
                        <div className="event-capacity-row">
                          <span className="event-capacity">
                            {t('memberDashboard.attendees', { current: attendeeCount, total: capacity || '∞' })}
                          </span>
                          {capacity > 0 && (
                            <span className="event-spots">
                              {full ? t('memberDashboard.full') : t('memberDashboard.spotsLeft', { count: spotsLeft })}
                            </span>
                          )}
                        </div>
                        {(registered || onWaitlist) && (
                          <span className="event-my-status">
                            {registered ? t('memberDashboard.attending') : onWaitlist ? (waitlistPosition ? t('memberDashboard.onWaitlistPosition', { position: waitlistPosition }) : t('memberDashboard.onWaitlist')) : ''}
                          </span>
                        )}
                      </div>
                      <div className="event-item-actions">
                        <Link
                          to="/member/events"
                          className="event-view-details"
                          aria-label={`View details for ${title}`}
                        >
                          {t('common.viewDetails')}
                        </Link>
                        {isExternal && (
                          <a
                            href={event.eventLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="event-signup-link"
                            aria-label={`Sign up for ${title}`}
                          >
                            {t('common.signup')}
                          </a>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="empty-state">{t('memberDashboard.noUpcomingEvents')}</p>
            )}
          </div>
        </div>
      </div>
    </Layout>
  )
}

export default MemberDashboard
