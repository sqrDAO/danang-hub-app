import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../../contexts/AuthContext'
import Layout from '../../components/Layout'
import UnifiedCalendar from '../../components/UnifiedCalendar'
import { getBookings } from '../../services/bookings'
import { getUpcomingEvents } from '../../services/events'
import { getAmenities } from '../../services/amenities'
import './Dashboard.css'

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
                        <h4 className="booking-amenity">{amenity?.name || booking.amenityId}</h4>
                        <span className="booking-status">{booking.status}</span>
                      </div>
                      <div className="booking-time-info">
                        <span className="booking-time">
                          {booking.startTime?.toLocaleString() || 'N/A'}
                        </span>
                        <span className="booking-duration">
                          {booking.endTime && booking.startTime
                            ? `${Math.round((new Date(booking.endTime) - new Date(booking.startTime)) / (1000 * 60 * 60))}h`
                            : 'N/A'}
                        </span>
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
            <h2 className="section-title">Upcoming Events</h2>
            {upcomingEvents.length > 0 ? (
              <ul className="event-list">
                {upcomingEvents.map(event => (
                  <li key={event.id} className="event-item">
                    <div className="event-info">
                      <h4 className="event-title">{event.title}</h4>
                      <span className="event-date">
                        {event.date?.toLocaleDateString() || 'N/A'}
                      </span>
                    </div>
                    <span className="event-capacity">
                      {event.attendees?.length || 0} / {event.capacity || '∞'}
                    </span>
                  </li>
                ))}
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
