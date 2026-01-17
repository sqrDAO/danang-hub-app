import { useQuery } from '@tanstack/react-query'
import Layout from '../../components/Layout'
import { getMembers } from '../../services/members'
import { getBookings } from '../../services/bookings'
import { getEvents } from '../../services/events'
import { getAmenities } from '../../services/amenities'
import './Dashboard.css'

const AdminDashboard = () => {
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
  const stats = {
    totalMembers: members.length,
    activeBookings: bookings.filter(b => b.status === 'checked-in' || b.status === 'pending').length,
    upcomingBookings: bookings.filter(b => {
      const startTime = b.startTime ? new Date(b.startTime) : null
      return (b.status === 'approved' || b.status === 'pending') && startTime && startTime > now
    }).length,
    upcomingEvents: events.filter(e => new Date(e.date) > new Date()).length,
    availableAmenities: amenities.filter(a => a.isAvailable !== false).length
  }

  const recentBookings = bookings.slice(0, 5)
  const upcomingEvents = events.filter(e => new Date(e.date) > new Date()).slice(0, 5)

  return (
    <Layout isAdmin>
      <div className="container">
        <h1 className="page-title">Admin Dashboard</h1>
        
        <div className="stats-grid">
          <div className="stat-card glass">
            <h3 className="stat-value">{stats.totalMembers}</h3>
            <p className="stat-label">Total Members</p>
          </div>
          <div className="stat-card glass">
            <h3 className="stat-value">{stats.activeBookings}</h3>
            <p className="stat-label">Active Bookings</p>
          </div>
          <div className="stat-card glass">
            <h3 className="stat-value">{stats.upcomingBookings}</h3>
            <p className="stat-label">Upcoming Bookings</p>
          </div>
          <div className="stat-card glass">
            <h3 className="stat-value">{stats.upcomingEvents}</h3>
            <p className="stat-label">Upcoming Events</p>
          </div>
          <div className="stat-card glass">
            <h3 className="stat-value">{stats.availableAmenities}</h3>
            <p className="stat-label">Available Amenities</p>
          </div>
        </div>

        <div className="dashboard-grid">
          <div className="dashboard-section glass">
            <h2 className="section-title">Recent Bookings</h2>
            {recentBookings.length > 0 ? (
              <ul className="booking-list">
                {recentBookings.map(booking => {
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
              <p className="empty-state">No recent bookings</p>
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
                      {event.attendees?.length || 0} / {event.capacity}
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

export default AdminDashboard
