import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import Layout from '../components/Layout'
import AuthPrompt from '../components/AuthPrompt'
import { getApprovedEvents, getUpcomingEvents, registerForEvent, unregisterFromEvent, addToWaitlist, removeFromWaitlist } from '../services/events'
import { getMembers } from '../services/members'
import { getProjects } from '../services/projects'
import { showToast } from '../components/Toast'
import './Events.css'

const Events = () => {
  const { currentUser } = useAuth()
  const navigate = useNavigate()
  const [authPromptOpen, setAuthPromptOpen] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState(null)

  const { data: upcomingEvents = [], isLoading: isLoadingEvents } = useQuery({
    queryKey: ['upcomingEvents'],
    queryFn: getUpcomingEvents,
    refetchOnWindowFocus: true,
    refetchOnMount: true
  })

  const { data: approvedEvents = [] } = useQuery({
    queryKey: ['approvedEvents'],
    queryFn: getApprovedEvents
  })

  const { data: members = [] } = useQuery({
    queryKey: ['members'],
    queryFn: getMembers
  })

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: getProjects
  })

  const getOrganizerName = (organizerId) => {
    const organizer = members.find(m => m.id === organizerId)
    return organizer?.displayName || organizerId
  }

  const isRegistered = (event) => {
    return event.attendees?.includes(currentUser?.uid) || false
  }

  const isFull = (event) => {
    return event.capacity && event.attendees?.length >= event.capacity
  }

  const isOnWaitlist = (event) => {
    return event.waitlist?.includes(currentUser?.uid) || false
  }

  const getWaitlistPosition = (event) => {
    if (!event.waitlist || !isOnWaitlist(event)) return null
    return event.waitlist.indexOf(currentUser?.uid) + 1
  }

  const handleRegister = async (eventId) => {
    if (!currentUser) {
      const event = upcomingEvents.find(e => e.id === eventId) || approvedEvents.find(e => e.id === eventId)
      setSelectedEvent(event)
      setAuthPromptOpen(true)
      return
    }

    navigate(`/member/events?action=register&eventId=${eventId}`)
  }

  const handleLogin = () => {
    if (selectedEvent) {
      navigate(`/login?redirect=/member/events&eventId=${selectedEvent.id}&action=register`)
    } else {
      navigate('/login?redirect=/member/events')
    }
  }

  const handleSignUp = () => {
    if (selectedEvent) {
      navigate(`/login?signup=true&redirect=/member/events&eventId=${selectedEvent.id}&action=register`)
    } else {
      navigate('/login?signup=true&redirect=/member/events')
    }
  }

  // Filter upcoming events by date (approved and pending)
  const upcomingEventsFiltered = upcomingEvents.filter(e => {
    if (!e.date) return false
    const eventDate = e.date instanceof Date ? e.date : new Date(e.date)
    const now = new Date()
    return eventDate > now
  })

  // Past events (only approved ones for historical record)
  const pastEvents = approvedEvents.filter(e => {
    if (!e.date) return false
    const eventDate = e.date instanceof Date ? e.date : new Date(e.date)
    const now = new Date()
    return eventDate <= now
  })

  return (
    <Layout public>
      <div className="container">
        <div className="page-header">
          <h1 className="page-title">Events</h1>
          <p className="page-subtitle">Browse community events and register to attend</p>
        </div>

        {/* Upcoming Events */}
        <div className="events-section glass">
          <div className="section-header">
            <h2 className="section-title">Upcoming Events</h2>
            {upcomingEventsFiltered.length > 0 && (
              <p className="section-description">Click "Register" to join an event. If full, join the waitlist!</p>
            )}
          </div>
          {isLoadingEvents ? (
            <p className="empty-state">Loading events...</p>
          ) : upcomingEventsFiltered.length > 0 ? (
            <div className="events-grid">
              {upcomingEventsFiltered.map(event => {
                const registered = currentUser ? isRegistered(event) : false
                const full = isFull(event)
                const onWaitlist = currentUser ? isOnWaitlist(event) : false
                const waitlistPosition = currentUser ? getWaitlistPosition(event) : null
                return (
                  <div key={event.id} className="event-card">
                    <div className="event-header">
                      <h3 className="event-title">{event.title}</h3>
                      <span className="event-date-badge">
                        {event.date?.toLocaleDateString() || 'N/A'}
                      </span>
                    </div>
                    <div className="event-info">
                      <p className="event-organizer">
                        Organizer: {getOrganizerName(event.organizerId)}
                      </p>
                      {event.duration && (
                        <p className="event-duration">⏱️ Duration: {event.duration} minutes</p>
                      )}
                      <p className="event-capacity">
                        👥 {event.attendees?.length || 0} / {event.capacity || 80} attendees
                      </p>
                      {event.hostingProjects && (
                        <p className="event-projects">
                          🏢 Hosted by: {typeof event.hostingProjects === 'string' 
                            ? event.hostingProjects 
                            : event.hostingProjects.map(projectId => {
                                const project = projects.find(p => p.id === projectId)
                                return project?.name || projectId
                              }).join(', ')}
                        </p>
                      )}
                      {event.eventLink && (
                        <p className="event-link">
                          🔗 <a href={event.eventLink} target="_blank" rel="noopener noreferrer">Event Link</a>
                        </p>
                      )}
                      {event.waitlist && event.waitlist.length > 0 && (
                        <p className="event-waitlist">
                          {event.waitlist.length} on waitlist
                        </p>
                      )}
                      {waitlistPosition && (
                        <p className="event-waitlist-position">
                          Your position: #{waitlistPosition}
                        </p>
                      )}
                      {event.description && (
                        <p className="event-description">{event.description}</p>
                      )}
                    </div>
                    <div className="event-actions">
                      {currentUser ? (
                        registered ? (
                          <button
                            className="btn btn-secondary btn-full-width"
                            onClick={() => navigate(`/member/events?action=unregister&eventId=${event.id}`)}
                          >
                            ✓ Registered - Click to Unregister
                          </button>
                        ) : onWaitlist ? (
                          <button
                            className="btn btn-secondary btn-full-width"
                            onClick={() => navigate(`/member/events?action=leaveWaitlist&eventId=${event.id}`)}
                          >
                            On Waitlist - Click to Leave
                          </button>
                        ) : (
                          <>
                            <button
                              className="btn btn-primary btn-full-width btn-large"
                              onClick={() => handleRegister(event.id)}
                              disabled={full}
                            >
                              {full ? 'Event Full' : '✓ Register for Event'}
                            </button>
                            {full && (
                              <button
                                className="btn btn-secondary btn-full-width"
                                onClick={() => navigate(`/member/events?action=joinWaitlist&eventId=${event.id}`)}
                                style={{ marginTop: '0.5rem' }}
                              >
                                Join Waitlist
                              </button>
                            )}
                          </>
                        )
                      ) : (
                        <>
                          <button
                            className="btn btn-primary btn-full-width btn-large"
                            onClick={() => handleRegister(event.id)}
                            disabled={full}
                          >
                            {full ? 'Event Full' : 'Register for Event'}
                          </button>
                          {full && (
                            <p className="event-full-note">Sign in to join the waitlist</p>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div>
              <p className="empty-state">No upcoming events at this time</p>
            </div>
          )}
        </div>

        {/* Past Events */}
        {pastEvents.length > 0 && (
          <div className="events-section glass">
            <div className="section-header">
              <h2 className="section-title">Past Events</h2>
            </div>
            <div className="events-grid">
              {pastEvents.map(event => (
                <div key={event.id} className="event-card past-event">
                  <div className="event-header">
                    <h3 className="event-title">{event.title}</h3>
                    <span className="event-date-badge">
                      {event.date?.toLocaleDateString() || 'N/A'}
                    </span>
                  </div>
                  <div className="event-info">
                    <p className="event-organizer">
                      Organizer: {getOrganizerName(event.organizerId)}
                    </p>
                    {event.duration && (
                      <p className="event-duration">⏱️ Duration: {event.duration} minutes</p>
                    )}
                    {event.hostingProjects && (
                      <p className="event-projects">
                        🏢 Hosted by: {typeof event.hostingProjects === 'string'
                          ? event.hostingProjects
                          : event.hostingProjects.map(projectId => {
                            const project = projects.find(p => p.id === projectId)
                            return project?.name || projectId
                          }).join(', ')}
                      </p>
                    )}
                    {event.eventLink && (
                      <p className="event-link">
                        🔗 <a href={event.eventLink} target="_blank" rel="noopener noreferrer">Event Link</a>
                      </p>
                    )}
                    {currentUser && event.attendees?.includes(currentUser.uid) && (
                      <p className="event-attended">✅ You attended this event</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <AuthPrompt
          isOpen={authPromptOpen}
          onClose={() => {
            setAuthPromptOpen(false)
            setSelectedEvent(null)
          }}
          action="register"
          onLogin={handleLogin}
          onSignUp={handleSignUp}
        />
      </div>
    </Layout>
  )
}

export default Events
