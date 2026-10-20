import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useInvalidateQueries } from '../../hooks/useInvalidateQueries'
import Layout from '../../components/Layout'
import Modal from '../../components/Modal'
import Avatar from '../../components/Avatar'
import EventDetailModal from '../../components/event/EventDetailModal'
import EventCard from '../../components/event/EventCard'
import EventFormModal from '../../components/event/EventFormModal'
import { getEventVenueId, getEventFormPayload } from '../../components/event/eventFields'
import { useEventHallCheck } from '../../components/event/useEventHallCheck'
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
import { getAmenities } from '../../services/amenities'
import { uploadEventBanner } from '../../services/storage'
import { editOwnEvent } from '../../services/functions'
import { showToast } from '../../utils/toast'
import { isPendingFor, pendingTargetId } from '../../utils/mutationTarget'
import { promptPushOptInAfterSuccess } from '../../utils/pushOptInPrompt'
import { parseHubDateTime } from '../../utils/timezone'
import { consumeCreateAction } from '../../utils/consumeCreateAction'
import { useTranslation } from 'react-i18next'
import './Events.css'
import './Profile.css'

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

const clearActionParams = (searchParams, setSearchParams) => {
  const newParams = new URLSearchParams(searchParams)
  newParams.delete('action')
  newParams.delete('eventId')
  setSearchParams(newParams, { replace: true })
}

const isFutureEvent = (event) => new Date(event.date) > new Date()

const buildEventData = ({ formData, eventDate, currentUser, userProfile, bannerUrl, linkAmenity }) => ({
  ...getEventFormPayload(formData, eventDate, linkAmenity),
  organizerId: currentUser.uid,
  // Denormalize organizer fields from the in-memory profile so createEvent
  // doesn't need a Firestore round-trip to look the member up.
  organizerDisplayName: userProfile?.displayName ?? currentUser.displayName ?? null,
  organizerPhotoURL: userProfile?.photoURL ?? currentUser.photoURL ?? null,
  status: 'pending',
  waitlist: [],
  bannerUrl
})

const buildEditableEventData = ({ formData, eventDate, bannerUrl, linkAmenity }) => ({
  ...getEventFormPayload(formData, eventDate, linkAmenity),
  bannerUrl
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

  const { data: amenities = [], isLoading: isLoadingAmenities } = useQuery({
    queryKey: ['amenities'],
    queryFn: getAmenities
  })

  if (eventsError) {
    console.error('Error loading upcoming events:', eventsError)
  }

  return { upcomingEventsData, isLoadingEvents, eventsError, approvedEvents, myEvents, amenities, isLoadingAmenities }
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
      invalidate('myEvents', 'approvedEvents', 'pendingEvents', 'upcomingEvents', 'notifications')
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

const MyEventActions = ({ event, onDelete, onEdit, deletePending, t }) => (
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
)

const MyEventCard = ({ event, onDelete, onEdit, onOpenDetails, deletePending, t }) => (
  <EventCard
    event={event}
    view="organizer"
    onOpen={onOpenDetails}
    actions={<MyEventActions event={event} onDelete={onDelete} onEdit={onEdit} deletePending={deletePending} t={t} />}
  />
)

const MyEventsSection = ({ myEvents, onDelete, onEdit, onOpenDetails, deletingId, t }) => {
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
            onDelete={onDelete}
            onEdit={onEdit}
            onOpenDetails={onOpenDetails}
            deletePending={deletingId === event.id}
            t={t}
          />
        ))}
      </div>
    </div>
  )
}

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

const UpcomingEventContext = ({ isMyEvent, waitlistPosition, t }) => (
  <>
    {isMyEvent && <p className="ecard-note ecard-note-accent">{t('eventCard.organizerYou')}</p>}
    {waitlistPosition && (
      <p className="ecard-note ecard-note-accent">{t('memberEvents.yourPosition', { position: waitlistPosition })}</p>
    )}
  </>
)

const UpcomingEventCard = ({ event, currentUserId, onOpenHost, onOpenDetails, handlers, t }) => {
  const waitlistPosition = getEventWaitlistPosition(event, currentUserId)
  const isMyEvent = event.organizerId === currentUserId
  return (
    <EventCard
      event={event}
      view="member"
      onOpen={onOpenDetails}
      onShowHost={onOpenHost}
      context={(isMyEvent || waitlistPosition) && (
        <UpcomingEventContext isMyEvent={isMyEvent} waitlistPosition={waitlistPosition} t={t} />
      )}
      actions={
        <UpcomingEventActions
          event={event}
          registered={isEventRegistered(event, currentUserId)}
          onWaitlist={isOnEventWaitlist(event, currentUserId)}
          full={isEventFull(event)}
          handlers={handlers}
          t={t}
        />
      }
    />
  )
}

const UpcomingEventsSection = ({ isLoadingEvents, eventsError, upcomingEvents, approvedEvents, currentUserId, onOpenHost, onOpenDetails, handlers, t }) => (
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
            currentUserId={currentUserId}
            onOpenHost={onOpenHost}
            onOpenDetails={onOpenDetails}
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

const PastEventCard = ({ event, currentUserId, onOpenHost, onOpenDetails, t }) => (
  <EventCard
    event={event}
    view="member"
    onOpen={onOpenDetails}
    onShowHost={onOpenHost}
    past
    context={isEventRegistered(event, currentUserId) && (
      <p className="ecard-note ecard-note-success">{t('memberEvents.attended')}</p>
    )}
  />
)

const PastEventsSection = ({ pastEvents, currentUserId, onOpenHost, onOpenDetails, t }) => (
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
            currentUserId={currentUserId}
            onOpenHost={onOpenHost}
            onOpenDetails={onOpenDetails}
            t={t}
          />
        ))}
      </div>
    ) : (
      <p className="empty-state">{t('memberEvents.noPastEvents')}</p>
    )}
  </div>
)

const HostProfileHeader = ({ member }) => {
  const { t } = useTranslation()
  return (
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
  )
}

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
  if (!validate(form)) {
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
  const [prefillAmenityId, setPrefillAmenityId] = useState(null)
  const {
    linkAmenity, eventDuration, dateError,
    checkEventHall, setEventHallRequest, changeEventDuration, resetEventHallCheck
  } = useEventHallCheck(t, amenities)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const bannerInputRef = useRef(null)
  const { createMutation, deleteMutation, editMutation } = useEventFormMutations({
    t,
    setIsModalOpen,
    setIsSubmitting,
    uid: currentUser?.uid,
    pushOptedIn
  })

  const resetEventModal = () => {
    setIsModalOpen(false)
    setEditingEvent(null)
    setHasAcceptedGuidelines(false)
    resetEventHallCheck()
    setPrefillAmenityId(null)
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
      validate: checkEventHall,
      bannerInputRef,
      t
    })
  }

  const handleOpenCreateModal = () => {
    resetEventHallCheck(true)
    setPrefillAmenityId(null)
    setEditingEvent(null)
    setIsModalOpen(true)
  }

  const openCreateForAmenity = (amenityId) => {
    resetEventHallCheck(true)
    setPrefillAmenityId(amenityId)
    setEditingEvent(null)
    setIsModalOpen(true)
  }

  const handleEditMyEvent = (event) => {
    if (!isFutureEvent(event)) return
    const venueId = getEventVenueId(event)
    setEditingEvent(event)
    resetEventHallCheck(Boolean(venueId), event.duration || 60)
    setPrefillAmenityId(venueId || null)
    setIsModalOpen(true)
  }

  return {
    isModalOpen, editingEvent, hasAcceptedGuidelines, linkAmenity, prefillAmenityId,
    dateError, eventDuration, isSubmitting, setHasAcceptedGuidelines, setEventHallRequest,
    changeEventDuration, checkEventHall, resetEventModal, handleSubmit,
    handleOpenCreateModal, openCreateForAmenity, handleEditMyEvent, bannerInputRef,
    deleteMutation
  }
}

const useMemberEventInteractions = ({
  t, currentUser, processedActionRef, searchParams, setSearchParams, pushOptedIn,
  deleteMutation
}) => {
  const [hostModalMember, setHostModalMember] = useState(null)
  // { event, view }: the modal shows the same view as the card it came from.
  const [detailEvent, setDetailEvent] = useState(null)
  const openDetails = (event, view) => setDetailEvent({ event, view })
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

  return {
    ...actions, hostModalMember, setHostModalMember, detailEvent, setDetailEvent, openDetails,
    handleDeleteMyEvent, handleOpenHostModal
  }
}

const useMemberEventQueryActions = ({
  currentUser, searchParams, setSearchParams, openCreateForAmenity, handleOpenCreateModal, t,
  isLoadingEvents, isLoadingAmenities, upcomingEventsData, approvedEvents, processedActionRef, actions
}) => {
  useEffect(() => {
    consumeCreateAction({
      searchParams, currentUser, openCreateForAmenity, handleOpenCreateModal, setSearchParams,
      isLoadingAmenities
    })
  }, [searchParams, currentUser, setSearchParams, openCreateForAmenity, handleOpenCreateModal, isLoadingAmenities])

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
    isLoadingAmenities,
  } = useEventsQueries(currentUser)

  const pushOptedIn = userProfile?.preferences?.pushNotifications === true

  const {
    isModalOpen, editingEvent, hasAcceptedGuidelines, linkAmenity, prefillAmenityId,
    dateError, eventDuration, isSubmitting, setHasAcceptedGuidelines,
    setEventHallRequest, changeEventDuration, checkEventHall, resetEventModal, handleSubmit,
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
    handleOpenCreateModal,
    t,
    isLoadingEvents,
    isLoadingAmenities,
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
    detailEvent,
    setDetailEvent,
    openDetails,
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
          onDelete={handleDeleteMyEvent}
          onEdit={handleEditMyEvent}
          onOpenDetails={openDetails}
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
          onOpenHost={handleOpenHostModal}
          onOpenDetails={openDetails}
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
          currentUserId={currentUser?.uid}
          onOpenHost={handleOpenHostModal}
          onOpenDetails={openDetails}
          t={t}
        />

        <EventFormModal
          isModalOpen={isModalOpen}
          editingEvent={editingEvent}
          requireGuidelines
          hasAcceptedGuidelines={hasAcceptedGuidelines}
          setHasAcceptedGuidelines={setHasAcceptedGuidelines}
          linkAmenity={linkAmenity}
          prefillAmenityId={prefillAmenityId}
          amenities={amenities}
          dateError={dateError}
          eventDuration={eventDuration}
          changeEventDuration={changeEventDuration}
          checkEventHall={checkEventHall}
          bannerInputRef={bannerInputRef}
          isSubmitting={isSubmitting}
          setEventHallRequest={setEventHallRequest}
          resetEventModal={resetEventModal}
          handleSubmit={handleSubmit}
          t={t}
        />

        <EventDetailModal
          event={detailEvent?.event}
          view={detailEvent?.view}
          onClose={() => setDetailEvent(null)}
          onShowHost={handleOpenHostModal}
        />

        <HostProfileModal member={hostModalMember} onClose={() => setHostModalMember(null)} t={t} />
      </div>
    </Layout>
  )
}

export default MemberEvents
