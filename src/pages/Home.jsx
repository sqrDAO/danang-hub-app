import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../contexts/AuthContext'
import Layout from '../components/Layout'
import AuthPrompt from '../components/AuthPrompt'
import { getAmenities } from '../services/amenities'
import { getUpcomingEvents, getApprovedEvents } from '../services/events'
import { getMembers } from '../services/members'
import { getProjects } from '../services/projects'
import './Home.css'

const Home = () => {
  const { t, i18n } = useTranslation()
  const { currentUser, isAdmin } = useAuth()
  const navigate = useNavigate()
  const [authPromptOpen, setAuthPromptOpen] = useState(false)
  const [selectedAmenity, setSelectedAmenity] = useState(null)
  const [selectedEvent, setSelectedEvent] = useState(null)

  const { data: amenities = [], isLoading: amenitiesLoading } = useQuery({
    queryKey: ['amenities'],
    queryFn: getAmenities
  })

  const { data: events = [], isLoading: eventsLoading } = useQuery({
    queryKey: ['upcomingEvents'],
    queryFn: getUpcomingEvents
  })

  const { data: approvedEvents = [] } = useQuery({
    queryKey: ['approvedEvents'],
    queryFn: getApprovedEvents
  })

  const { data: members = [] } = useQuery({
    queryKey: ['members'],
    queryFn: getMembers,
    enabled: !!currentUser
  })

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: getProjects
  })

  const getOrganizerName = (organizerId) => {
    const organizer = members.find(m => m.id === organizerId)
    return organizer?.displayName || organizerId
  }

  const handleBookAmenity = (amenity) => {
    if (!currentUser) {
      setSelectedAmenity(amenity)
      setAuthPromptOpen(true)
    } else if (amenity.type === 'event-space') {
      navigate(`/member/events?action=create&amenityId=${amenity.id}`)
    } else {
      navigate(`/member/bookings?amenityId=${amenity.id}`)
    }
  }

  const handleLogin = () => {
    if (selectedAmenity) {
      const redirectPath = selectedAmenity.type === 'event-space'
        ? `/login?redirect=/member/events&action=create&amenityId=${selectedAmenity.id}`
        : `/login?redirect=/member/bookings&amenityId=${selectedAmenity.id}`
      navigate(redirectPath)
    } else if (selectedEvent) {
      navigate(`/login?redirect=/member/events&eventId=${selectedEvent.id}&action=register`)
    } else {
      navigate('/login')
    }
  }

  const handleSignUp = () => {
    if (selectedAmenity) {
      const redirectPath = selectedAmenity.type === 'event-space'
        ? `/login?signup=true&redirect=/member/events&action=create&amenityId=${selectedAmenity.id}`
        : `/login?signup=true&redirect=/member/bookings&amenityId=${selectedAmenity.id}`
      navigate(redirectPath)
    } else if (selectedEvent) {
      navigate(`/login?signup=true&redirect=/member/events&eventId=${selectedEvent.id}&action=register`)
    } else {
      navigate('/login?signup=true')
    }
  }

  const handleRegisterEvent = (event) => {
    if (!currentUser) {
      setSelectedEvent(event)
      setAuthPromptOpen(true)
      return
    }
    
    // For logged-in users, navigate to member events page
    // The MemberEvents page will handle the registration via query params
    navigate(`/member/events?action=register&eventId=${event.id}`)
  }

  const availableAmenities = amenities.filter(a => a.isAvailable !== false)
  
  const upcomingEvents = events
    .filter(e => {
      if (!e.date) return false
      const eventDate = e.date instanceof Date ? e.date : new Date(e.date)
      const now = new Date()
      return eventDate > now
    })

  const pastEvents = approvedEvents.filter(e => {
    if (!e.date) return false
    const eventDate = e.date instanceof Date ? e.date : new Date(e.date)
    const now = new Date()
    return eventDate <= now
  })

  const locale = i18n.language && i18n.language.startsWith('vi') ? 'vi-VN' : 'en-US'

  return (
    <Layout public>
      <div className="home-container">
        {/* Hero Section */}
        <section id="hero" className="hero-section">
          <div className="hero-content">
            <h1 className="hero-title">
              <span className="gradient-text">Da Nang Blockchain Hub</span> {t('home.heroPortalLabel', { defaultValue: 'Portal' })}
            </h1>
            <p className="hero-subtitle">
              {t('home.heroSubtitle')}
            </p>
            {currentUser ? (
              <div className="hero-cta">
                <Link 
                  to={isAdmin() ? '/admin' : '/member'} 
                  className="btn btn-primary btn-large"
                >
                  {t('home.ctaDashboard')}
                </Link>
                <a href="#amenities" className="btn btn-secondary btn-large">
                  {t('home.ctaBrowseAmenities')}
                </a>
              </div>
            ) : (
              <div className="hero-cta">
                <Link to="/login?signup=true" className="btn btn-primary btn-large">
                  {t('home.ctaGetStarted')}
                </Link>
                <a href="#amenities" className="btn btn-secondary btn-large">
                  {t('home.ctaBrowseAmenities')}
                </a>
              </div>
            )}
          </div>
        </section>

        {/* Amenities Section */}
        <section id="amenities" className="preview-section">
          <div className="container">
            <div className="section-header">
              <h2 className="section-title">{t('home.amenitiesTitle')}</h2>
            </div>
            {amenitiesLoading ? (
              <p className="loading-text">{t('home.amenitiesLoading')}</p>
            ) : availableAmenities.length > 0 ? (
              <div className="amenities-preview-grid">
                {availableAmenities.map(amenity => (
                  <div key={amenity.id} className="amenity-preview-card glass">
                    {amenity.photos && amenity.photos.length > 0 ? (
                      <div className="amenity-preview-photo">
                        <img src={amenity.photos[0]} alt={amenity.name} />
                        {amenity.photos.length > 1 && (
                          <span className="amenity-photo-count-badge">{amenity.photos.length}</span>
                        )}
                      </div>
                    ) : (
                      <div className="amenity-preview-photo-placeholder">
                        <span>{t('home.amenitiesNoPhoto')}</span>
                      </div>
                    )}
                    <div>
                      <h4 className="amenity-preview-name">{amenity.name}</h4>
                      <p className="amenity-preview-type">{amenity.type}</p>
                      {amenity.capacity && (
                        <p className="amenity-preview-capacity">
                          {t('home.amenitiesCapacity', { count: amenity.capacity })}
                        </p>
                      )}
                      {amenity.description && (
                        <p className="amenity-preview-description">{amenity.description}</p>
                      )}
                    </div>
                    <button
                      className="btn btn-primary btn-full-width"
                      onClick={() => handleBookAmenity(amenity)}
                      style={{ marginTop: 'var(--spacing-md)' }}
                    >
                      📅 {t('common.bookNow')}
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="empty-state">{t('home.amenitiesEmpty')}</p>
            )}
          </div>
        </section>

        {/* Events Section */}
        <section id="events" className="preview-section">
          <div className="container">
            <div className="section-header">
              <h2 className="section-title">{t('home.eventsTitle')}</h2>
            </div>
            {eventsLoading ? (
              <p className="loading-text">{t('home.eventsLoading')}</p>
            ) : upcomingEvents.length > 0 ? (
              <div className="events-preview-grid">
                {upcomingEvents.map(event => (
                  <div key={event.id} className="event-preview-card glass">
                    {event.bannerUrl && (
                      <div className="event-preview-banner">
                        <img src={event.bannerUrl} alt="" />
                      </div>
                    )}
                    <div>
                      <h4 className="event-preview-title">{event.title}</h4>
                      <p className="event-preview-date">
                        {event.date ? (() => {
                          const d = event.date instanceof Date ? event.date : new Date(event.date)
                          return d.toLocaleDateString(locale, {
                            timeZone: 'Asia/Ho_Chi_Minh',
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                          })
                        })() : null}
                      </p>
                      {event.duration && (
                        <p className="event-preview-duration">
                          ⏱️ {t('home.eventsDuration', { minutes: event.duration })}
                        </p>
                      )}
                      {event.capacity && (
                        <p className="event-preview-capacity">
                          👥 {t('home.eventsCapacity', {
                            attendees: event.attendees?.length || 0,
                            capacity: event.capacity
                          })}
                        </p>
                      )}
                      {event.hostingProjects && (
                        <p className="event-preview-projects">
                          🏢 {t('home.eventsHostedBy', {
                            hosts: typeof event.hostingProjects === 'string'
                              ? event.hostingProjects
                              : event.hostingProjects.map(projectId => {
                                  const project = projects.find(p => p.id === projectId)
                                  return project?.name || projectId
                                }).join(', ')
                          })}
                        </p>
                      )}
                      {event.eventLink && (
                        <p className="event-preview-link">
                          🔗{' '}
                          <a href={event.eventLink} target="_blank" rel="noopener noreferrer">
                            {t('home.eventsLink')}
                          </a>
                        </p>
                      )}
                      {event.description && (
                        <p className="event-preview-description">{event.description}</p>
                      )}
                    </div>
                    <button
                      className="btn btn-primary btn-full-width"
                      onClick={() => handleRegisterEvent(event)}
                      disabled={event.capacity && event.attendees?.length >= event.capacity}
                      style={{ marginTop: 'var(--spacing-md)' }}
                    >
                      {event.capacity && event.attendees?.length >= event.capacity
                        ? t('home.eventsFull')
                        : t('home.eventsRegister')}
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="empty-state">{t('home.eventsEmpty')}</p>
            )}
          </div>
        </section>

        {/* Past Events Section */}
        {pastEvents.length > 0 && (
          <section id="past-events" className="preview-section">
            <div className="container">
              <div className="section-header">
                <h2 className="section-title">{t('home.pastEventsTitle')}</h2>
              </div>
              <div className="events-preview-grid">
                {pastEvents.map(event => (
                  <div key={event.id} className="event-preview-card glass past-event">
                    {event.bannerUrl && (
                      <div className="event-preview-banner">
                        <img src={event.bannerUrl} alt="" />
                      </div>
                    )}
                    <div>
                      <h4 className="event-preview-title">{event.title}</h4>
                      <p className="event-preview-date">
                        {event.date ? (() => {
                          const d = event.date instanceof Date ? event.date : new Date(event.date)
                          return d.toLocaleDateString(locale, {
                            timeZone: 'Asia/Ho_Chi_Minh',
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                          })
                        })() : null}
                      </p>
                      {event.hostingProjects && (
                        <p className="event-preview-projects">
                          🏢 Hosted by: {typeof event.hostingProjects === 'string' 
                            ? event.hostingProjects 
                            : event.hostingProjects.map(projectId => {
                                const project = projects.find(p => p.id === projectId)
                                return project?.name || projectId
                              }).join(', ')}
                        </p>
                      )}
                      {event.eventLink && (
                        <p className="event-preview-link">
                          🔗{' '}
                          <a href={event.eventLink} target="_blank" rel="noopener noreferrer">
                            {t('home.eventsLink')}
                          </a>
                        </p>
                      )}
                      {currentUser && event.attendees?.includes(currentUser.uid) && (
                        <p className="event-attended">✅ {t('home.pastEventsAttended')}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        <AuthPrompt
          isOpen={authPromptOpen}
          onClose={() => {
            setAuthPromptOpen(false)
            setSelectedAmenity(null)
            setSelectedEvent(null)
          }}
          action={selectedAmenity ? 'book' : 'register'}
          onLogin={handleLogin}
          onSignUp={handleSignUp}
        />

        {/* CTA Section */}
        {!currentUser && (
          <section className="cta-section">
            <div className="container">
              <div className="cta-content glass">
                <h2 className="cta-title">{t('common.readyToGetStarted')}</h2>
                <p className="cta-description">
                  {t('common.signUpCta')}
                </p>
                <Link to="/login?signup=true" className="btn btn-primary btn-large">
                  {t('common.ctaPrimary')}
                </Link>
              </div>
            </div>
          </section>
        )}
      </div>
    </Layout>
  )
}

export default Home
