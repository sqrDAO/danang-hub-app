import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import Layout from '../../components/Layout'
import { getMembers } from '../../services/members'
import { getBookings } from '../../services/bookings'
import { getEvents } from '../../services/events'
import { getAmenities } from '../../services/amenities'
import { formatEventDate, formatEventTime, formatDateDDMMYYYY } from '../../utils/timezone'
import './Dashboard.css'

const DESCRIPTION_MAX_LENGTH = 120

const AdminDashboard = () => {
  const { t, i18n } = useTranslation()
  const locale = i18n.language?.startsWith('vi') ? 'vi-VN' : 'en-US'
  const [recentBookingsPage, setRecentBookingsPage] = useState(1)
  const RECENT_BOOKINGS_PAGE_SIZE = 5

  const { data: members = [] } = useQuery({
    queryKey: ['members'],
    queryFn: getMembers
  })
  
  const { data: bookings = [] } = useQuery({
    queryKey: ['bookings'],
    queryFn: getBookings
  })
  
  const { data: events = [] } = useQuery({
    queryKey: ['events'],
    queryFn: getEvents
  })
  
  const { data: amenities = [] } = useQuery({
    queryKey: ['amenities'],
    queryFn: getAmenities
  })

  const now = new Date()
  // Compute midnight in Vietnam time so the "upcoming" cutoff is correct
  // regardless of the admin's browser timezone.
  const vnTodayStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' })
  const todayStart = new Date(`${vnTodayStr}T00:00:00+07:00`)
  const visibleBookingStatuses = ['pending', 'approved', 'checked-in']
  const visibleEventStatuses = ['pending', 'approved']

  const dashboardBookings = bookings.filter((b) => visibleBookingStatuses.includes(b.status))
  const dashboardEvents = events.filter((e) => visibleEventStatuses.includes(e.status))

  const stats = {
    totalMembers: members.length,
    activeBookings: dashboardBookings.filter(b => b.status === 'checked-in').length,
    upcomingBookings: dashboardBookings.filter(b => {
      const startTime = b.startTime ? new Date(b.startTime) : null
      if (!startTime) return false
      // Use Vietnam date string for a timezone-safe day comparison
      const bookingVnDateStr = startTime.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' })
      const bookingDayStart = new Date(`${bookingVnDateStr}T00:00:00+07:00`)
      return (b.status === 'approved' || b.status === 'pending') && bookingDayStart >= todayStart
    }).length,
    completedBookings: bookings.filter(b => {
      const bookingEnd = b.endTime ? new Date(b.endTime) : (b.startTime ? new Date(b.startTime) : null)
      if (!bookingEnd) return false
      return bookingEnd < now && b.status !== 'cancelled'
    }).length,
    upcomingEvents: dashboardEvents.filter(e => new Date(e.date) > new Date()).length,
    completedEvents: events.filter(e => {
      const eventDate = e.date ? new Date(e.date) : null
      if (!eventDate) return false
      return eventDate < now && e.status !== 'rejected'
    }).length,
    availableAmenities: amenities.filter(a => a.isAvailable !== false).length
  }

  const upcomingBookingsForList = dashboardBookings.filter(booking => {
    if (!booking.startTime) return false
    const start = booking.startTime instanceof Date ? booking.startTime : new Date(booking.startTime)
    const bookingVnDateStr = start.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' })
    const bookingDayStart = new Date(`${bookingVnDateStr}T00:00:00+07:00`)
    return bookingDayStart >= todayStart
  })

  const recentBookingsSorted = [...upcomingBookingsForList].sort((a, b) => {
    const aStart = a.startTime ? (a.startTime instanceof Date ? a.startTime : new Date(a.startTime)) : null
    const bStart = b.startTime ? (b.startTime instanceof Date ? b.startTime : new Date(b.startTime)) : null

    if (!aStart && !bStart) return 0
    if (!aStart) return 1
    if (!bStart) return -1
    return aStart - bStart
  })

  const totalRecentBookings = recentBookingsSorted.length
  const totalRecentBookingsPages = Math.max(1, Math.ceil(totalRecentBookings / RECENT_BOOKINGS_PAGE_SIZE))
  const safeRecentBookingsPage = Math.min(recentBookingsPage, totalRecentBookingsPages)
  const recentStartIndex = (safeRecentBookingsPage - 1) * RECENT_BOOKINGS_PAGE_SIZE
  const recentEndIndex = recentStartIndex + RECENT_BOOKINGS_PAGE_SIZE
  const recentBookingsPageItems = recentBookingsSorted.slice(recentStartIndex, recentEndIndex)
  const upcomingEvents = dashboardEvents.filter(e => new Date(e.date) > new Date()).slice(0, 5)

  const getOrganizerName = (organizerId) => {
    const organizer = members.find(m => m.id === organizerId)
    return organizer?.displayName || '—'
  }

  const truncateDescription = (text) => {
    if (!text || typeof text !== 'string') return ''
    return text.length <= DESCRIPTION_MAX_LENGTH
      ? text
      : `${text.slice(0, DESCRIPTION_MAX_LENGTH).trim()}…`
  }

  return (
    <Layout isAdmin>
      <div className="container">
        <h1 className="page-title">{t('adminDashboard.title')}</h1>
        
        <div className="stats-grid">
          <div className="stat-card glass">
            <h3 className="stat-value">{stats.totalMembers}</h3>
            <p className="stat-label">{t('adminDashboard.totalMembers')}</p>
          </div>
          <div className="stat-card glass">
            <h3 className="stat-value">{stats.activeBookings}</h3>
            <p className="stat-label">{t('adminDashboard.activeBookings')}</p>
          </div>
          <div className="stat-card glass">
            <h3 className="stat-value">{stats.upcomingBookings}</h3>
            <p className="stat-label">{t('adminDashboard.upcomingBookings')}</p>
          </div>
          <div className="stat-card glass">
            <h3 className="stat-value">{stats.completedBookings}</h3>
            <p className="stat-label">{t('adminDashboard.completedBookings')}</p>
          </div>
          <div className="stat-card glass">
            <h3 className="stat-value">{stats.upcomingEvents}</h3>
            <p className="stat-label">{t('adminDashboard.upcomingEvents')}</p>
          </div>
          <div className="stat-card glass">
            <h3 className="stat-value">{stats.completedEvents}</h3>
            <p className="stat-label">{t('adminDashboard.completedEvents')}</p>
          </div>
          <div className="stat-card glass">
            <h3 className="stat-value">{stats.availableAmenities}</h3>
            <p className="stat-label">{t('adminDashboard.availableAmenities')}</p>
          </div>
        </div>

        <div className="dashboard-grid">
          <div className="dashboard-section glass">
            <h2 className="section-title">{t('adminDashboard.recentBookings')}</h2>
            {recentBookingsPageItems.length > 0 ? (
              <ul className="booking-list">
                {recentBookingsPageItems.map(booking => {
                  const member = members.find(m => m.id === booking.memberId)
                  const amenity = amenities.find(a => a.id === booking.amenityId)
                  return (
                    <li key={booking.id} className="booking-item">
                      <div className="booking-info">
                        <span className="booking-amenity">{amenity?.name || booking.amenityId}</span>
                        <span className="booking-member">{member?.displayName || member?.email || booking.memberId}</span>
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
              <p className="empty-state">{t('adminDashboard.noRecentBookings')}</p>
            )}

            {totalRecentBookings > RECENT_BOOKINGS_PAGE_SIZE && (
              <div className="dashboard-recent-pagination">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setRecentBookingsPage(prev => Math.max(1, prev - 1))}
                  disabled={safeRecentBookingsPage === 1}
                >
                  {t('adminBookings.prevPage')}
                </button>
                <div className="dashboard-recent-pagination-info">
                  <span className="dashboard-recent-page">
                    {t('adminBookings.pageOf', { current: safeRecentBookingsPage, total: totalRecentBookingsPages })}
                  </span>
                  <span className="dashboard-recent-range">
                    {t('adminBookings.showingRange', {
                      from: totalRecentBookings === 0 ? 0 : recentStartIndex + 1,
                      to: Math.min(recentEndIndex, totalRecentBookings),
                      total: totalRecentBookings
                    })}
                  </span>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setRecentBookingsPage(prev => Math.min(totalRecentBookingsPages, prev + 1))}
                  disabled={safeRecentBookingsPage === totalRecentBookingsPages}
                >
                  {t('adminBookings.nextPage')}
                </button>
              </div>
            )}
          </div>

          <div className="dashboard-section glass">
            <div className="section-title-row">
              <h2 className="section-title">{t('adminDashboard.upcomingEvents')}</h2>
              <Link to="/admin/events" className="btn btn-secondary btn-sm">{t('common.viewAll')}</Link>
            </div>
            {upcomingEvents.length > 0 ? (
              <ul className="event-list event-list-detailed">
                {upcomingEvents.map(event => {
                  const attendeeCount = event.attendees?.length ?? 0
                  const capacity = event.capacity ?? 0
                  const spotsLeft = capacity > 0 ? Math.max(0, capacity - attendeeCount) : null
                  const full = capacity > 0 && attendeeCount >= capacity
                  const title = event.title || event.name || t('adminDashboard.untitledEvent')
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
                              <span className="event-time"> {t('adminDashboard.at')} {formatEventTime(event.date)}</span>
                            )}
                          </span>
                          <span className="event-organizer">
                            {t('adminDashboard.organizer', { name: getOrganizerName(event.organizerId) })}
                          </span>
                        </div>
                        {event.description && (
                          <p className="event-description-truncated">
                            {truncateDescription(event.description)}
                          </p>
                        )}
                        <div className="event-capacity-row">
                          <span className="event-capacity">
                            {t('adminDashboard.attendees', { current: attendeeCount, total: capacity || '∞' })}
                          </span>
                          {capacity > 0 && (
                            <span className="event-spots">
                              {full ? t('adminDashboard.full') : t('adminDashboard.spotsLeft', { count: spotsLeft })}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="event-item-actions">
                        <Link
                          to="/admin/events"
                          className="event-view-details"
                          aria-label={`Manage event: ${title}`}
                        >
                          {t('common.manage')}
                        </Link>
                      </div>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="empty-state">{t('adminDashboard.noUpcomingEvents')}</p>
            )}
          </div>
        </div>
      </div>
    </Layout>
  )
}

export default AdminDashboard
