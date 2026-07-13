import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import Layout from '../../components/Layout'
import Modal from '../../components/Modal'
import Avatar from '../../components/Avatar'
import {
  getApprovedEvents,
  getUpcomingEvents,
  getMyEvents,
  createEvent,
  deleteEvent,
  registerForEvent,
  unregisterFromEvent,
  addToWaitlist,
  removeFromWaitlist
} from '../../services/events'
import { getMember } from '../../services/members'
import { getAmenities, validateEventSpaceTime } from '../../services/amenities'
import { getProjects } from '../../services/projects'
import { uploadEventBanner } from '../../services/storage'
import { showToast } from '../../utils/toast'
import { parseHubDateTime, formatEventDate, formatEventTime } from '../../utils/timezone'
import { useTranslation } from 'react-i18next'
import './Events.css'
import './Profile.css'

const MAX_EVENT_CAPACITY = 50

const getStatusBadge = (status) => {
  const statusClasses = {
    pending: 'status-badge pending',
    approved: 'status-badge approved',
    rejected: 'status-badge rejected'
  }
  return statusClasses[status] || 'status-badge'
}

const isEventRegistered = (event, uid) => {
  return event.attendees?.includes(uid) || false
}

const isEventFull = (event) => {
  return event.capacity && event.attendees?.length >= event.capacity
}

const isOnEventWaitlist = (event, uid) => {
  return event.waitlist?.includes(uid) || false
}

const getEventWaitlistPosition = (event, uid) => {
  if (!event.waitlist || !isOnEventWaitlist(event, uid)) return null
  return event.waitlist.indexOf(uid) + 1
}

// Filter upcoming events by date (approved and pending)
const filterUpcomingEvents = (events) => events.filter(e => {
  if (!e.date) return false
  const eventDate = e.date instanceof Date ? e.date : new Date(e.date)
  const now = new Date()
  return eventDate > now
})

// Past events (only approved ones for historical record)
const filterPastEvents = (events) => events.filter(e => {
  if (!e.date) return false
  const eventDate = e.date instanceof Date ? e.date : new Date(e.date)
  const now = new Date()
  return eventDate <= now
})

const getHostNames = (hostingProjects, projects) => {
  if (typeof hostingProjects === 'string') return hostingProjects
  return hostingProjects.map(projectId => {
    const project = projects.find(p => p.id === projectId)
    return project?.name || projectId
  }).join(', ')
}

const clearActionParams = (searchParams, setSearchParams) => {
  const newParams = new URLSearchParams(searchParams)
  newParams.delete('action')
  newParams.delete('eventId')
  setSearchParams(newParams, { replace: true })
}

const clampCapacity = (rawValue) => {
  const rawCapacity = parseInt(rawValue, 10)
  return Number.isNaN(rawCapacity)
    ? MAX_EVENT_CAPACITY
    : Math.min(Math.max(rawCapacity, 1), MAX_EVENT_CAPACITY)
}

const applyOptionalEventFields = (data, formData, linkAmenity) => {
  // Handle hosting projects (text input)
  const hostingProjects = formData.get('hostingProjects')
  if (hostingProjects && hostingProjects.trim()) {
    data.hostingProjects = hostingProjects.trim()
  }

  // Optional event link
  const eventLink = formData.get('eventLink')
  if (eventLink && eventLink.trim()) {
    data.eventLink = eventLink.trim()
  }

  // Handle optional amenity linking request
  const linkedAmenityId = formData.get('linkedAmenityId')
  if (linkAmenity && linkedAmenityId) {
    data.requestedAmenityId = linkedAmenityId
    data.amenityNote = formData.get('amenityNote') || ''
  }
}

const buildEventData = ({ formData, eventDate, currentUser, userProfile, bannerUrl, linkAmenity }) => {
  const data = {
    title: formData.get('title'),
    description: formData.get('description'),
    date: eventDate.toISOString(),
    capacity: clampCapacity(formData.get('capacity')),
    duration: parseInt(formData.get('duration')) || 60, // Duration in minutes
    organizerId: currentUser.uid,
    // Denormalize organizer fields from the in-memory profile so createEvent
    // doesn't need a Firestore round-trip to look the member up.
    organizerDisplayName: userProfile?.displayName ?? currentUser.displayName ?? null,
    organizerPhotoURL: userProfile?.photoURL ?? currentUser.photoURL ?? null,
    status: 'pending',
    waitlist: [],
    bannerUrl
  }
  applyOptionalEventFields(data, formData, linkAmenity)
  return data
}

// Try to find event in loaded data; flag as missing when data is loaded but
// the event doesn't exist.
const resolveRedirectEvent = (eventId, upcomingEventsData, approvedEvents) => {
  const event = upcomingEventsData.find(e => e.id === eventId) || approvedEvents.find(e => e.id === eventId)
  const missing = !event && (upcomingEventsData.length > 0 || approvedEvents.length > 0)
  return { event, missing }
}

const runRedirectAction = (action, event, ctx) => {
  const { currentUser, t, searchParams, setSearchParams, processedActionRef } = ctx
  const payload = { eventId: event.id, memberId: currentUser.uid }
  if (action === 'register') {
    // Only register if not already registered
    if (!event.attendees?.includes(currentUser.uid)) {
      ctx.registerMutation.mutate(payload)
    } else {
      showToast(t('toast.alreadyRegistered'), 'info')
      clearActionParams(searchParams, setSearchParams)
    }
    return
  }
  if (action === 'unregister') {
    if (window.confirm(t('memberEvents.confirmUnregister'))) {
      ctx.unregisterMutation.mutate(payload)
    } else {
      // User cancelled, reset ref and remove params
      processedActionRef.current = null
      clearActionParams(searchParams, setSearchParams)
    }
    return
  }
  if (action === 'joinWaitlist') {
    if (!event.waitlist?.includes(currentUser.uid)) {
      ctx.waitlistMutation.mutate(payload)
    } else {
      showToast(t('toast.alreadyOnWaitlist'), 'info')
      clearActionParams(searchParams, setSearchParams)
    }
    return
  }
  if (action === 'leaveWaitlist') {
    ctx.removeWaitlistMutation.mutate(payload)
    return
  }
  // Unknown action, remove params
  clearActionParams(searchParams, setSearchParams)
}

const useEventsQueries = (currentUser) => {
  // Fetch upcoming events (approved and pending)
  const { data: upcomingEventsData = [], isLoading: isLoadingEvents, error: eventsError } = useQuery({
    queryKey: ['upcomingEvents'],
    queryFn: getUpcomingEvents,
    refetchOnWindowFocus: true,
    refetchOnMount: true
  })

  // Also keep approved events for registration logic
  const { data: approvedEvents = [] } = useQuery({
    queryKey: ['approvedEvents'],
    queryFn: getApprovedEvents
  })

  // Fetch my created events (all statuses)
  const { data: myEvents = [] } = useQuery({
    queryKey: ['myEvents', currentUser?.uid],
    queryFn: () => getMyEvents(currentUser?.uid),
    enabled: !!currentUser?.uid
  })

  const { data: amenities = [] } = useQuery({
    queryKey: ['amenities'],
    queryFn: getAmenities
  })

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: getProjects
  })

  if (eventsError) {
    console.error('Error loading upcoming events:', eventsError)
  }

  return { upcomingEventsData, isLoadingEvents, eventsError, approvedEvents, myEvents, amenities, projects }
}

const useEventFormMutations = ({ t, queryClient, setIsModalOpen, setIsSubmitting }) => {
  const createMutation = useMutation({
    mutationFn: createEvent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myEvents'] })
      queryClient.invalidateQueries({ queryKey: ['approvedEvents'] })
      queryClient.invalidateQueries({ queryKey: ['pendingEvents'] })
      queryClient.invalidateQueries({ queryKey: ['upcomingEvents'] })
      setIsModalOpen(false)
      setIsSubmitting(false)
      showToast(t('toast.eventSubmittedForApproval'), 'success')
    },
    onError: () => {
      setIsSubmitting(false)
      showToast(t('toast.eventCreateFailed'), 'error')
    }
  })

  const deleteMutation = useMutation({
    mutationFn: deleteEvent,
    onSuccess: () => {
      queryClient.invalidateQueries(['myEvents'])
      showToast(t('toast.eventRequestDeleted'), 'success')
    },
    onError: () => {
      showToast(t('toast.eventCreateFailed'), 'error')
    }
  })

  return { createMutation, deleteMutation }
}

const useEventActionMutations = ({ t, queryClient, currentUser, processedActionRef, searchParams, setSearchParams }) => {
  // Reset ref and clean up query params after a processed action settles
  const resetActionState = () => {
    processedActionRef.current = null
    clearActionParams(searchParams, setSearchParams)
  }

  const registerMutation = useMutation({
    mutationFn: ({ eventId, memberId }) => registerForEvent(eventId, memberId),
    onSuccess: () => {
      queryClient.invalidateQueries(['approvedEvents'])
      queryClient.invalidateQueries(['upcomingEvents'])
      queryClient.invalidateQueries(['myEvents'])
      showToast(t('toast.eventRegisterSuccess'), 'success')
      resetActionState()
    },
    onError: (error) => {
      console.error('Registration error:', error)
      showToast(t('toast.eventRegisterFailed'), 'error')
      resetActionState()
    }
  })

  const unregisterMutation = useMutation({
    mutationFn: ({ eventId, memberId }) => unregisterFromEvent(eventId, memberId),
    onSuccess: () => {
      queryClient.invalidateQueries(['approvedEvents'])
      queryClient.invalidateQueries(['upcomingEvents'])
      queryClient.invalidateQueries(['myEvents'])
      showToast(t('toast.eventUnregisterSuccess'), 'success')
      resetActionState()
    },
    onError: () => {
      showToast(t('toast.eventUnregisterFailed'), 'error')
      resetActionState()
    }
  })

  const waitlistMutation = useMutation({
    mutationFn: ({ eventId, memberId }) => addToWaitlist(eventId, memberId),
    onSuccess: () => {
      queryClient.invalidateQueries(['approvedEvents'])
      queryClient.invalidateQueries(['upcomingEvents'])
      showToast(t('toast.waitlistJoined'), 'info')
      resetActionState()
    },
    onError: () => {
      showToast(t('toast.waitlistJoinFailed'), 'error')
      resetActionState()
    }
  })

  const removeWaitlistMutation = useMutation({
    mutationFn: ({ eventId, memberId }) => removeFromWaitlist(eventId, memberId),
    onSuccess: () => {
      queryClient.invalidateQueries(['approvedEvents'])
      queryClient.invalidateQueries(['upcomingEvents'])
      showToast(t('toast.waitlistRemoved'), 'info')
      resetActionState()
    },
    onError: () => {
      showToast(t('toast.waitlistRemoveFailed'), 'error')
      resetActionState()
    }
  })

  const handleRegister = async (eventId) => {
    await registerMutation.mutateAsync({ eventId, memberId: currentUser.uid })
  }

  const handleUnregister = async (eventId) => {
    if (window.confirm(t('memberEvents.confirmUnregister'))) {
      await unregisterMutation.mutateAsync({ eventId, memberId: currentUser.uid })
    }
  }

  const handleJoinWaitlist = async (eventId) => {
    await waitlistMutation.mutateAsync({ eventId, memberId: currentUser.uid })
  }

  const handleLeaveWaitlist = async (eventId) => {
    await removeWaitlistMutation.mutateAsync({ eventId, memberId: currentUser.uid })
  }

  return {
    registerMutation,
    unregisterMutation,
    waitlistMutation,
    removeWaitlistMutation,
    handleRegister,
    handleUnregister,
    handleJoinWaitlist,
    handleLeaveWaitlist
  }
}

const EventBanner = ({ url }) => {
  if (!url) return null
  return (
    <div className="event-card-banner">
      <img src={url} alt="" loading="lazy" decoding="async" />
    </div>
  )
}

const EventDurationLine = ({ duration, t }) => {
  if (!duration) return null
  return (
    <p className="event-duration">⏱️ {t('memberEvents.duration', { minutes: duration })}</p>
  )
}

const HostedProjectsLine = ({ hostingProjects, projects, t }) => {
  if (!hostingProjects) return null
  return (
    <p className="event-projects">
      🏢 {t('memberEvents.hosted', { hosts: getHostNames(hostingProjects, projects) })}
    </p>
  )
}

const EventLinkLine = ({ eventLink, t }) => {
  if (!eventLink) return null
  return (
    <p className="event-link">
      🔗 <a href={eventLink} target="_blank" rel="noopener noreferrer">{t('memberEvents.eventLink')}</a>
    </p>
  )
}

const MyEventCard = ({ event, projects, onDelete, t }) => (
  <div className={`event-card my-event ${event.status}`}>
    <EventBanner url={event.bannerUrl} />
    <div className="event-header">
      <h3 className="event-title">{event.title}</h3>
      <span className={getStatusBadge(event.status)}>
        {event.status}
      </span>
    </div>
    <div className="event-info">
      <p className="event-date">
        📅 {formatEventDate(event.date)} at {formatEventTime(event.date)}
      </p>
      <EventDurationLine duration={event.duration} t={t} />
      <p className="event-capacity">
        👥 {t('memberEvents.capacity', { count: event.capacity || 80 })}
      </p>
      <HostedProjectsLine hostingProjects={event.hostingProjects} projects={projects} t={t} />
      <EventLinkLine eventLink={event.eventLink} t={t} />
      {event.status === 'rejected' && (
        <p className="event-rejection-reason">
          ❌ {event.rejectionReason
            ? t('memberEvents.reason', { reason: event.rejectionReason })
            : t('memberEvents.noReasonProvided')}
        </p>
      )}
      {event.description && (
        <p className="event-description">{event.description}</p>
      )}
    </div>
    <div className="event-actions">
      {event.status === 'pending' && (
        <button
          className="btn btn-danger btn-full-width"
          onClick={() => onDelete(event.id)}
        >
          {t('memberEvents.cancelRequest')}
        </button>
      )}
      {event.status === 'approved' && (
        <p className="event-approved-note">{t('memberEvents.eventLive')}</p>
      )}
    </div>
  </div>
)

const MyEventsSection = ({ myEvents, projects, onDelete, t }) => {
  if (myEvents.length === 0) return null
  return (
    <div className="events-section glass">
      <div className="section-header">
        <h2 className="section-title">{t('memberEvents.myEventRequests')}</h2>
        <p className="section-description">{t('memberEvents.myEventRequestsDesc')}</p>
      </div>
      <div className="events-grid">
        {myEvents.map(event => (
          <MyEventCard key={event.id} event={event} projects={projects} onDelete={onDelete} t={t} />
        ))}
      </div>
    </div>
  )
}

const UpcomingEventInfo = ({ event, projects, isMyEvent, waitlistPosition, onOpenHost, t }) => (
  <div className="event-info">
    <p className="event-organizer">
      Organizer:{' '}
      <button
        className="organizer-link"
        onClick={() => onOpenHost(event.organizerId)}
      >
        {event.organizerDisplayName || event.organizerId}
      </button>
      {isMyEvent && <span className="my-event-tag"> {t('memberEvents.organizerYou')}</span>}
    </p>
    <EventDurationLine duration={event.duration} t={t} />
    <p className="event-capacity">
      👥 {t('memberEvents.attendees', { current: event.attendees?.length || 0, total: event.capacity || 80 })}
    </p>
    <HostedProjectsLine hostingProjects={event.hostingProjects} projects={projects} t={t} />
    <EventLinkLine eventLink={event.eventLink} t={t} />
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

const UpcomingEventActions = ({ event, registered, onWaitlist, full, handlers, t }) => (
  <div className="event-actions">
    {registered ? (
      <button
        className="btn btn-secondary btn-full-width"
        onClick={() => handlers.onUnregister(event.id)}
      >
        {t('memberEvents.registeredUnregister')}
      </button>
    ) : onWaitlist ? (
      <button
        className="btn btn-secondary btn-full-width"
        onClick={() => handlers.onLeaveWaitlist(event.id)}
      >
        {t('memberEvents.onWaitlistLeave')}
      </button>
    ) : (
      <>
        <button
          className="btn btn-primary btn-full-width btn-large"
          onClick={() => handlers.onRegister(event.id)}
          disabled={full}
        >
          {full ? t('memberEvents.eventFull') : t('memberEvents.registerForEvent')}
        </button>
        {full && (
          <button
            className="btn btn-secondary btn-full-width"
            onClick={() => handlers.onJoinWaitlist(event.id)}
            style={{ marginTop: '0.5rem' }}
          >
            {t('memberEvents.joinWaitlist')}
          </button>
        )}
      </>
    )}
  </div>
)

const UpcomingEventCard = ({ event, projects, currentUserId, onOpenHost, handlers, t }) => {
  const registered = isEventRegistered(event, currentUserId)
  const full = isEventFull(event)
  const onWaitlist = isOnEventWaitlist(event, currentUserId)
  const waitlistPosition = getEventWaitlistPosition(event, currentUserId)
  const isMyEvent = event.organizerId === currentUserId
  return (
    <div className={`event-card ${isMyEvent ? 'my-event-approved' : ''}`}>
      <EventBanner url={event.bannerUrl} />
      <div className="event-header">
        <h3 className="event-title">{event.title}</h3>
        <span className="event-date-badge">
          {formatEventDate(event.date) || 'N/A'}
        </span>
      </div>
      <UpcomingEventInfo
        event={event}
        projects={projects}
        isMyEvent={isMyEvent}
        waitlistPosition={waitlistPosition}
        onOpenHost={onOpenHost}
        t={t}
      />
      <UpcomingEventActions
        event={event}
        registered={registered}
        onWaitlist={onWaitlist}
        full={full}
        handlers={handlers}
        t={t}
      />
    </div>
  )
}

const UpcomingEventsSection = ({ isLoadingEvents, eventsError, upcomingEvents, approvedEvents, currentUserId, projects, onOpenHost, handlers, t }) => (
  <div className="events-section glass">
    <div className="section-header">
      <h2 className="section-title">{t('memberEvents.upcomingEvents')}</h2>
      {upcomingEvents.length > 0 && (
        <p className="section-description">{t('memberEvents.upcomingEventsDesc')}</p>
      )}
    </div>
    {isLoadingEvents ? (
      <p className="empty-state">{t('memberEvents.loadingEvents')}</p>
    ) : eventsError ? (
      <p className="empty-state" style={{ color: '#ef4444' }}>
        {t('memberEvents.errorLoadingEvents')}
        {import.meta.env.DEV && (
          <div style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>
            {eventsError.message}
          </div>
        )}
      </p>
    ) : upcomingEvents.length > 0 ? (
      <div className="events-grid">
        {upcomingEvents.map(event => (
          <UpcomingEventCard
            key={event.id}
            event={event}
            projects={projects}
            currentUserId={currentUserId}
            onOpenHost={onOpenHost}
            handlers={handlers}
            t={t}
          />
        ))}
      </div>
    ) : (
      <div>
        <p className="empty-state">{t('memberEvents.noUpcomingEvents')}</p>
        {approvedEvents.length > 0 && (
          <p className="empty-state" style={{ fontSize: '0.875rem', marginTop: '0.5rem', color: '#a1a1aa' }}>
            {t('memberEvents.approvedButNoneUpcoming', { count: approvedEvents.length })}
          </p>
        )}
      </div>
    )}
  </div>
)

const PastEventCard = ({ event, projects, currentUserId, onOpenHost, t }) => {
  const registered = isEventRegistered(event, currentUserId)
  return (
    <div className="event-card past-event">
      <EventBanner url={event.bannerUrl} />
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
            onClick={() => onOpenHost(event.organizerId)}
          >
            {event.organizerDisplayName || event.organizerId}
          </button>
        </p>
        <EventDurationLine duration={event.duration} t={t} />
        <HostedProjectsLine hostingProjects={event.hostingProjects} projects={projects} t={t} />
        <EventLinkLine eventLink={event.eventLink} t={t} />
        {registered && (
          <p className="event-attended">{t('memberEvents.attended')}</p>
        )}
      </div>
    </div>
  )
}

const PastEventsSection = ({ pastEvents, projects, currentUserId, onOpenHost, t }) => (
  <div className="events-section glass">
    <div className="section-header">
      <h2 className="section-title">{t('memberEvents.pastEvents')}</h2>
    </div>
    {pastEvents.length > 0 ? (
      <div className="events-grid">
        {pastEvents.map(event => (
          <PastEventCard
            key={event.id}
            event={event}
            projects={projects}
            currentUserId={currentUserId}
            onOpenHost={onOpenHost}
            t={t}
          />
        ))}
      </div>
    ) : (
      <p className="empty-state">{t('memberEvents.noPastEvents')}</p>
    )}
  </div>
)

const HostProfileHeader = ({ member }) => (
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
        {member.membershipType === 'admin' ? 'Admin' : 'Member'}
      </span>
    </div>
  </div>
)

const HostProfessionalSection = ({ member }) => (
  <section className="profile-section">
    <h3 className="profile-section-title">Professional</h3>
    <div className="profile-detail-item">
      <span className="detail-label">Company</span>
      <span className="detail-value">{member.company || '—'}</span>
    </div>
    <div className="profile-detail-item">
      <span className="detail-label">Role</span>
      <span className="detail-value">{member.jobTitle || '—'}</span>
    </div>
    {member.linkedIn && (
      <div className="profile-detail-item">
        <span className="detail-label">LinkedIn</span>
        <span className="detail-value">
          <a href={member.linkedIn} target="_blank" rel="noopener noreferrer" className="profile-link">
            {member.linkedIn}
          </a>
        </span>
      </div>
    )}
    {member.website && (
      <div className="profile-detail-item">
        <span className="detail-label">Website</span>
        <span className="detail-value">
          <a href={member.website} target="_blank" rel="noopener noreferrer" className="profile-link">
            {member.website}
          </a>
        </span>
      </div>
    )}
  </section>
)

const HostContactSection = ({ member }) => (
  <section className="profile-section">
    <h3 className="profile-section-title">Contact</h3>
    {member.email && (
      <div className="profile-detail-item">
        <span className="detail-label">Email</span>
        <span className="detail-value">
          <a href={`mailto:${member.email}`} className="profile-link">
            {member.email}
          </a>
        </span>
      </div>
    )}
    {member.phone && (
      <div className="profile-detail-item">
        <span className="detail-label">Phone</span>
        <span className="detail-value">
          <a href={`tel:${member.phone}`} className="profile-link">
            {member.phone}
          </a>
        </span>
      </div>
    )}
    {!member.email && !member.phone && (
      <div className="profile-detail-item">
        <span className="detail-value">—</span>
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
        <HostProfileHeader member={member} />
        <HostProfessionalSection member={member} />
        <HostContactSection member={member} />
        <section className="profile-section">
          <h3 className="profile-section-title">About</h3>
          <div className="profile-detail-item profile-detail-bio">
            <span className="detail-value">{member.bio || '—'}</span>
          </div>
        </section>
      </div>
    )}
  </Modal>
)

const MemberEvents = () => {
  const { t } = useTranslation()
  const { currentUser, userProfile } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [hostModalMember, setHostModalMember] = useState(null)
  const [hasAcceptedGuidelines, setHasAcceptedGuidelines] = useState(false)
  const [linkAmenity, setLinkAmenity] = useState(true)
  const [prefillAmenityId, setPrefillAmenityId] = useState(null)
  const [dateError, setDateError] = useState(null)
  const [eventDuration, setEventDuration] = useState(60)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const processedActionRef = useRef(null)
  const bannerInputRef = useRef(null)

  const validateEventHallDate = (dateValue, durationMinutes = eventDuration) => {
    if (!linkAmenity || !dateValue) {
      setDateError(null)
      return true
    }
    const errorKey = validateEventSpaceTime(dateValue, durationMinutes)
    if (errorKey) {
      setDateError(t(errorKey))
      return false
    }
    setDateError(null)
    return true
  }

  const {
    upcomingEventsData,
    isLoadingEvents,
    eventsError,
    approvedEvents,
    myEvents,
    amenities,
    projects
  } = useEventsQueries(currentUser)

  const { createMutation, deleteMutation } = useEventFormMutations({ t, queryClient, setIsModalOpen, setIsSubmitting })

  const {
    registerMutation,
    unregisterMutation,
    waitlistMutation,
    removeWaitlistMutation,
    handleRegister,
    handleUnregister,
    handleJoinWaitlist,
    handleLeaveWaitlist
  } = useEventActionMutations({ t, queryClient, currentUser, processedActionRef, searchParams, setSearchParams })

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (isSubmitting) return
    setIsSubmitting(true)
    const formData = new FormData(e.target)
    const eventDate = parseHubDateTime(formData.get('date'))
    const linkedAmenityId = formData.get('linkedAmenityId')

    if (linkAmenity && linkedAmenityId) {
      const duration = parseInt(formData.get('duration')) || 60
      if (!validateEventHallDate(formData.get('date'), duration)) {
        setIsSubmitting(false)
        return
      }
    }

    const bannerFile = bannerInputRef.current?.files?.[0]
    if (!bannerFile) {
      showToast(t('toast.eventBannerRequired'), 'error')
      setIsSubmitting(false)
      return
    }
    let bannerUrl
    try {
      bannerUrl = await uploadEventBanner(bannerFile)
    } catch (err) {
      showToast(err.message || t('toast.eventBannerUploadFailed'), 'error')
      setIsSubmitting(false)
      return
    }

    createMutation.mutate(buildEventData({ formData, eventDate, currentUser, userProfile, bannerUrl, linkAmenity }))
  }

  const handleOpenCreateModal = () => {
    const eventSpaceAmenities = amenities.filter(a => a.isAvailable !== false && a.type === 'event-space')
    const defaultAmenity = eventSpaceAmenities.find(a => /event hall|event space|main hall/i.test(a.name)) || eventSpaceAmenities[0]
    setLinkAmenity(true)
    setPrefillAmenityId(defaultAmenity?.id || null)
    setIsModalOpen(true)
  }

  const handleDeleteMyEvent = async (eventId) => {
    if (window.confirm(t('memberEvents.confirmDelete'))) {
      await deleteMutation.mutateAsync(eventId)
    }
  }

  // On-demand fetch for the host modal. Avoids the bulk-members fetch by only
  // hitting Firestore when the user actually clicks an organizer name.
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

  // Handle action=create with amenityId (from Event Hall Book Now)
  useEffect(() => {
    const action = searchParams.get('action')
    const amenityId = searchParams.get('amenityId')
    if (action === 'create' && amenityId && currentUser) {
      setLinkAmenity(true)
      setPrefillAmenityId(amenityId)
      setIsModalOpen(true)
      const newParams = new URLSearchParams(searchParams)
      newParams.delete('action')
      newParams.delete('amenityId')
      setSearchParams(newParams, { replace: true })
    }
  }, [searchParams, currentUser, setSearchParams])

  // Handle redirect actions from public Events page or Home page
  useEffect(() => {
    const action = searchParams.get('action')
    const eventId = searchParams.get('eventId')

    // Skip if no action/eventId or no user (or if action is 'create' - handled above)
    if (!action || !eventId || !currentUser || action === 'create') {
      processedActionRef.current = null
      return
    }

    // Prevent duplicate processing of the same action
    const actionKey = `${action}-${eventId}`
    if (processedActionRef.current === actionKey) {
      return
    }

    // Wait for data to be loaded - don't proceed if still loading
    if (isLoadingEvents) return

    const { event, missing } = resolveRedirectEvent(eventId, upcomingEventsData, approvedEvents)

    // If event not found and we have data loaded, event doesn't exist
    if (missing) {
      processedActionRef.current = actionKey
      showToast(t('toast.eventNotFound'), 'error')
      clearActionParams(searchParams, setSearchParams)
      return
    }

    // If event not found yet, wait for more data
    if (!event) return

    // Mark as processed to prevent duplicate calls
    processedActionRef.current = actionKey

    // Process the action
    runRedirectAction(action, event, {
      currentUser,
      t,
      searchParams,
      setSearchParams,
      processedActionRef,
      registerMutation,
      unregisterMutation,
      waitlistMutation,
      removeWaitlistMutation
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.toString(), currentUser?.uid, isLoadingEvents, upcomingEventsData.length, approvedEvents.length])

  const upcomingEvents = filterUpcomingEvents(upcomingEventsData)
  const pastEvents = filterPastEvents(approvedEvents)

  return (
    <Layout>
      <div className="container">
        <div className="page-header">
          <div className="page-header-content">
            <h1 className="page-title">{t('memberEvents.title')}</h1>
            <p className="page-subtitle">{t('memberEvents.subtitle')}</p>
          </div>
          <button className="btn btn-primary" onClick={handleOpenCreateModal}>
            {t('memberEvents.createEvent')}
          </button>
        </div>

        {/* My Created Events */}
        <MyEventsSection myEvents={myEvents} projects={projects} onDelete={handleDeleteMyEvent} t={t} />

        {/* Upcoming Events (Approved) */}
        <UpcomingEventsSection
          isLoadingEvents={isLoadingEvents}
          eventsError={eventsError}
          upcomingEvents={upcomingEvents}
          approvedEvents={approvedEvents}
          currentUserId={currentUser?.uid}
          projects={projects}
          onOpenHost={handleOpenHostModal}
          handlers={{
            onRegister: handleRegister,
            onUnregister: handleUnregister,
            onJoinWaitlist: handleJoinWaitlist,
            onLeaveWaitlist: handleLeaveWaitlist
          }}
          t={t}
        />

        {/* Past Events */}
        <PastEventsSection
          pastEvents={pastEvents}
          projects={projects}
          currentUserId={currentUser?.uid}
          onOpenHost={handleOpenHostModal}
          t={t}
        />

        {/* Create Event Modal */}
        <Modal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false)
            setHasAcceptedGuidelines(false)
            setLinkAmenity(false)
            setPrefillAmenityId(null)
            setDateError(null)
            setEventDuration(60)
            if (bannerInputRef.current) bannerInputRef.current.value = ''
          }}
          title={t('memberEvents.modal.title')}
        >
          <p className="modal-description">
            {t('memberEvents.modal.description')}
          </p>
          <form onSubmit={handleSubmit}>
            <div className="form-group event-guidelines-ack">
              <label className="form-checkbox">
                <input
                  type="checkbox"
                  checked={hasAcceptedGuidelines}
                  onChange={(e) => setHasAcceptedGuidelines(e.target.checked)}
                />
                <span>
                  {t('memberEvents.modal.guidelinesPrefix')}{' '}
                  <a
                    href="https://www.danangblockchainhub.com/event-guidelines.html"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {t('memberEvents.modal.guidelinesLink')}
                  </a>
                  .
                </span>
              </label>
              <small className="form-hint">
                {t('memberEvents.modal.guidelinesHint')}
              </small>
            </div>
            <fieldset className="event-create-fieldset" disabled={!hasAcceptedGuidelines}>
              <div className="form-group">
                <label className="form-label">
                  {t('memberEvents.modal.titleLabel')}
                </label>
              <input
                type="text"
                name="title"
                className="form-field"
                placeholder={t('memberEvents.modal.titlePlaceholder')}
                required
              />
            </div>
            <div className="form-group">
                <label className="form-label">
                  {t('memberEvents.modal.descriptionLabel')}
                </label>
              <textarea
                name="description"
                className="form-field"
                placeholder={t('memberEvents.modal.descriptionPlaceholder')}
                rows="3"
                required
                aria-required
              />
            </div>
            <div className="form-group">
                <label className="form-label">
                  {t('memberEvents.modal.bannerLabel')}
                </label>
              <div className="event-banner-upload">
                <input
                  ref={bannerInputRef}
                  type="file"
                  name="banner"
                  id="member-event-banner-input"
                  className="event-banner-input"
                  accept="image/jpeg,image/jpg,image/png,image/webp"
                  required
                  aria-required
                />
                <span className="event-banner-upload-label">
                  {t('memberEvents.modal.bannerUploadLabel')}
                </span>
              </div>
              <small className="form-hint">
                {t('memberEvents.modal.bannerHint')}
              </small>
            </div>
            <div className="form-group">
              <label className="form-label">
                {t('memberEvents.modal.dateTimeLabel')}
              </label>
              <input
                type="datetime-local"
                name="date"
                className={`form-field ${dateError ? 'form-field-error' : ''}`}
                onChange={(e) => validateEventHallDate(e.target.value)}
                required
              />
              {linkAmenity && (
                <small className="form-hint">{t('memberEvents.modal.availabilityHint')}</small>
              )}
              {dateError && (
                <p className="form-error">{dateError}</p>
              )}
            </div>
            <div className="form-group">
              <label className="form-label">
                {t('memberEvents.modal.durationLabel')}
              </label>
              <input
                type="number"
                name="duration"
                className="form-field"
                placeholder={t('memberEvents.modal.durationPlaceholder')}
                value={eventDuration}
                onChange={(e) => {
                  const mins = parseInt(e.target.value) || 60
                  setEventDuration(mins)
                }}
                min="15"
                step="15"
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">
                {t('memberEvents.modal.capacityLabel')}
              </label>
              <input
                type="number"
                name="capacity"
                className="form-field"
                defaultValue={String(MAX_EVENT_CAPACITY)}
                min="1"
                max={MAX_EVENT_CAPACITY}
                required
              />
              <small className="form-hint">
                {t('memberEvents.modal.capacityHint', { max: MAX_EVENT_CAPACITY })}
              </small>
            </div>
            <div className="form-group">
              <label className="form-label">
                {t('memberEvents.modal.hostingProjectsLabel')}
              </label>
              <input
                type="text"
                name="hostingProjects"
                className="form-field"
                placeholder={t('memberEvents.modal.hostingProjectsPlaceholder')}
              />
              <small className="form-hint">
                {t('memberEvents.modal.hostingProjectsHint')}
              </small>
            </div>
            <div className="form-group">
              <label className="form-label">
                {t('memberEvents.modal.eventLinkLabel')}
              </label>
              <input
                type="url"
                name="eventLink"
                className="form-field"
                placeholder={t('memberEvents.modal.eventLinkPlaceholder')}
              />
              <small className="form-hint">
                {t('memberEvents.modal.eventLinkHint')}
              </small>
            </div>
            <div className="form-group">
              <label className="form-checkbox">
                <input
                  type="checkbox"
                  checked={true}
                  disabled
                  readOnly
                />
                <span>{t('memberEvents.modal.requestHallLabel')}</span>
              </label>
            </div>
            {linkAmenity && (() => {
              const eventSpaceAmenities = amenities.filter(a => a.isAvailable !== false && a.type === 'event-space')
              const defaultAmenity = prefillAmenityId
                ? eventSpaceAmenities.find(a => a.id === prefillAmenityId)
                : eventSpaceAmenities.find(a => /event hall|event space|main hall/i.test(a.name)) || eventSpaceAmenities[0]
              return (
              <>
                <div className="event-hall-notice">
                  <p>
                    <strong>{t('memberEvents.modal.hallRequirementsTitle')}</strong>
                  </p>
                  <ul>
                    <li>{t('memberEvents.modal.parkingFeeRequirement')}</li>
                  </ul>
                </div>
                <div className="form-group">
                  <label className="form-label">
                    {t('memberEvents.modal.preferredAmenityLabel')}
                  </label>
                  <select name="linkedAmenityId" className="form-field" defaultValue={defaultAmenity?.id ?? ''}>
                    <option value="">{t('memberEvents.modal.preferredAmenityPlaceholder')}</option>
                    {eventSpaceAmenities.map(amenity => (
                      <option key={amenity.id} value={amenity.id}>
                        {amenity.name} ({amenity.type})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">
                    {t('memberEvents.modal.additionalNotesLabel')}
                  </label>
                  <input
                    type="text"
                    name="amenityNote"
                    className="form-field"
                    placeholder={t('memberEvents.modal.additionalNotesPlaceholder')}
                  />
                </div>
              </>
              )
            })()}
            <div className="form-actions">
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isSubmitting || !!dateError}
              >
                {isSubmitting
                  ? t('memberEvents.modal.submitting')
                  : t('memberEvents.modal.submit')}
              </button>
            </div>
            </fieldset>
            <div className="form-actions form-actions-outside">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setIsModalOpen(false)
                }}
              >
                {t('common.close')}
              </button>
            </div>
          </form>
        </Modal>

        <HostProfileModal member={hostModalMember} onClose={() => setHostModalMember(null)} t={t} />
      </div>
    </Layout>
  )
}

export default MemberEvents
