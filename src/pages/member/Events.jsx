import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useInvalidateQueries } from '../../hooks/useInvalidateQueries'
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
import { editOwnEvent } from '../../services/functions'
import { showToast } from '../../utils/toast'
import { isPendingFor, pendingTargetId } from '../../utils/mutationTarget'
import { promptPushOptInAfterSuccess } from '../../utils/pushOptInPrompt'
import { parseHubDateTime, toDatetimeLocalHub, formatEventDate, formatEventTime } from '../../utils/timezone'
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

const isFutureEvent = (event) => new Date(event.date) > new Date()

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

const buildEditableEventData = ({ formData, eventDate, bannerUrl, linkAmenity }) => ({
  title: formData.get('title'),
  description: formData.get('description'),
  date: eventDate.toISOString(),
  capacity: clampCapacity(formData.get('capacity')),
  duration: parseInt(formData.get('duration'), 10) || 60,
  bannerUrl,
  hostingProjects: formData.get('hostingProjects') || '',
  eventLink: formData.get('eventLink') || '',
  requestedAmenityId: linkAmenity ? formData.get('linkedAmenityId') || '' : '',
  amenityNote: linkAmenity ? formData.get('amenityNote') || '' : ''
})

// Try to find event in loaded data; flag as missing when data is loaded but
// the event doesn't exist.
const resolveRedirectEvent = (eventId, upcomingEventsData, approvedEvents) => {
  const event = upcomingEventsData.find(e => e.id === eventId) || approvedEvents.find(e => e.id === eventId)
  const missing = !event && (upcomingEventsData.length > 0 || approvedEvents.length > 0)
  return { event, missing }
}

const runRedirectAction = (action, event, ctx) => {
  const { currentUser, t, searchParams, setSearchParams, processedActionRef } = ctx
  if (event.status !== 'approved') {
    showToast(t('toast.eventNotAvailable'), 'info')
    clearActionParams(searchParams, setSearchParams)
    return
  }
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
  // Live events only. Own pending/rejected requests use the separate myEvents
  // query below and never become registerable cards.
  // (fuzzy, exact: false) refreshes both. setQueryData is not fuzzy, so
  // patchEventInCaches must name this key in full. See EVENT_LIST_KEYS.
  const { data: upcomingEventsData = [], isLoading: isLoadingEvents, error: eventsError } = useQuery({
    queryKey: ['upcomingEvents'],
    queryFn: () => getUpcomingEvents(),
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

const useEventFormMutations = ({ t, setIsModalOpen, setIsSubmitting, uid, pushOptedIn }) => {
  const invalidate = useInvalidateQueries()
  const createMutation = useMutation({
    mutationFn: createEvent,
    onSuccess: () => {
      invalidate('myEvents', 'approvedEvents', 'pendingEvents', 'upcomingEvents')
      setIsModalOpen(false)
      setIsSubmitting(false)
      showToast(t('toast.eventSubmittedForApproval'), 'success')
      promptPushOptInAfterSuccess(uid, pushOptedIn)
    },
    onError: () => {
      setIsSubmitting(false)
      showToast(t('toast.eventCreateFailed'), 'error')
    }
  })

  const deleteMutation = useMutation({
    mutationFn: deleteEvent,
    onSuccess: () => {
      invalidate('myEvents', 'pendingEvents', 'upcomingEvents')
      showToast(t('toast.eventRequestDeleted'), 'success')
    },
    onError: () => {
      showToast(t('toast.eventCreateFailed'), 'error')
    }
  })

  const editMutation = useMutation({
    mutationFn: editOwnEvent,
    onSuccess: (result) => {
      invalidate('myEvents', 'approvedEvents', 'pendingEvents', 'upcomingEvents', 'bookings', 'notifications')
      setIsModalOpen(false)
      setIsSubmitting(false)
      showToast(t(result.resubmitted ? 'toast.eventResubmitted' : 'toast.eventUpdated'), 'success')
    },
    onError: (error) => {
      setIsSubmitting(false)
      showToast(getEventEditErrorMessage(error, t), 'error')
    }
  })

  return { createMutation, deleteMutation, editMutation }
}

// Caches holding the full event objects a register/waitlist click can change.
// Full key arrays, not prefixes: setQueryData matches the hashed key exactly,
// Stay in sync with the queryKey of every live list showing these events —
// currently useEventsQueries above and member/Dashboard.jsx.
const EVENT_LIST_KEYS = [['approvedEvents'], ['upcomingEvents']]

const withMember = (list, memberId) =>
  (list || []).includes(memberId) ? (list || []) : [...(list || []), memberId]

const withoutMember = (list, memberId) =>
  (list || []).filter(id => id !== memberId)

// Patch the one changed event in place rather than invalidating two queries
// that each re-download the whole approved-events set. `patch` receives the
// cached event and returns the fields to overwrite; new array/object
// references are required or React Query hands back an equal reference and
// nothing re-renders.
const patchEventInCaches = (queryClient, eventId, patch) => {
  EVENT_LIST_KEYS.forEach(key => {
    queryClient.setQueryData(key, events => {
      if (!Array.isArray(events)) return events
      let matched = false
      const next = events.map(event => {
        if (event.id !== eventId) return event
        matched = true
        return { ...event, ...patch(event) }
      })
      return matched ? next : events
    })
  })
}

const useEventActionMutations = ({
  t,
  currentUser,
  processedActionRef,
  searchParams,
  setSearchParams,
  pushOptedIn
}) => {
  const invalidate = useInvalidateQueries()
  // useInvalidateQueries deliberately exposes invalidation only, so the
  // client is taken separately rather than reached through the hook.
  const queryClient = useQueryClient()
  // Reset ref and clean up query params after a processed action settles
  const resetActionState = () => {
    processedActionRef.current = null
    clearActionParams(searchParams, setSearchParams)
  }

  const registerMutation = useMutation({
    mutationFn: ({ eventId, memberId }) => registerForEvent(eventId, memberId),
    // myEvents is not invalidated: getMyEvents filters organizerId == uid,
    // which registering never changes.
    onSuccess: (_data, { eventId, memberId }) => {
      patchEventInCaches(queryClient, eventId, event => ({
        attendees: withMember(event.attendees, memberId)
      }))
      invalidate('memberStats')
      showToast(t('toast.eventRegisterSuccess'), 'success')
      promptPushOptInAfterSuccess(currentUser?.uid, pushOptedIn)
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
    onSuccess: (_data, { eventId, memberId }) => {
      patchEventInCaches(queryClient, eventId, event => ({
        attendees: withoutMember(event.attendees, memberId)
      }))
      invalidate('memberStats')
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
    onSuccess: (_data, { eventId, memberId }) => {
      patchEventInCaches(queryClient, eventId, event => ({
        waitlist: withMember(event.waitlist, memberId)
      }))
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
    onSuccess: (_data, { eventId, memberId }) => {
      patchEventInCaches(queryClient, eventId, event => ({
        waitlist: withoutMember(event.waitlist, memberId)
      }))
      showToast(t('toast.waitlistRemoved'), 'info')
      resetActionState()
    },
    onError: () => {
      showToast(t('toast.waitlistRemoveFailed'), 'error')
      resetActionState()
    }
  })

  const handleRegister = async (eventId) => {
    if (isPendingFor(registerMutation, eventId)) return
    await registerMutation.mutateAsync({ eventId, memberId: currentUser.uid })
  }

  const handleUnregister = async (eventId) => {
    if (isPendingFor(unregisterMutation, eventId)) return
    if (window.confirm(t('memberEvents.confirmUnregister'))) {
      await unregisterMutation.mutateAsync({ eventId, memberId: currentUser.uid })
    }
  }

  const handleJoinWaitlist = async (eventId) => {
    if (isPendingFor(waitlistMutation, eventId)) return
    await waitlistMutation.mutateAsync({ eventId, memberId: currentUser.uid })
  }

  const handleLeaveWaitlist = async (eventId) => {
    if (isPendingFor(removeWaitlistMutation, eventId)) return
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

const MyEventCard = ({ event, projects, onDelete, onEdit, deletePending, t }) => (
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
      {isFutureEvent(event) && (
        <button className="btn btn-secondary btn-full-width" onClick={() => onEdit(event)}>
          {event.status === 'rejected' ? t('memberEvents.editResubmit') : t('common.edit')}
        </button>
      )}
      {event.status === 'pending' && !event.everApproved && (
        <button
          className="btn btn-danger btn-full-width"
          onClick={() => onDelete(event.id)}
          disabled={deletePending}
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

const MyEventsSection = ({ myEvents, projects, onDelete, onEdit, deletingId, t }) => {
  if (myEvents.length === 0) return null
  return (
    <div className="events-section glass">
      <div className="section-header">
        <h2 className="section-title">{t('memberEvents.myEventRequests')}</h2>
        <p className="section-description">{t('memberEvents.myEventRequestsDesc')}</p>
      </div>
      <div className="events-grid">
        {myEvents.map(event => (
          <MyEventCard
            key={event.id}
            event={event}
            projects={projects}
            onDelete={onDelete}
            onEdit={onEdit}
            deletePending={deletingId === event.id}
            t={t}
          />
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
        disabled={handlers.unregisteringId === event.id}
      >
        {t('memberEvents.registeredUnregister')}
      </button>
    ) : onWaitlist ? (
      <button
        className="btn btn-secondary btn-full-width"
        onClick={() => handlers.onLeaveWaitlist(event.id)}
        disabled={handlers.leavingWaitlistId === event.id}
      >
        {t('memberEvents.onWaitlistLeave')}
      </button>
    ) : (
      <>
        <button
          className="btn btn-primary btn-full-width btn-large"
          onClick={() => handlers.onRegister(event.id)}
          disabled={full || handlers.registeringId === event.id}
        >
          {full ? t('memberEvents.eventFull') : t('memberEvents.registerForEvent')}
        </button>
        {full && (
          <button
            className="btn btn-secondary btn-full-width"
            onClick={() => handlers.onJoinWaitlist(event.id)}
            disabled={handlers.joiningWaitlistId === event.id}
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

const validateEventSubmission = ({ linkAmenity, linkedAmenityId, formData, validate }) => {
  if (!linkAmenity || !linkedAmenityId) return true
  return validate(formData.get('date'), parseInt(formData.get('duration'), 10) || 60)
}

const uploadMemberEventBanner = async (file, currentBannerUrl, t) => {
  if (!file && currentBannerUrl) return currentBannerUrl
  if (!file) throw new Error(t('toast.eventBannerRequired'))
  return uploadEventBanner(file)
}

const EVENT_EDIT_ERROR_KEYS = {
  'functions/aborted': 'toast.eventEditStale',
  'functions/failed-precondition': 'toast.eventEditUnavailable',
  'functions/permission-denied': 'toast.eventEditPermissionDenied',
  'functions/not-found': 'toast.eventEditNotFound',
  'functions/invalid-argument': 'toast.eventEditInvalid',
  aborted: 'toast.eventEditStale',
  'failed-precondition': 'toast.eventEditUnavailable',
  'permission-denied': 'toast.eventEditPermissionDenied',
  'not-found': 'toast.eventEditNotFound',
  'invalid-argument': 'toast.eventEditInvalid'
}

const getEventEditErrorMessage = (error, t) => {
  const key = EVENT_EDIT_ERROR_KEYS[error?.code]
  return t(key || 'toast.eventUpdateFailed')
}

const submitMemberEventForm = async ({
  event,
  form,
  linkAmenity,
  currentUser,
  userProfile,
  createMutation,
  editMutation,
  setIsSubmitting,
  validate,
  bannerInputRef,
  t
}) => {
  const formData = new FormData(form)
  const linkedAmenityId = formData.get('linkedAmenityId')
  if (!validateEventSubmission({ linkAmenity, linkedAmenityId, formData, validate })) {
    setIsSubmitting(false)
    return
  }
  try {
    if (event?.status === 'approved' && !window.confirm(t('memberEvents.confirmEditApproved'))) {
      setIsSubmitting(false)
      return
    }
    const bannerUrl = await uploadMemberEventBanner(
      bannerInputRef.current?.files?.[0], event?.bannerUrl, t
    )
    const eventDate = parseHubDateTime(formData.get('date'))
    if (event) {
      editMutation.mutate({
        eventId: event.id,
        expectedRevision: event.revision || 1,
        data: buildEditableEventData({ formData, eventDate, bannerUrl, linkAmenity })
      })
      return
    }
    createMutation.mutate(buildEventData({ formData, eventDate, currentUser, userProfile, bannerUrl, linkAmenity }))
  } catch (error) {
    showToast(error.message || t('toast.eventBannerUploadFailed'), 'error')
    setIsSubmitting(false)
  }
}

const useMemberEventModal = ({ t, currentUser, userProfile, amenities, pushOptedIn }) => {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingEvent, setEditingEvent] = useState(null)
  const [hasAcceptedGuidelines, setHasAcceptedGuidelines] = useState(false)
  const [linkAmenity, setLinkAmenity] = useState(true)
  const [prefillAmenityId, setPrefillAmenityId] = useState(null)
  const [dateError, setDateError] = useState(null)
  const [eventDuration, setEventDuration] = useState(60)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const bannerInputRef = useRef(null)
  const { createMutation, deleteMutation, editMutation } = useEventFormMutations({
    t,
    setIsModalOpen,
    setIsSubmitting,
    uid: currentUser?.uid,
    pushOptedIn
  })

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

  const resetEventModal = () => {
    setIsModalOpen(false)
    setEditingEvent(null)
    setHasAcceptedGuidelines(false)
    setLinkAmenity(false)
    setPrefillAmenityId(null)
    setDateError(null)
    setEventDuration(60)
    if (bannerInputRef.current) bannerInputRef.current.value = ''
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    if (isSubmitting) return
    setIsSubmitting(true)
    submitMemberEventForm({
      event: editingEvent,
      form: event.target,
      linkAmenity,
      currentUser,
      userProfile,
      createMutation,
      editMutation,
      setIsSubmitting,
      validate: validateEventHallDate,
      bannerInputRef,
      t
    })
  }

  const handleOpenCreateModal = () => {
    const eventSpaces = amenities.filter(amenity => amenity.isAvailable !== false && amenity.type === 'event-space')
    const defaultAmenity = eventSpaces.find(amenity => /event hall|event space|main hall/i.test(amenity.name)) || eventSpaces[0]
    setLinkAmenity(true)
    setPrefillAmenityId(defaultAmenity?.id || null)
    setEditingEvent(null)
    setIsModalOpen(true)
  }

  const openCreateForAmenity = (amenityId) => {
    setLinkAmenity(true)
    setPrefillAmenityId(amenityId)
    setEditingEvent(null)
    setIsModalOpen(true)
  }

  const handleEditMyEvent = (event) => {
    if (!isFutureEvent(event)) return
    setEditingEvent(event)
    setLinkAmenity(Boolean(event.requestedAmenityId))
    setPrefillAmenityId(event.requestedAmenityId || null)
    setEventDuration(event.duration || 60)
    setDateError(null)
    setIsModalOpen(true)
  }

  return {
    isModalOpen, editingEvent, hasAcceptedGuidelines, linkAmenity, prefillAmenityId,
    dateError, eventDuration, isSubmitting, setHasAcceptedGuidelines, setLinkAmenity,
    setEventDuration, validateEventHallDate, resetEventModal, handleSubmit,
    handleOpenCreateModal, openCreateForAmenity, handleEditMyEvent, bannerInputRef,
    deleteMutation
  }
}

const useMemberEventInteractions = ({
  t, currentUser, processedActionRef, searchParams, setSearchParams, pushOptedIn,
  deleteMutation
}) => {
  const [hostModalMember, setHostModalMember] = useState(null)
  const actions = useEventActionMutations({
    t,
    currentUser,
    processedActionRef,
    searchParams,
    setSearchParams,
    pushOptedIn
  })

  const handleDeleteMyEvent = async (eventId) => {
    if (isPendingFor(deleteMutation, eventId)) return
    if (window.confirm(t('memberEvents.confirmDelete'))) {
      await deleteMutation.mutateAsync(eventId)
    }
  }

  const handleOpenHostModal = async (organizerId) => {
    if (!organizerId) return
    setHostModalMember(null)
    try {
      const member = await getMember(organizerId)
      if (member) setHostModalMember(member)
    } catch (error) {
      console.warn('Failed to load organizer profile:', error)
    }
  }

  return { ...actions, hostModalMember, setHostModalMember, handleDeleteMyEvent, handleOpenHostModal }
}

const useMemberEventQueryActions = ({
  currentUser, searchParams, setSearchParams, openCreateForAmenity, t,
  isLoadingEvents, upcomingEventsData, approvedEvents, processedActionRef, actions
}) => {
  useEffect(() => {
    const action = searchParams.get('action')
    const amenityId = searchParams.get('amenityId')
    if (action !== 'create' || !amenityId || !currentUser) return
    openCreateForAmenity(amenityId)
    const nextParams = new URLSearchParams(searchParams)
    nextParams.delete('action')
    nextParams.delete('amenityId')
    setSearchParams(nextParams, { replace: true })
  }, [searchParams, currentUser, setSearchParams, openCreateForAmenity])

  useEffect(() => {
    const action = searchParams.get('action')
    const eventId = searchParams.get('eventId')
    if (!action || !eventId || !currentUser || action === 'create') {
      processedActionRef.current = null
      return
    }
    const actionKey = `${action}-${eventId}`
    if (processedActionRef.current === actionKey || isLoadingEvents) return
    const { event, missing } = resolveRedirectEvent(eventId, upcomingEventsData, approvedEvents)
    if (missing) {
      processedActionRef.current = actionKey
      showToast(t('toast.eventNotFound'), 'error')
      clearActionParams(searchParams, setSearchParams)
      return
    }
    if (!event) return
    processedActionRef.current = actionKey
    runRedirectAction(action, event, {
      currentUser, t, searchParams, setSearchParams, processedActionRef,
      registerMutation: actions.registerMutation,
      unregisterMutation: actions.unregisterMutation,
      waitlistMutation: actions.waitlistMutation,
      removeWaitlistMutation: actions.removeWaitlistMutation
    })
  }, [
    actions.registerMutation,
    actions.removeWaitlistMutation,
    actions.unregisterMutation,
    actions.waitlistMutation,
    approvedEvents,
    currentUser,
    isLoadingEvents,
    processedActionRef,
    searchParams,
    setSearchParams,
    t,
    upcomingEventsData
  ])
}

const EventGuidelinesAcknowledgement = ({ hasAcceptedGuidelines, setHasAcceptedGuidelines, t }) => (
  <div className="form-group event-guidelines-ack">
    <label className="form-checkbox">
      <input type="checkbox" checked={hasAcceptedGuidelines} onChange={(event) => setHasAcceptedGuidelines(event.target.checked)} />
      <span>{t('memberEvents.modal.guidelinesPrefix')} <a href="https://www.danangblockchainhub.com/event-guidelines.html" target="_blank" rel="noopener noreferrer">{t('memberEvents.modal.guidelinesLink')}</a>.</span>
    </label>
    <small className="form-hint">{t('memberEvents.modal.guidelinesHint')}</small>
  </div>
)

const getMemberEventFormDefaults = (event) => ({
  title: event?.title ?? '',
  description: event?.description ?? '',
  date: event?.date ? toDatetimeLocalHub(event.date) : '',
  capacity: String(event?.capacity ?? MAX_EVENT_CAPACITY),
  hostingProjects: event?.hostingProjects ?? '',
  eventLink: event?.eventLink ?? ''
})

const EventTextFields = ({ defaults, t }) => <>
    <div className="form-group">
      <label className="form-label">{t('memberEvents.modal.titleLabel')}</label>
      <input type="text" name="title" className="form-field" placeholder={t('memberEvents.modal.titlePlaceholder')} defaultValue={defaults.title} required />
    </div>
    <div className="form-group">
      <label className="form-label">{t('memberEvents.modal.descriptionLabel')}</label>
      <textarea name="description" className="form-field" placeholder={t('memberEvents.modal.descriptionPlaceholder')} defaultValue={defaults.description} rows="3" required aria-required />
    </div>
    <div className="form-group">
      <label className="form-label">{t('memberEvents.modal.hostingProjectsLabel')}</label>
      <input type="text" name="hostingProjects" className="form-field" placeholder={t('memberEvents.modal.hostingProjectsPlaceholder')} defaultValue={defaults.hostingProjects} />
    </div>
    <div className="form-group">
      <label className="form-label">{t('memberEvents.modal.eventLinkLabel')}</label>
      <input type="url" name="eventLink" className="form-field" placeholder={t('memberEvents.modal.eventLinkPlaceholder')} defaultValue={defaults.eventLink} />
    </div>
  </>

const EventBannerField = ({ bannerInputRef, isEdit, t }) => {
  const bannerLabelKey = isEdit
    ? 'memberEvents.modal.bannerUploadReplaceLabel'
    : 'memberEvents.modal.bannerUploadLabel'
  return <div className="form-group">
    <label className="form-label">{t('memberEvents.modal.bannerLabel')}</label>
    <div className="event-banner-upload">
      <input ref={bannerInputRef} type="file" name="banner" id="member-event-banner-input" className="event-banner-input" accept="image/jpeg,image/jpg,image/png,image/webp" required={!isEdit} aria-required={!isEdit} />
      <span className="event-banner-upload-label">{t(bannerLabelKey)}</span>
    </div>
    <small className="form-hint">{t('memberEvents.modal.bannerHint')}</small>
  </div>
}

const EventScheduleFields = ({
  dateError, dateValue, eventDuration, setEventDuration, validateEventHallDate,
  linkAmenity, capacity, t
}) => <>
    <div className="form-group">
      <label className="form-label">{t('memberEvents.modal.dateTimeLabel')}</label>
      <input type="datetime-local" name="date" className={`form-field ${dateError ? 'form-field-error' : ''}`} defaultValue={dateValue} onChange={(event) => validateEventHallDate(event.target.value)} required />
      {linkAmenity && <small className="form-hint">{t('memberEvents.modal.availabilityHint')}</small>}
      {dateError && <p className="form-error">{dateError}</p>}
    </div>
    <div className="form-group">
      <label className="form-label">{t('memberEvents.modal.durationLabel')}</label>
      <input type="number" name="duration" className="form-field" value={eventDuration} onChange={(event) => setEventDuration(parseInt(event.target.value, 10) || 60)} min="15" step="15" required />
    </div>
    <div className="form-group">
      <label className="form-label">{t('memberEvents.modal.capacityLabel')}</label>
      <input type="number" name="capacity" className="form-field" defaultValue={capacity} min="1" max={MAX_EVENT_CAPACITY} required />
      <small className="form-hint">{t('memberEvents.modal.capacityHint', { max: MAX_EVENT_CAPACITY })}</small>
    </div>
  </>

const EventDetailsFields = ({
  editingEvent, dateError, eventDuration, setEventDuration, validateEventHallDate,
  bannerInputRef, linkAmenity, t
}) => {
  const defaults = getMemberEventFormDefaults(editingEvent)
  return <>
    <EventTextFields defaults={defaults} t={t} />
    <EventBannerField bannerInputRef={bannerInputRef} isEdit={Boolean(editingEvent)} t={t} />
    <EventScheduleFields dateError={dateError} dateValue={defaults.date} eventDuration={eventDuration} setEventDuration={setEventDuration} validateEventHallDate={validateEventHallDate} linkAmenity={linkAmenity} capacity={defaults.capacity} t={t} />
  </>
}

const EventHallFields = ({ editingEvent, prefillAmenityId, amenities, t }) => {
  const eventSpaces = amenities.filter(amenity => amenity.isAvailable !== false && amenity.type === 'event-space')
  const defaultAmenity = eventSpaces.find(amenity => /event hall|event space|main hall/i.test(amenity.name)) || eventSpaces[0]
  const selectedAmenityId = editingEvent?.requestedAmenityId || prefillAmenityId || defaultAmenity?.id || ''

  return <>
    <div className="event-hall-notice"><p><strong>{t('memberEvents.modal.hallRequirementsTitle')}</strong></p><ul><li>{t('memberEvents.modal.parkingFeeRequirement')}</li></ul></div>
    <div className="form-group">
      <label className="form-label">{t('memberEvents.modal.preferredAmenityLabel')}</label>
      <select name="linkedAmenityId" className="form-field" defaultValue={selectedAmenityId}>
        <option value="">{t('memberEvents.modal.preferredAmenityPlaceholder')}</option>
        {eventSpaces.map(amenity => <option key={amenity.id} value={amenity.id}>{amenity.name} ({amenity.type})</option>)}
      </select>
    </div>
    <div className="form-group">
      <label className="form-label">{t('memberEvents.modal.additionalNotesLabel')}</label>
      <input type="text" name="amenityNote" className="form-field" placeholder={t('memberEvents.modal.additionalNotesPlaceholder')} defaultValue={editingEvent?.amenityNote || ''} />
    </div>
  </>
}

const MemberEventFormModal = ({
  isModalOpen, editingEvent, hasAcceptedGuidelines, setHasAcceptedGuidelines,
  linkAmenity, prefillAmenityId, amenities, dateError, eventDuration,
  setEventDuration, validateEventHallDate, bannerInputRef, isSubmitting,
  resetEventModal, handleSubmit, t
}) => {
  const isEdit = Boolean(editingEvent)
  const modalTitleKey = isEdit ? 'memberEvents.modal.editTitle' : 'memberEvents.modal.title'
  const descriptionKey = isEdit ? 'memberEvents.modal.editDescription' : 'memberEvents.modal.description'
  const submitLabelKey = isSubmitting
    ? 'memberEvents.modal.submitting'
    : isEdit ? 'memberEvents.modal.save' : 'memberEvents.modal.submit'
  return (
    <Modal
      isOpen={isModalOpen}
      onClose={resetEventModal}
      title={t(modalTitleKey)}
    >
      <p className="modal-description">
        {t(descriptionKey)}
      </p>
      <form onSubmit={handleSubmit}>
        {!isEdit && <EventGuidelinesAcknowledgement hasAcceptedGuidelines={hasAcceptedGuidelines} setHasAcceptedGuidelines={setHasAcceptedGuidelines} t={t} />}
        <fieldset className="event-create-fieldset" disabled={!isEdit && !hasAcceptedGuidelines}>
          <EventDetailsFields editingEvent={editingEvent} dateError={dateError} eventDuration={eventDuration} setEventDuration={setEventDuration} validateEventHallDate={validateEventHallDate} bannerInputRef={bannerInputRef} linkAmenity={linkAmenity} t={t} />
          {linkAmenity && <EventHallFields editingEvent={editingEvent} prefillAmenityId={prefillAmenityId} amenities={amenities} t={t} />}
          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={isSubmitting || !!dateError}>{t(submitLabelKey)}</button>
          </div>
        </fieldset>
        <div className="form-actions form-actions-outside"><button type="button" className="btn btn-secondary" onClick={resetEventModal}>{t('common.close')}</button></div>
      </form>
    </Modal>
  )
}

const MemberEvents = () => {
  const { t } = useTranslation()
  const { currentUser, userProfile } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const processedActionRef = useRef(null)

  const {
    upcomingEventsData,
    isLoadingEvents,
    eventsError,
    approvedEvents,
    myEvents,
    amenities,
    projects
  } = useEventsQueries(currentUser)

  const pushOptedIn = userProfile?.preferences?.pushNotifications === true

  const {
    isModalOpen, editingEvent, hasAcceptedGuidelines, linkAmenity, prefillAmenityId,
    dateError, eventDuration, isSubmitting, setHasAcceptedGuidelines,
    setEventDuration, validateEventHallDate, resetEventModal, handleSubmit,
    handleOpenCreateModal, openCreateForAmenity, handleEditMyEvent, bannerInputRef,
    deleteMutation
  } = useMemberEventModal({ t, currentUser, userProfile, amenities, pushOptedIn })

  const interactions = useMemberEventInteractions({
    t,
    currentUser,
    processedActionRef,
    searchParams,
    setSearchParams,
    pushOptedIn,
    deleteMutation
  })

  useMemberEventQueryActions({
    currentUser,
    searchParams,
    setSearchParams,
    openCreateForAmenity,
    t,
    isLoadingEvents,
    upcomingEventsData,
    approvedEvents,
    processedActionRef,
    actions: interactions
  })

  const {
    registerMutation,
    unregisterMutation,
    waitlistMutation,
    removeWaitlistMutation,
    handleRegister,
    handleUnregister,
    handleJoinWaitlist,
    handleLeaveWaitlist,
    hostModalMember,
    setHostModalMember,
    handleDeleteMyEvent,
    handleOpenHostModal
  } = interactions

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
        <MyEventsSection
          myEvents={myEvents}
          projects={projects}
          onDelete={handleDeleteMyEvent}
          onEdit={handleEditMyEvent}
          deletingId={pendingTargetId(deleteMutation)}
          t={t}
        />

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
            onLeaveWaitlist: handleLeaveWaitlist,
            registeringId: pendingTargetId(registerMutation),
            unregisteringId: pendingTargetId(unregisterMutation),
            joiningWaitlistId: pendingTargetId(waitlistMutation),
            leavingWaitlistId: pendingTargetId(removeWaitlistMutation),
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

        <MemberEventFormModal
          isModalOpen={isModalOpen}
          editingEvent={editingEvent}
          hasAcceptedGuidelines={hasAcceptedGuidelines}
          setHasAcceptedGuidelines={setHasAcceptedGuidelines}
          linkAmenity={linkAmenity}
          prefillAmenityId={prefillAmenityId}
          amenities={amenities}
          dateError={dateError}
          eventDuration={eventDuration}
          setEventDuration={setEventDuration}
          validateEventHallDate={validateEventHallDate}
          bannerInputRef={bannerInputRef}
          isSubmitting={isSubmitting}
          resetEventModal={resetEventModal}
          handleSubmit={handleSubmit}
          t={t}
        />

        <HostProfileModal member={hostModalMember} onClose={() => setHostModalMember(null)} t={t} />
      </div>
    </Layout>
  )
}

export default MemberEvents
