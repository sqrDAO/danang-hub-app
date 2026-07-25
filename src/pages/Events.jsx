import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../hooks/useAuth'
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

const getHostingProjectsLabel = (hostingProjects, projects) => {
  if (typeof hostingProjects === 'string') return hostingProjects
  return hostingProjects.map(projectId => {
    const project = projects.find(p => p.id === projectId)
    return project?.name || projectId
  }).join(', ')
}

const HostingProjectsLine = ({ hostingProjects, projects, t }) => {
  if (!hostingProjects) return null
  return (
    <p className="event-projects">
      🏢 {t('memberEvents.hosted', { hosts: getHostingProjectsLabel(hostingProjects, projects) })}
    </p>
  )
}

const UpcomingEventInfo = ({ event, projects, waitlistPosition, onOpenHost, t }) => (
  <div className="event-info">
    <p className="event-organizer">
      {t('publicEvents.organizerLabel')}{' '}
      <button
        className="organizer-link"
        onClick={() => onOpenHost(event.organizerId)}
      >
        {event.organizerDisplayName || event.organizerId}
      </button>
    </p>
    {event.duration && (
      <p className="event-duration">⏱️ {t('memberEvents.duration', { minutes: event.duration })}</p>
    )}
    <p className="event-capacity">
      👥 {t('memberEvents.attendees', { current: event.attendees?.length || 0, total: event.capacity || 50 })}
    </p>
    <HostingProjectsLine hostingProjects={event.hostingProjects} projects={projects} t={t} />
    {event.eventLink && (
      <p className="event-link">
        🔗 <a href={event.eventLink} target="_blank" rel="noopener noreferrer">{t('memberEvents.eventLink')}</a>
      </p>
    )}
    {event.waitlist && event.waitlist.length > 0 && (
      <p className="event-waitlist">
        {t('memberEvents.onWaitlist', { count: event.waitlist.length })}
      </p>
    )}
    {waitlistPosition && (
      <p className="event-waitlist-position">
        {t('memberEvents.yourPosition', { position: waitlistPosition })}
      </p>
    )}
    {event.description && (
      <p className="event-description">{event.description}</p>
    )}
  </div>
)

const UpcomingEventActions = ({ event, currentUser, registered, full, onWaitlist, onRegister, navigate, t }) => (
  <div className="event-actions">
    {currentUser ? (
      registered ? (
        <button
          className="btn btn-secondary btn-full-width"
          onClick={() => navigate(`/member/events?action=unregister&eventId=${event.id}`)}
        >
          {t('memberEvents.registeredUnregister')}
        </button>
      ) : onWaitlist ? (
        <button
          className="btn btn-secondary btn-full-width"
          onClick={() => navigate(`/member/events?action=leaveWaitlist&eventId=${event.id}`)}
        >
          {t('memberEvents.onWaitlistLeave')}
        </button>
      ) : (
        <>
          <button
            className="btn btn-primary btn-full-width btn-large"
            onClick={() => onRegister(event.id)}
            disabled={full}
          >
            {full ? t('memberEvents.eventFull') : t('memberEvents.registerForEvent')}
          </button>
          {full && (
            <button
              className="btn btn-secondary btn-full-width"
              onClick={() => navigate(`/member/events?action=joinWaitlist&eventId=${event.id}`)}
              style={{ marginTop: '0.5rem' }}
            >
              {t('memberEvents.joinWaitlist')}
            </button>
          )}
        </>
      )
    ) : (
      <>
        <button
          className="btn btn-primary btn-full-width btn-large"
          onClick={() => onRegister(event.id)}
          disabled={full}
        >
          {full ? t('memberEvents.eventFull') : t('home.eventsRegister')}
        </button>
        {full && (
          <p className="event-full-note">{t('publicEvents.signInToJoinWaitlist')}</p>
        )}
      </>
    )}
  </div>
)

const HostProfessionalSection = ({ member, t }) => (
  <section className="profile-section">
    <h3 className="profile-section-title">{t('profile.professional')}</h3>
    <div className="profile-detail-item">
      <span className="detail-label">{t('profile.company')}</span>
      <span className="detail-value">{member.company || '—'}</span>
    </div>
    <div className="profile-detail-item">
      <span className="detail-label">{t('profile.role')}</span>
      <span className="detail-value">{member.jobTitle || '—'}</span>
    </div>
    {member.linkedIn && (
      <div className="profile-detail-item">
        <span className="detail-label">{t('profile.linkedIn')}</span>
        <span className="detail-value">
          <a href={member.linkedIn} target="_blank" rel="noopener noreferrer" className="profile-link">
            {member.linkedIn}
          </a>
        </span>
      </div>
    )}
    {member.website && (
      <div className="profile-detail-item">
        <span className="detail-label">{t('profile.website')}</span>
        <span className="detail-value">
          <a href={member.website} target="_blank" rel="noopener noreferrer" className="profile-link">
            {member.website}
          </a>
        </span>
      </div>
    )}
  </section>
)

const HostProfileModal = ({ member, onClose, t }) => (
  <Modal
    isOpen={!!member}
    onClose={onClose}
    title={member?.displayName || t('memberEvents.host')}
  >
    {member && (
      <div className="profile-modal-content">
        <div className="profile-header">
          <div className="profile-avatar-wrap">
            <Avatar src={member.photoURL} name={member.displayName} size="xl" />
          </div>
          <div className="profile-info">
            <h2 className="profile-name">{member.displayName || '—'}</h2>
            {(member.jobTitle || member.company) && (
              <p className="profile-email">
                {[member.jobTitle, member.company].filter(Boolean).join(' · ')}
              </p>
            )}
            <span className={`membership-badge ${member.membershipType || 'member'}`}>
              {member.membershipType === 'admin' ? t('adminMembers.adminOption') : t('adminMembers.memberOption')}
            </span>
          </div>
        </div>

        <HostProfessionalSection member={member} t={t} />

        <section className="profile-section">
          <h3 className="profile-section-title">{t('profile.about')}</h3>
          <div className="profile-detail-item profile-detail-bio">
            <span className="detail-value">{member.bio || '—'}</span>
          </div>
        </section>
      </div>
    )}
  </Modal>
)

const Events = () => {
  const { t } = useTranslation()
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
          <h1 className="page-title">{t('memberEvents.title')}</h1>
          <p className="page-subtitle">{t('publicEvents.subtitle')}</p>
        </div>

        {/* Upcoming Events */}
        <div className="events-section glass">
          <div className="section-header">
            <h2 className="section-title">{t('memberEvents.upcomingEvents')}</h2>
            {upcomingEventsFiltered.length > 0 && (
              <p className="section-description">{t('memberEvents.upcomingEventsDesc')}</p>
            )}
          </div>
          {isLoadingEvents ? (
            <p className="empty-state">{t('memberEvents.loadingEvents')}</p>
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
                        {formatEventDate(event.date) || t('common.na')}
                      </span>
                    </div>
                    <UpcomingEventInfo
                      event={event}
                      projects={projects}
                      waitlistPosition={waitlistPosition}
                      onOpenHost={handleOpenHostModal}
                      t={t}
                    />
                    <UpcomingEventActions
                      event={event}
                      currentUser={currentUser}
                      registered={registered}
                      full={full}
                      onWaitlist={onWaitlist}
                      onRegister={handleRegister}
                      navigate={navigate}
                      t={t}
                    />
                  </div>
                )
              })}
            </div>
          ) : (
            <div>
              <p className="empty-state">{t('home.eventsEmpty')}</p>
            </div>
          )}
        </div>

        {/* Past Events */}
        {pastEvents.length > 0 && (
          <div className="events-section glass">
            <div className="section-header">
              <h2 className="section-title">{t('memberEvents.pastEvents')}</h2>
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
                      {formatEventDate(event.date) || t('common.na')}
                    </span>
                  </div>
                  <div className="event-info">
                    <p className="event-organizer">
                      {t('publicEvents.organizerLabel')}{' '}
                      <button
                        className="organizer-link"
                        onClick={() => handleOpenHostModal(event.organizerId)}
                      >
                        {event.organizerDisplayName || event.organizerId}
                      </button>
                    </p>
                    {event.duration && (
                      <p className="event-duration">⏱️ {t('memberEvents.duration', { minutes: event.duration })}</p>
                    )}
                    <HostingProjectsLine hostingProjects={event.hostingProjects} projects={projects} t={t} />
                    {event.eventLink && (
                      <p className="event-link">
                        🔗 <a href={event.eventLink} target="_blank" rel="noopener noreferrer">{t('memberEvents.eventLink')}</a>
                      </p>
                    )}
                    {currentUser && event.attendees?.includes(currentUser.uid) && (
                      <p className="event-attended">{t('memberEvents.attended')}</p>
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

        <HostProfileModal
          member={hostModalMember}
          onClose={() => setHostModalMember(null)}
          t={t}
        />
      </div>
    </Layout>
  )
}

export default Events
