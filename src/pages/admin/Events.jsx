import { useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useInvalidateQueries } from '../../hooks/useInvalidateQueries'
import Layout from '../../components/Layout'
import Modal from '../../components/Modal'
import Avatar from '../../components/Avatar'
import {
  getEvents,
  getPendingEvents,
  createEvent,
  updateEvent,
  deleteEvent,
  approveEvent,
  rejectEvent,
  promoteFromWaitlist
} from '../../services/events'
import { getMembers } from '../../services/members'
import { getAmenities, validateEventSpaceTime } from '../../services/amenities'
import { getProjects } from '../../services/projects'
import { createBooking } from '../../services/bookings'
import { uploadEventBanner } from '../../services/storage'
import { showToast } from '../../utils/toast'
import { parseHubDateTime, toDatetimeLocalHub, formatEventDate, formatEventTime } from '../../utils/timezone'
import './Events.css'
import '../member/Profile.css'

const MAX_EVENT_CAPACITY = 50

const getStatusBadge = (status) => {
  const statusClasses = {
    pending: 'status-badge pending',
    approved: 'status-badge approved',
    rejected: 'status-badge rejected'
  }
  return statusClasses[status] || 'status-badge'
}

const getOrganizerName = (event) =>
  event.organizerDisplayName || event.organizerId

// Admin event management ("view all" intent): ±365 day window.
const getAdminEventsWindow = () => {
  const start = new Date()
  start.setDate(start.getDate() - 365)
  start.setHours(0, 0, 0, 0)
  const end = new Date()
  end.setDate(end.getDate() + 365)
  end.setHours(23, 59, 59, 999)
  return { startDate: start, endDate: end }
}

const buildBaseEventData = (formData, eventDate) => {
  const rawCapacity = parseInt(formData.get('capacity'), 10)
  const capacity = Number.isNaN(rawCapacity)
    ? MAX_EVENT_CAPACITY
    : Math.min(Math.max(rawCapacity, 1), MAX_EVENT_CAPACITY)

  return {
    title: formData.get('title'),
    description: formData.get('description'),
    date: eventDate.toISOString(),
    capacity,
    duration: parseInt(formData.get('duration')) || 60, // Duration in minutes
    organizerId: formData.get('organizerId'),
    waitlist: []
  }
}

// On create, pre-fill denormalized organizer fields from the already-loaded
// members list so createEvent doesn't need to round-trip Firestore. On
// update, leave them off — updateEvent re-fetches when organizerId changes.
const applyOrganizerDenorm = (data, members, isCreateMode) => {
  if (!isCreateMode || !data.organizerId) return
  const organizer = members.find(m => m.id === data.organizerId)
  if (!organizer) return
  data.organizerDisplayName = organizer.displayName || null
  data.organizerPhotoURL = organizer.photoURL || null
}

const applyOptionalFields = (data, formData) => {
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
}

// Handle amenity linking
const applyAmenityLink = (data, eventDate, linkedAmenityId) => {
  const duration = data.duration || 60
  const startTime = new Date(eventDate)
  startTime.setHours(startTime.getHours() - 1) // 1 hour before event
  const endTime = new Date(eventDate)
  endTime.setMinutes(endTime.getMinutes() + duration + 60) // Duration + 1 hour buffer after event

  data.linkedAmenityId = linkedAmenityId
  data.linkedAmenityStartTime = startTime.toISOString()
  data.linkedAmenityEndTime = endTime.toISOString()
}

const buildEventData = ({ formData, eventDate, isCreateMode, members, linkAmenity, linkedAmenityId }) => {
  const data = buildBaseEventData(formData, eventDate)
  applyOrganizerDenorm(data, members, isCreateMode)
  applyOptionalFields(data, formData)
  if (linkAmenity && linkedAmenityId) {
    applyAmenityLink(data, eventDate, linkedAmenityId)
  }
  return data
}

const createEventWithBooking = async (data, t) => {
  const eventId = await createEvent({ ...data, status: 'approved' })

  // If amenity is linked, create booking
  if (data.linkedAmenityId && data.linkedAmenityStartTime && data.linkedAmenityEndTime) {
    try {
      await createBooking({
        memberId: data.organizerId,
        amenityId: data.linkedAmenityId,
        startTime: data.linkedAmenityStartTime,
        endTime: data.linkedAmenityEndTime,
        eventId: eventId,
        status: 'approved'
      })
    } catch (error) {
      console.error('Failed to create linked amenity booking:', error)
      showToast(t('toast.eventCreatedWithLinkError'), 'warning')
    }
  }

  return eventId
}

const approveEventWithBooking = async (eventId, allEvents, pendingEvents) => {
  const event = allEvents.find(e => e.id === eventId) || pendingEvents.find(e => e.id === eventId)
  await approveEvent(eventId)

  // If amenity was requested, create booking
  if (!event?.requestedAmenityId) return
  const eventDate = new Date(event.date)
  const startTime = new Date(eventDate)
  startTime.setHours(startTime.getHours() - 1)
  const endTime = new Date(eventDate)
  endTime.setHours(endTime.getHours() + 2)

  try {
    await createBooking({
      memberId: event.organizerId,
      amenityId: event.requestedAmenityId,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      eventId: eventId,
      status: 'approved'
    })

    // Update event with linked amenity
    await updateEvent(eventId, {
      linkedAmenityId: event.requestedAmenityId,
      linkedAmenityStartTime: startTime.toISOString(),
      linkedAmenityEndTime: endTime.toISOString()
    })
  } catch (error) {
    console.error('Failed to create linked amenity booking:', error)
  }
}

const submitCreateEvent = async (data, ctx) => {
  const bannerFile = ctx.bannerInputRef.current?.files?.[0]
  if (!bannerFile) {
    showToast(ctx.t('toast.eventBannerRequired'), 'error')
    ctx.setIsSubmitting(false)
    return
  }
  try {
    data.bannerUrl = await uploadEventBanner(bannerFile)
  } catch (err) {
    showToast(err.message || ctx.t('toast.eventBannerUploadFailed'), 'error')
    ctx.setIsSubmitting(false)
    return
  }
  ctx.createMutation.mutate(data)
}

const submitUpdateEvent = async (data, ctx) => {
  const bannerFile = ctx.bannerInputRef.current?.files?.[0]
  if (bannerFile) {
    try {
      data.bannerUrl = await uploadEventBanner(bannerFile)
    } catch (err) {
      showToast(err.message || ctx.t('toast.eventBannerUploadFailed'), 'error')
      ctx.setIsSubmitting(false)
      return
    }
  } else if (ctx.selectedEvent?.bannerUrl) {
    data.bannerUrl = ctx.selectedEvent.bannerUrl
  }
  ctx.updateMutation.mutate({ id: ctx.selectedEvent.id, data })
}

const useAdminEventsData = () => {
  const { data: allEvents = [], isLoading } = useQuery({
    queryKey: ['events'],
    queryFn: () => getEvents(getAdminEventsWindow())
  })

  const { data: pendingEvents = [] } = useQuery({
    queryKey: ['pendingEvents'],
    queryFn: getPendingEvents
  })

  const { data: members = [] } = useQuery({
    queryKey: ['members'],
    queryFn: getMembers
  })

  const { data: amenities = [] } = useQuery({
    queryKey: ['amenities'],
    queryFn: getAmenities
  })

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: getProjects
  })

  return { allEvents, pendingEvents, members, amenities, projects, isLoading }
}

const useAdminEventMutations = ({ t, allEvents, pendingEvents, setIsModalOpen, resetForm, setIsSubmitting }) => {
  const invalidate = useInvalidateQueries()

  const closeFormWithToast = (toastKey) => {
    setIsModalOpen(false)
    resetForm()
    setIsSubmitting(false)
    showToast(t(toastKey), 'success')
  }

  const failSubmitWithToast = (toastKey) => {
    setIsSubmitting(false)
    showToast(t(toastKey), 'error')
  }

  const createMutation = useMutation({
    mutationFn: (data) => createEventWithBooking(data, t),
    onSuccess: () => {
      invalidate('events', 'pendingEvents', 'approvedEvents', 'upcomingEvents', 'myEvents', 'bookings')
      closeFormWithToast('toast.eventCreated')
    },
    onError: () => failSubmitWithToast('toast.eventCreateFailed')
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => updateEvent(id, data),
    onSuccess: () => {
      invalidate('events', 'pendingEvents', 'upcomingEvents', 'approvedEvents')
      closeFormWithToast('toast.eventUpdated')
    },
    onError: () => failSubmitWithToast('toast.eventUpdateFailed')
  })

  const approveMutation = useMutation({
    mutationFn: (eventId) => approveEventWithBooking(eventId, allEvents, pendingEvents),
    onSuccess: () => {
      invalidate('events', 'pendingEvents', 'approvedEvents', 'myEvents', 'upcomingEvents', 'bookings')
      showToast(t('toast.eventApproved'), 'success')
    },
    onError: () => {
      showToast(t('toast.eventApproveFailed'), 'error')
    }
  })

  const rejectMutation = useMutation({
    mutationFn: ({ eventId, reason }) => rejectEvent(eventId, reason),
    onSuccess: () => {
      invalidate('events', 'pendingEvents', 'myEvents', 'upcomingEvents')
      showToast(t('toast.eventRejected'), 'info')
    },
    onError: () => {
      showToast(t('toast.eventRejectFailed'), 'error')
    }
  })

  const promoteWaitlistMutation = useMutation({
    mutationFn: ({ eventId, count }) => promoteFromWaitlist(eventId, count),
    onSuccess: (result) => {
      invalidate('events', 'upcomingEvents', 'approvedEvents')
      showToast(t('toast.waitlistPromoted', { count: result.promoted }), 'success')
    },
    onError: () => {
      showToast(t('toast.waitlistPromoteFailed'), 'error')
    }
  })

  const deleteMutation = useMutation({
    mutationFn: deleteEvent,
    onSuccess: () => {
      invalidate('events', 'pendingEvents', 'upcomingEvents', 'approvedEvents')
      showToast(t('toast.eventDeleted'), 'success')
    }
  })

  return { createMutation, updateMutation, approveMutation, rejectMutation, promoteWaitlistMutation, deleteMutation }
}

const EventHostingRow = ({ event, projects, t }) => {
  if (!event.hostingProjects) return null
  return (
    <p className="event-projects">
      🏢 {t('adminEvents.hosted', { hosts: typeof event.hostingProjects === 'string'
? event.hostingProjects
        : event.hostingProjects.map(projectId => {
            const project = projects.find(p => p.id === projectId)
            return project?.name || projectId
          }).join(', ') })}
    </p>
  )
}

const EventAmenityRows = ({ event, amenities, t }) => (
  <>
    {event.requestedAmenityId && (
      <p className="event-amenity-request">
        🏢 {t('adminEvents.requested', { name: amenities.find(a => a.id === event.requestedAmenityId)?.name })}
        {event.amenityNote && <span> - &ldquo;{event.amenityNote}&rdquo;</span>}
      </p>
    )}
    {event.linkedAmenityId && (
      <p className="event-linked-amenity">
        ✅ {t('adminEvents.linked', { name: amenities.find(a => a.id === event.linkedAmenityId)?.name })}
      </p>
    )}
  </>
)

const EventRejectionRow = ({ event, t }) => {
  if (event.status !== 'rejected') return null
  return (
    <p className="event-rejection-reason">
      ❌ {event.rejectionReason
        ? t('adminEvents.rejectionReason', { reason: event.rejectionReason })
        : t('adminEvents.noReasonProvided')}
    </p>
  )
}

const EventCardInfo = ({ event, amenities, projects, t, onShowHost }) => (
  <div className="event-info">
    <p className="event-date">
      📅 {formatEventDate(event.date)} at {formatEventTime(event.date)}
    </p>
    <p className="event-organizer">
      👤 Organizer:{' '}
      <button
        className="organizer-link"
        onClick={onShowHost}
      >
        {getOrganizerName(event)}
      </button>
    </p>
    {event.duration && (
      <p className="event-duration">⏱️ {t('adminEvents.duration', { minutes: event.duration })}</p>
    )}
    <p className="event-capacity">
      👥 {event.attendees?.length || 0} / {event.capacity || MAX_EVENT_CAPACITY}
    </p>
    <EventHostingRow event={event} projects={projects} t={t} />
    {event.waitlist && event.waitlist.length > 0 && (
      <p className="event-waitlist">
        ⏳ {t('adminEvents.waitlist', { count: event.waitlist.length })}
      </p>
    )}
    <EventAmenityRows event={event} amenities={amenities} t={t} />
    {event.eventLink && (
      <p className="event-link">
        🔗 <a href={event.eventLink} target="_blank" rel="noopener noreferrer">{t('adminEvents.eventLink')}</a>
      </p>
    )}
    {event.description && (
      <p className="event-description">{event.description}</p>
    )}
    <EventRejectionRow event={event} t={t} />
  </div>
)

const EventCardActions = ({ event, t, onApprove, onReject, onPromoteWaitlist, onEdit, onDelete, approvePending, rejectPending }) => (
  <div className="event-actions">
    {event.status === 'pending' && (
      <>
        <button
          className="btn btn-primary btn-sm"
          onClick={() => onApprove(event.id)}
          disabled={approvePending}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
            <span>✓</span>
            <span>{t('common.approve')}</span>
          </span>
        </button>
        <button
          className="btn btn-danger btn-sm"
          onClick={() => onReject(event.id)}
          disabled={rejectPending}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
            <span>✗</span>
            <span>{t('common.reject')}</span>
          </span>
        </button>
      </>
    )}
    {event.status === 'approved' && new Date(event.date) > new Date() && (
      <>
        {event.waitlist && event.waitlist.length > 0 && (
          <button
            className="btn btn-primary btn-sm"
            onClick={() => onPromoteWaitlist(event.id)}
          >
            {t('adminEvents.promoteWaitlist')}
          </button>
        )}
        <button
          className="btn btn-danger btn-sm"
          onClick={() => onReject(event.id, true)}
          disabled={rejectPending}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
            <span>✗</span>
            <span>{t('common.reject')}</span>
          </span>
        </button>
      </>
    )}
    <button
      className="btn btn-secondary btn-sm"
      onClick={() => onEdit(event)}
    >
      {t('common.edit')}
    </button>
    <button
      className="btn btn-danger btn-sm"
      onClick={() => onDelete(event.id)}
    >
      {t('common.delete')}
    </button>
  </div>
)

const EventCard = ({ event, t, amenities, projects, onShowHost, ...actionProps }) => (
  <div className={`event-card glass ${event.status}`}>
    {event.bannerUrl && (
      <div className="event-card-banner">
        <img src={event.bannerUrl} alt="" loading="lazy" decoding="async" />
      </div>
    )}
    <div className="event-header">
      <h3 className="event-title">{event.title}</h3>
      <span className={getStatusBadge(event.status || 'approved')}>
        {t(`status.${event.status || 'approved'}`)}
      </span>
    </div>
    <EventCardInfo event={event} amenities={amenities} projects={projects} t={t} onShowHost={onShowHost} />
    <EventCardActions event={event} t={t} {...actionProps} />
  </div>
)

const EventBannerField = ({ isCreateMode, selectedEvent, bannerInputRef, t }) => (
  <div className="form-group">
    <label className="form-label">
      {t('adminEvents.modal.bannerLabel')} {isCreateMode && <span className="form-required">*</span>}
    </label>
    <div className="event-banner-upload">
      <input
        ref={bannerInputRef}
        type="file"
        name="banner"
        id="event-banner-input"
        className="event-banner-input"
        accept="image/jpeg,image/jpg,image/png,image/webp"
        required={isCreateMode}
        aria-required={isCreateMode}
      />
      <span className="event-banner-upload-label">
        {isCreateMode ? t('adminEvents.modal.bannerUploadCreate') : t('adminEvents.modal.bannerUploadEdit')}
      </span>
    </div>
    {isCreateMode ? (
      <small className="form-hint">{t('adminEvents.modal.bannerHintRequired')}</small>
    ) : selectedEvent?.bannerUrl ? (
      <div className="event-banner-preview">
        <img src={selectedEvent.bannerUrl} alt={t('adminEvents.modal.currentBanner')} />
        <small className="form-hint">{t('adminEvents.modal.bannerHintReplace')}</small>
      </div>
    ) : (
      <small className="form-hint">{t('adminEvents.modal.bannerHintOptional')}</small>
    )}
  </div>
)

const EventDateField = ({ selectedEvent, dateError, linkAmenity, validateEventHallDate, t }) => (
  <div className="form-group">
    <label className="form-label">{t('adminEvents.modal.dateTimeLabel')}</label>
    <input
      type="datetime-local"
      name="date"
      className={`form-field ${dateError ? 'form-field-error' : ''}`}
      defaultValue={selectedEvent?.date ? toDatetimeLocalHub(selectedEvent.date) : ''}
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
)

const HostingProjectsField = ({ selectedEvent, projects, t }) => (
  <div className="form-group">
    <label className="form-label">{t('adminEvents.modal.hostingLabel')}</label>
    <input
      type="text"
      name="hostingProjects"
      className="form-field"
      placeholder={t('adminEvents.modal.hostingPlaceholder')}
      defaultValue={typeof selectedEvent?.hostingProjects === 'string'
        ? selectedEvent.hostingProjects
        : selectedEvent?.hostingProjects?.map(projectId => {
            const project = projects.find(p => p.id === projectId)
            return project?.name || projectId
          }).join(', ') || ''}
    />
    <small className="form-hint">{t('adminEvents.modal.hostingHint')}</small>
  </div>
)

const AmenityLinkSection = ({ isCreateMode, linkAmenity, setLinkAmenity, selectedEvent, amenities, t }) => (
  <>
    <div className="form-group">
      <label className="form-checkbox">
        <input
          type="checkbox"
          checked={isCreateMode ? true : linkAmenity}
          disabled={isCreateMode}
          readOnly={isCreateMode}
          onChange={(e) => !isCreateMode && setLinkAmenity(e.target.checked)}
        />
        <span>{t('adminEvents.modal.linkAmenity')}</span>
      </label>
    </div>
    {(linkAmenity || isCreateMode) && (() => {
      const eventSpaceAmenities = amenities.filter(a => a.isAvailable !== false && a.type === 'event-space')
      const defaultEventHallId = eventSpaceAmenities.find(a => /event hall|event space|main hall/i.test(a.name))?.id || eventSpaceAmenities[0]?.id
      const selectDefaultValue = selectedEvent?.linkedAmenityId || defaultEventHallId || ''
      return (
      <>
        <div className="event-hall-notice">
          <p><strong>{t('adminEvents.modal.eventHallNotice')}</strong> {t('adminEvents.modal.parkingFeeRequirement')}</p>
        </div>
        <div className="form-group">
          <label className="form-label">{t('adminEvents.modal.amenityLabel')}</label>
          <select name="linkedAmenityId" className="form-field" defaultValue={selectDefaultValue}>
            <option value="">{t('adminEvents.modal.amenityPlaceholder')}</option>
            {eventSpaceAmenities.map(amenity => (
              <option key={amenity.id} value={amenity.id}>
                {amenity.name}
              </option>
            ))}
          </select>
          <small className="form-hint">{t('adminEvents.modal.amenityHint')}</small>
        </div>
      </>
      )
    })()}
  </>
)

const EventFormModal = ({
  isOpen,
  onClose,
  isCreateMode,
  selectedEvent,
  onSubmit,
  isSubmitting,
  dateError,
  linkAmenity,
  setLinkAmenity,
  eventDuration,
  setEventDuration,
  validateEventHallDate,
  bannerInputRef,
  members,
  amenities,
  projects,
  t
}) => (
  <Modal
    isOpen={isOpen}
    onClose={onClose}
    title={isCreateMode ? t('adminEvents.modal.createTitle') : t('adminEvents.modal.editTitle')}
  >
    <form onSubmit={onSubmit}>
      <div className="form-group">
        <label className="form-label">{t('adminEvents.modal.titleLabel')}</label>
        <input
          type="text"
          name="title"
          className="form-field"
          defaultValue={selectedEvent?.title || ''}
          required
        />
      </div>
      <div className="form-group">
        <label className="form-label">{t('adminEvents.modal.descriptionLabel')} <span className="form-required">*</span></label>
        <textarea
          name="description"
          className="form-field"
          defaultValue={selectedEvent?.description || ''}
          rows="3"
          required
          aria-required
        />
      </div>
      <EventBannerField
        isCreateMode={isCreateMode}
        selectedEvent={selectedEvent}
        bannerInputRef={bannerInputRef}
        t={t}
      />
      <EventDateField
        selectedEvent={selectedEvent}
        dateError={dateError}
        linkAmenity={linkAmenity}
        validateEventHallDate={validateEventHallDate}
        t={t}
      />
      <div className="form-group">
        <label className="form-label">{t('adminEvents.modal.durationLabel')}</label>
        <input
          type="number"
          name="duration"
          className="form-field"
          placeholder={t('adminEvents.modal.durationPlaceholder')}
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
        <label className="form-label">{t('adminEvents.modal.capacityLabel')}</label>
        <input
          type="number"
          name="capacity"
          className="form-field"
          defaultValue={selectedEvent?.capacity || MAX_EVENT_CAPACITY}
          min="1"
          max={MAX_EVENT_CAPACITY}
          required
        />
        <small className="form-hint">
          {t('adminEvents.modal.capacityHint', { max: MAX_EVENT_CAPACITY })}
        </small>
      </div>
      <HostingProjectsField selectedEvent={selectedEvent} projects={projects} t={t} />
      <div className="form-group">
        <label className="form-label">{t('adminEvents.modal.eventLinkLabel')}</label>
        <input
          type="url"
          name="eventLink"
          className="form-field"
          placeholder={t('adminEvents.modal.eventLinkPlaceholder')}
          defaultValue={selectedEvent?.eventLink || ''}
        />
        <small className="form-hint">{t('adminEvents.modal.eventLinkHint')}</small>
      </div>
      <div className="form-group">
        <label className="form-label">{t('adminEvents.modal.organizerLabel')}</label>
        <select name="organizerId" className="form-field" defaultValue={selectedEvent?.organizerId || ''} required>
          <option value="">{t('adminEvents.modal.organizerPlaceholder')}</option>
          {members.map(member => (
            <option key={member.id} value={member.id}>
              {member.displayName || member.email}
            </option>
          ))}
        </select>
      </div>
      <AmenityLinkSection
        isCreateMode={isCreateMode}
        linkAmenity={linkAmenity}
        setLinkAmenity={setLinkAmenity}
        selectedEvent={selectedEvent}
        amenities={amenities}
        t={t}
      />
      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
          {isSubmitting ? t('common.saving') : isCreateMode ? t('common.create') : t('common.save')}
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={isSubmitting}
          onClick={onClose}
        >
          {t('common.cancel')}
        </button>
      </div>
    </form>
  </Modal>
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

const HostProfileProfessional = ({ member }) => (
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

const HostProfileContact = ({ member }) => (
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

const HostProfileModal = ({ member, onClose }) => (
  <Modal
    isOpen={!!member}
    onClose={onClose}
    title={member?.displayName || 'Host'}
  >
    {member && (
      <div className="profile-modal-content">
        <HostProfileHeader member={member} />
        <HostProfileProfessional member={member} />
        <HostProfileContact member={member} />
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

const AdminEvents = () => {
  const { t } = useTranslation()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isCreateMode, setIsCreateMode] = useState(true)
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [linkAmenity, setLinkAmenity] = useState(false)
  const [activeTab, setActiveTab] = useState('pending') // 'pending', 'approved', 'all'
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [dateError, setDateError] = useState(null)
  const [eventDuration, setEventDuration] = useState(60)
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

  const { allEvents, pendingEvents, members, amenities, projects, isLoading } = useAdminEventsData()

  const resetForm = () => {
    setSelectedEvent(null)
    setIsCreateMode(true)
    setLinkAmenity(false)
    setDateError(null)
    setEventDuration(60)
    if (bannerInputRef.current) {
      bannerInputRef.current.value = ''
    }
  }

  const {
    createMutation,
    updateMutation,
    approveMutation,
    rejectMutation,
    promoteWaitlistMutation,
    deleteMutation
  } = useAdminEventMutations({ t, allEvents, pendingEvents, setIsModalOpen, resetForm, setIsSubmitting })

  const handleCreate = () => {
    setIsCreateMode(true)
    setSelectedEvent(null)
    setLinkAmenity(true)
    setDateError(null)
    setEventDuration(60)
    setIsModalOpen(true)
  }

  const handleEdit = (event) => {
    setIsCreateMode(false)
    setSelectedEvent(event)
    setLinkAmenity(!!event.linkedAmenityId)
    setDateError(null)
    setEventDuration(event.duration || 60)
    setIsModalOpen(true)
  }

  const handleDelete = async (id) => {
    if (window.confirm(t('adminEvents.confirmDelete'))) {
      await deleteMutation.mutateAsync(id)
    }
  }

  const handleApprove = async (eventId) => {
    if (window.confirm(t('adminEvents.confirmApprove'))) {
      await approveMutation.mutateAsync(eventId)
    }
  }

  const handleReject = async (eventId, isApproved = false) => {
    if (isApproved && !window.confirm(t('adminEvents.confirmRejectApproved'))) return
    const reason = prompt(t('adminEvents.rejectReason'))
    if (reason !== null) {
      await rejectMutation.mutateAsync({ eventId, reason })
    }
  }

  const handlePromoteWaitlist = async (eventId) => {
    const count = prompt(t('adminEvents.promoteCount'), '1')
    if (count && !isNaN(count)) {
      await promoteWaitlistMutation.mutateAsync({ eventId, count: parseInt(count) })
    }
  }

  const [hostModalMember, setHostModalMember] = useState(null)

  // Admin still keeps the full members list for the organizer <select>, so the
  // pre-fetched roster doubles as the host-modal source.
  const getOrganizer = (organizerId) => members.find(m => m.id === organizerId)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (isSubmitting) return
    setIsSubmitting(true)
    const formData = new FormData(e.target)
    const linkedAmenityId = formData.get('linkedAmenityId')
    const eventDate = parseHubDateTime(formData.get('date'))

    if (linkAmenity && linkedAmenityId) {
      const duration = parseInt(formData.get('duration')) || 60
      if (!validateEventHallDate(formData.get('date'), duration)) {
        setIsSubmitting(false)
        return
      }
    }

    const data = buildEventData({ formData, eventDate, isCreateMode, members, linkAmenity, linkedAmenityId })
    const ctx = { bannerInputRef, t, setIsSubmitting, createMutation, updateMutation, selectedEvent }

    if (isCreateMode) {
      await submitCreateEvent(data, ctx)
    } else {
      await submitUpdateEvent(data, ctx)
    }
  }

  // Filter events based on active tab
  const getFilteredEvents = () => {
    switch (activeTab) {
      case 'pending':
        return pendingEvents
      case 'approved':
        return allEvents.filter(e => e.status === 'approved')
      default:
        return allEvents
    }
  }

  const filteredEvents = getFilteredEvents()

  if (isLoading) {
    return (
      <Layout isAdmin>
        <div className="container">
          <div className="spinner"></div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout isAdmin>
      <div className="container">
        <div className="page-header">
          <h1 className="page-title">{t('adminEvents.title')}</h1>
          <button className="btn btn-primary" onClick={handleCreate}>
            {t('adminEvents.createEvent')}
          </button>
        </div>

        {/* Pending Events Alert */}
        {pendingEvents.length > 0 && (
          <div className="pending-alert glass">
            <span className="alert-icon">⏳</span>
            <span>{t('adminEvents.pendingAlert', { count: pendingEvents.length })}</span>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="tabs">
          <button
            className={`tab ${activeTab === 'pending' ? 'active' : ''}`}
            onClick={() => setActiveTab('pending')}
          >
            {t('adminEvents.tabPending')} ({pendingEvents.length})
          </button>
          <button
            className={`tab ${activeTab === 'approved' ? 'active' : ''}`}
            onClick={() => setActiveTab('approved')}
          >
            {t('adminEvents.tabApproved')} ({allEvents.filter(e => e.status === 'approved').length})
          </button>
          <button
            className={`tab ${activeTab === 'all' ? 'active' : ''}`}
            onClick={() => setActiveTab('all')}
          >
            {t('adminEvents.tabAll')} ({allEvents.length})
          </button>
        </div>

        <div className="events-grid">
          {filteredEvents.length > 0 ? (
            filteredEvents.map(event => (
              <EventCard
                key={event.id}
                event={event}
                t={t}
                amenities={amenities}
                projects={projects}
                onShowHost={() => setHostModalMember(getOrganizer(event.organizerId))}
                onApprove={handleApprove}
                onReject={handleReject}
                onPromoteWaitlist={handlePromoteWaitlist}
                onEdit={handleEdit}
                onDelete={handleDelete}
                approvePending={approveMutation.isPending}
                rejectPending={rejectMutation.isPending}
              />
            ))
          ) : (
            <p className="empty-state">{t('adminEvents.noEventsInCategory')}</p>
          )}
        </div>

        <EventFormModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false)
            resetForm()
          }}
          isCreateMode={isCreateMode}
          selectedEvent={selectedEvent}
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
          dateError={dateError}
          linkAmenity={linkAmenity}
          setLinkAmenity={setLinkAmenity}
          eventDuration={eventDuration}
          setEventDuration={setEventDuration}
          validateEventHallDate={validateEventHallDate}
          bannerInputRef={bannerInputRef}
          members={members}
          amenities={amenities}
          projects={projects}
          t={t}
        />

        <HostProfileModal member={hostModalMember} onClose={() => setHostModalMember(null)} />
      </div>
    </Layout>
  )
}

export default AdminEvents
