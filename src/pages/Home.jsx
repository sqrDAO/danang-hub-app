import { useState, lazy, Suspense } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../hooks/useAuth'
import usePrefersReducedMotion from '../hooks/usePrefersReducedMotion'
import { formatEventDate } from '../utils/timezone'
import Layout from '../components/Layout'
import AuthPrompt from '../components/AuthPrompt'
import AmenityPhotoLightbox from '../components/AmenityPhotoLightbox'
import { getAmenities } from '../services/amenities'
import { getUpcomingEvents, getApprovedEvents } from '../services/events'
import { getProjects } from '../services/projects'
import './Home.css'

const HeroCanvas3D = lazy(() =>
  import('../components/HeroCanvas3D').catch(() => ({ default: () => null }))
)

const HeroWallpaper = () => {
  const reducedMotion = usePrefersReducedMotion()
  if (reducedMotion) return null
  return (
    <Suspense fallback={null}>
      <HeroCanvas3D />
    </Suspense>
  )
}

const getHostingProjectsLabel = (hostingProjects, projects) => {
  if (typeof hostingProjects === 'string') return hostingProjects
  return hostingProjects.map(projectId => {
    const project = projects.find(p => p.id === projectId)
    return project?.name || projectId
  }).join(', ')
}

const isEventFull = (event) => event.capacity && event.attendees?.length >= event.capacity

const asDate = (value) => (value instanceof Date ? value : new Date(value))

const amenityMemberPath = (amenity) => (
  amenity.type === 'event-space'
    ? `/member/events?action=create&amenityId=${amenity.id}`
    : `/member/bookings?amenityId=${amenity.id}`
)

const loginPath = (signup, redirect, extra = {}) => {
  const params = new URLSearchParams()
  if (signup) params.set('signup', 'true')
  params.set('redirect', redirect)
  Object.entries(extra).forEach(([key, value]) => params.set(key, value))
  return `/login?${params.toString()}`
}

const amenityAuthPath = (amenity, signup) => (
  amenity.type === 'event-space'
    ? loginPath(signup, '/member/events', { action: 'create', amenityId: amenity.id })
    : loginPath(signup, '/member/bookings', { amenityId: amenity.id })
)

const HeroCta = ({ currentUser, isAdmin, t }) => {
  const to = currentUser ? (isAdmin() ? '/admin' : '/member') : '/login?signup=true'
  const label = currentUser ? t('home.ctaDashboard') : t('home.ctaGetStarted')
  return (
    <div className="hero-cta">
      <Link to={to} className="btn btn-primary btn-large">{label}</Link>
      <a href="#amenities" className="btn btn-secondary btn-large">
        {t('home.ctaBrowseAmenities')}
      </a>
    </div>
  )
}

const EventBanner = ({ url }) => (
  url ? (
    <div className="event-preview-banner">
      <img src={url} alt="" loading="lazy" decoding="async" />
    </div>
  ) : null
)

const HostedBy = ({ event, projects, t }) => (
  event.hostingProjects ? (
    <p className="event-preview-projects">
      🏢 {t('home.eventsHostedBy', {
        hosts: getHostingProjectsLabel(event.hostingProjects, projects)
      })}
    </p>
  ) : null
)

const EventLinkLine = ({ event, t }) => (
  event.eventLink ? (
    <p className="event-preview-link">
      🔗{' '}
      <a href={event.eventLink} target="_blank" rel="noopener noreferrer">
        {t('home.eventsLink')}
      </a>
    </p>
  ) : null
)

const EventPreviewCard = ({ event, projects, onRegister, t }) => (
  <div className="event-preview-card">
    <EventBanner url={event.bannerUrl} />
    <div>
      <h4 className="event-preview-title">{event.title}</h4>
      <p className="event-preview-date">
        {event.date ? formatEventDate(event.date) : null}
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
      <HostedBy event={event} projects={projects} t={t} />
      <EventLinkLine event={event} t={t} />
      {event.description && (
        <p className="event-preview-description">{event.description}</p>
      )}
    </div>
    <button
      className="btn btn-primary btn-full-width"
      onClick={() => onRegister(event)}
      disabled={isEventFull(event)}
    >
      {isEventFull(event) ? t('home.eventsFull') : t('home.eventsRegister')}
    </button>
  </div>
)

const PastEventCard = ({ event, projects, currentUser, t }) => (
  <div className="event-preview-card past-event">
    <EventBanner url={event.bannerUrl} />
    <div>
      <h4 className="event-preview-title">{event.title}</h4>
      <p className="event-preview-date">
        {event.date ? formatEventDate(event.date) : null}
      </p>
      <HostedBy event={event} projects={projects} t={t} />
      <EventLinkLine event={event} t={t} />
      {currentUser && event.attendees?.includes(currentUser.uid) && (
        <p className="event-attended">✅ {t('home.pastEventsAttended')}</p>
      )}
    </div>
  </div>
)

const AmenityPreviewCard = ({ amenity, onBook, onLightbox, t }) => (
  <div className="amenity-preview-card">
    {amenity.photos?.length > 0 ? (
      <button
        type="button"
        className="amenity-preview-photo amenity-photo-clickable"
        onClick={() => onLightbox(amenity)}
        aria-label={`View photos of ${amenity.name}`}
      >
        <img src={amenity.photos[0]} alt={amenity.name} />
        {amenity.photos.length > 1 && (
          <span className="amenity-photo-count-badge">{amenity.photos.length}</span>
        )}
      </button>
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
    <button className="btn btn-primary btn-full-width" onClick={() => onBook(amenity)}>
      📅 {t('common.bookNow')}
    </button>
  </div>
)

const PreviewSection = ({ id, title, loading, loadingLabel, emptyLabel, items, children }) => (
  <section id={id} className="preview-section">
    <div className="container">
      <div className="section-header">
        <h2 className="section-title">{title}</h2>
      </div>
      {loading ? (
        <p className="loading-text">{loadingLabel}</p>
      ) : items.length > 0 ? (
        children
      ) : (
        <p className="empty-state">{emptyLabel}</p>
      )}
    </div>
  </section>
)

const Home = () => {
  const { t } = useTranslation()
  const { currentUser, isAdmin } = useAuth()
  const navigate = useNavigate()
  const [authPromptOpen, setAuthPromptOpen] = useState(false)
  const [selectedAmenity, setSelectedAmenity] = useState(null)
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [lightboxAmenity, setLightboxAmenity] = useState(null)

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

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: getProjects
  })

  const handleBookAmenity = (amenity) => {
    if (!currentUser) {
      setSelectedAmenity(amenity)
      setAuthPromptOpen(true)
      return
    }
    navigate(amenityMemberPath(amenity))
  }

  const handleRegisterEvent = (event) => {
    if (!currentUser) {
      setSelectedEvent(event)
      setAuthPromptOpen(true)
      return
    }
    navigate(`/member/events?action=register&eventId=${event.id}`)
  }

  const handleAuthRedirect = (signup) => {
    if (selectedAmenity) {
      navigate(amenityAuthPath(selectedAmenity, signup))
      return
    }
    if (selectedEvent) {
      navigate(loginPath(signup, '/member/events', {
        eventId: selectedEvent.id,
        action: 'register'
      }))
      return
    }
    navigate(signup ? '/login?signup=true' : '/login')
  }

  const availableAmenities = amenities.filter(a => a.isAvailable !== false)
  const now = new Date()
  const upcomingEvents = events.filter(e => e.date && asDate(e.date) > now)
  const pastEvents = approvedEvents.filter(e => e.date && asDate(e.date) <= now)

  return (
    <Layout public>
      <div className="home-container">
        <section id="hero" className="hero-section">
          <HeroWallpaper />
          <div className="hero-content">
            <h1 className="hero-title">
              <span className="gradient-text">Da Nang Blockchain Hub</span> {t('home.heroPortalLabel')}
            </h1>
            <p className="hero-subtitle">{t('home.heroSubtitle')}</p>
            <HeroCta currentUser={currentUser} isAdmin={isAdmin} t={t} />
          </div>
        </section>

        <div className="home-content-body">
          <PreviewSection
            id="amenities"
            title={t('home.amenitiesTitle')}
            loading={amenitiesLoading}
            loadingLabel={t('home.amenitiesLoading')}
            emptyLabel={t('home.amenitiesEmpty')}
            items={availableAmenities}
          >
            <div className="amenities-preview-grid">
              {availableAmenities.map(amenity => (
                <AmenityPreviewCard
                  key={amenity.id}
                  amenity={amenity}
                  onBook={handleBookAmenity}
                  onLightbox={setLightboxAmenity}
                  t={t}
                />
              ))}
            </div>
          </PreviewSection>

          <PreviewSection
            id="events"
            title={t('home.eventsTitle')}
            loading={eventsLoading}
            loadingLabel={t('home.eventsLoading')}
            emptyLabel={t('home.eventsEmpty')}
            items={upcomingEvents}
          >
            <div className="events-preview-grid">
              {upcomingEvents.map(event => (
                <EventPreviewCard
                  key={event.id}
                  event={event}
                  projects={projects}
                  onRegister={handleRegisterEvent}
                  t={t}
                />
              ))}
            </div>
          </PreviewSection>

          {pastEvents.length > 0 && (
            <section id="past-events" className="preview-section">
              <div className="container">
                <div className="section-header">
                  <h2 className="section-title">{t('home.pastEventsTitle')}</h2>
                </div>
                <div className="events-preview-grid">
                  {pastEvents.map(event => (
                    <PastEventCard
                      key={event.id}
                      event={event}
                      projects={projects}
                      currentUser={currentUser}
                      t={t}
                    />
                  ))}
                </div>
              </div>
            </section>
          )}

          {!currentUser && (
            <section className="cta-section">
              <div className="container">
                <div className="cta-content">
                  <h2 className="cta-title">{t('common.readyToGetStarted')}</h2>
                  <p className="cta-description">{t('common.signUpCta')}</p>
                  <Link to="/login?signup=true" className="btn btn-primary btn-large">
                    {t('common.ctaPrimary')}
                  </Link>
                </div>
              </div>
            </section>
          )}
        </div>

        <AuthPrompt
          isOpen={authPromptOpen}
          onClose={() => {
            setAuthPromptOpen(false)
            setSelectedAmenity(null)
            setSelectedEvent(null)
          }}
          action={selectedAmenity ? 'book' : 'register'}
          onLogin={() => handleAuthRedirect(false)}
          onSignUp={() => handleAuthRedirect(true)}
        />

        <AmenityPhotoLightbox
          isOpen={!!lightboxAmenity}
          onClose={() => setLightboxAmenity(null)}
          photos={lightboxAmenity?.photos || []}
          alt={lightboxAmenity?.name || ''}
        />
      </div>
    </Layout>
  )
}

export default Home
