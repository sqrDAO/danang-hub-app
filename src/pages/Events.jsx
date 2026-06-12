import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import Layout from '../components/Layout'
import AuthPrompt from '../components/AuthPrompt'
import Modal from '../components/Modal'
import Avatar from '../components/Avatar'
import { getApprovedEvents, getUpcomingEvents } from '../services/events'
import { getMember } from '../services/members'
import { getProjects } from '../services/projects'
import { formatEventDate } from '../utils/timezone'
import './Events.css'
import './member/Profile.css'

const Events = () => {
  const { currentUser } = useAuth()
  const navigate = useNavigate()
  const [authPromptOpen, setAuthPromptOpen] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [hostModalMember, setHostModalMember] = useState(null)

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

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: getProjects
  })

  // On-demand fetch for the host modal. Skips loading the whole members
  // collection just to render organizer names — the event now carries those
  // denormalized fields.
  const handleOpenHostModal = async (organizerId) => {
    if (!organizerId) return
    setHostModalMember(null)
    try {
      const member = await getMember(organizerId)
      if (member) setHostModalMember(member)
    } catch (err) {
      console.warn('Failed to load organizer profile:', err)
    }
  }

  const isRegistered = (event) => {
    return event.attendees?.includes(currentUser?.uid) || false
  }

  const isFull = (event) => {
    const capacity = event.capacity || 50
    return event.attendees?.length >= capacity
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
              <p className="section-description">Click &quot;Register&quot; to join an event. If full, join the waitlist!</p>
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
                    {event.bannerUrl && (
                      <div className="event-card-banner">
                        <img src={event.bannerUrl} alt="" loading="lazy" decoding="async" />
                      </div>
                    )}
                    <div className="event-header">
                      <h3 className="event-title">{event.title}</h3>
                      <span className="event-date-badge">
                        {formatEventDate(event.date) || 'N/A'}
                      </span>
                    </div>
                    <div className="event-info">
                      <p className="event-organizer">
                        Organizer:{' '}
                        <button
                          className="organizer-link"
                          onClick={() => handleOpenHostModal(event.organizerId)}
                        >
                          {event.organizerDisplayName || event.organizerId}
                        </button>
                      </p>
                      {event.duration && (
                        <p className="event-duration">⏱️ Duration: {event.duration} minutes</p>
                      )}
                      <p className="event-capacity">
                        👥 {event.attendees?.length || 0} / {event.capacity || 50} attendees
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
                  {event.bannerUrl && (
                    <div className="event-card-banner">
                      <img src={event.bannerUrl} alt="" loading="lazy" decoding="async" />
                    </div>
                  )}
                  <div className="event-header">
                    <h3 className="event-title">{event.title}</h3>
                    <span className="event-date-badge">
                      {formatEventDate(event.date) || 'N/A'}
                    </span>
                  </div>
                  <div className="event-info">
                    <p className="event-organizer">
                      Organizer:{' '}
                      <button
                        className="organizer-link"
                        onClick={() => handleOpenHostModal(event.organizerId)}
                      >
                        {event.organizerDisplayName || event.organizerId}
                      </button>
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

        <Modal
          isOpen={!!hostModalMember}
          onClose={() => setHostModalMember(null)}
          title={hostModalMember?.displayName || 'Host'}
        >
          {hostModalMember && (
            <div className="profile-modal-content">
              <div className="profile-header">
                <div className="profile-avatar-wrap">
                  <Avatar src={hostModalMember.photoURL} name={hostModalMember.displayName} size="xl" />
                </div>
                <div className="profile-info">
                  <h2 className="profile-name">{hostModalMember.displayName || '—'}</h2>
                  {(hostModalMember.jobTitle || hostModalMember.company) && (
                    <p className="profile-email">
                      {[hostModalMember.jobTitle, hostModalMember.company].filter(Boolean).join(' · ')}
                    </p>
                  )}
                  <span className={`membership-badge ${hostModalMember.membershipType || 'member'}`}>
                    {hostModalMember.membershipType === 'admin' ? 'Admin' : 'Member'}
                  </span>
                </div>
              </div>

              <section className="profile-section">
                <h3 className="profile-section-title">Professional</h3>
                <div className="profile-detail-item">
                  <span className="detail-label">Company</span>
                  <span className="detail-value">{hostModalMember.company || '—'}</span>
                </div>
                <div className="profile-detail-item">
                  <span className="detail-label">Role</span>
                  <span className="detail-value">{hostModalMember.jobTitle || '—'}</span>
                </div>
                {hostModalMember.linkedIn && (
                  <div className="profile-detail-item">
                    <span className="detail-label">LinkedIn</span>
                    <span className="detail-value">
                      <a href={hostModalMember.linkedIn} target="_blank" rel="noopener noreferrer" className="profile-link">
                        {hostModalMember.linkedIn}
                      </a>
                    </span>
                  </div>
                )}
                {hostModalMember.website && (
                  <div className="profile-detail-item">
                    <span className="detail-label">Website</span>
                    <span className="detail-value">
                      <a href={hostModalMember.website} target="_blank" rel="noopener noreferrer" className="profile-link">
                        {hostModalMember.website}
                      </a>
                    </span>
                  </div>
                )}
              </section>

              <section className="profile-section">
                <h3 className="profile-section-title">About</h3>
                <div className="profile-detail-item profile-detail-bio">
                  <span className="detail-value">{hostModalMember.bio || '—'}</span>
                </div>
              </section>
            </div>
          )}
        </Modal>
      </div>
    </Layout>
  )
}

export default Events
