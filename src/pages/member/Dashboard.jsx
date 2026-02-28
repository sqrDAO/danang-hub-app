import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
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
  const { currentUser } = useAuth()
  const [showCalendar, setShowCalendar] = useState(false)
  
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

  const upcomingBookings = myBookings
    .filter(b => b.status === 'pending' || b.status === 'approved' || b.status === 'checked-in')
    .filter(b => new Date(b.startTime) > new Date())
    .slice(0, 5)

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
        <h1 className="page-title">Welcome Back!</h1>
        
        <div className="stats-grid">
          <div className="stat-card glass">
            <h3 className="stat-value">{upcomingBookings.length}</h3>
            <p className="stat-label">Upcoming Bookings</p>
          </div>
          <div className="stat-card glass">
            <h3 className="stat-value">{upcomingEvents.length}</h3>
            <p className="stat-label">Upcoming Events</p>
          </div>
          <div className="stat-card glass">
            <h3 className="stat-value">{availableAmenities}</h3>
            <p className="stat-label">Available Amenities</p>
          </div>
        </div>

        <div className="dashboard-section glass" style={{ marginBottom: 'var(--spacing-xl)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-md)' }}>
            <h2 className="section-title">Unified Calendar</h2>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowCalendar(!showCalendar)}>
              {showCalendar ? 'Hide Calendar' : 'Show Calendar'}
            </button>
          </div>
          {showCalendar && <UnifiedCalendar />}
        </div>

        <div className="dashboard-grid">
          <div className="dashboard-section glass">
            <h2 className="section-title">My Upcoming Bookings</h2>
            {upcomingBookings.length > 0 ? (
              <ul className="booking-list">
                {upcomingBookings.map(booking => {
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
                          {booking.status || 'pending'}
                        </span>
                        <div className="booking-time-info">
                          <span className="booking-time">
                            {booking.startTime ? new Date(booking.startTime).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric'
                            }) : 'N/A'}
                          </span>
                          <span className="booking-time-small">
                            {booking.startTime ? new Date(booking.startTime).toLocaleTimeString('en-US', {
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
              <p className="empty-state">No upcoming bookings</p>
            )}
          </div>

          <div className="dashboard-section glass">
            <div className="section-title-row">
              <h2 className="section-title">Upcoming Events</h2>
              <Link to="/member/events" className="btn btn-secondary btn-sm">View all</Link>
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
                  const title = event.title || event.name || 'Untitled Event'
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
                              <span className="event-time"> at {formatEventTime(event.date)}</span>
                            )}
                          </span>
                          <span className="event-organizer">
                            Organizer: {getOrganizerName(event.organizerId)}
                          </span>
                        </div>
                        {event.description && (
                          <p className="event-description-truncated">
                            {truncateDescription(event.description)}
                          </p>
                        )}
                        <div className="event-capacity-row">
                          <span className="event-capacity">
                            {attendeeCount} / {capacity || '∞'} attendees
                          </span>
                          {capacity > 0 && (
                            <span className="event-spots">
                              {full ? 'Full' : `${spotsLeft} spots left`}
                            </span>
                          )}
                        </div>
                        {(registered || onWaitlist) && (
                          <span className="event-my-status">
                            {registered ? '✓ Attending' : onWaitlist ? `On waitlist${waitlistPosition ? ` #${waitlistPosition}` : ''}` : ''}
                          </span>
                        )}
                      </div>
                      <div className="event-item-actions">
                        <Link
                          to="/member/events"
                          className="event-view-details"
                          aria-label={`View details for ${title}`}
                        >
                          View details
                        </Link>
                        {isExternal && (
                          <a
                            href={event.eventLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="event-signup-link"
                            aria-label={`Sign up for ${title}`}
                          >
                            Signup
                          </a>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="empty-state">No upcoming events</p>
            )}
          </div>
        </div>
      </div>
    </Layout>
  )
}

export default MemberDashboard
