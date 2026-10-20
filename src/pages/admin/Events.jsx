import { useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation } from '@tanstack/react-query'
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
  getEvents,
  getPendingEvents,
  createEvent,
  updateEvent,
  deleteEvent,
  promoteFromWaitlist
} from '../../services/events'
import { getMembers } from '../../services/members'
import { getAmenities } from '../../services/amenities'
import { reviewEvent } from '../../services/functions'
import { uploadEventBanner } from '../../services/storage'
import { showToast } from '../../utils/toast'
import { isPendingFor } from '../../utils/mutationTarget'
import { parseHubDateTime } from '../../utils/timezone'
import './Events.css'
import '../member/Profile.css'

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

// On create, pre-fill denormalized organizer fields from the already-loaded
// members list so createEvent doesn't need to round-trip Firestore. On
// update, leave them off — updateEvent re-fetches when organizerId changes.
const applyOrganizerDenorm = (data, members) => {
  const organizer = members.find(m => m.id === data.organizerId)
  if (!organizer) return
  data.organizerDisplayName = organizer.displayName || null
  data.organizerPhotoURL = organizer.photoURL || null
}

const buildEventData = ({ formData, eventDate, isCreateMode, members, linkAmenity }) => {
  const data = { ...getEventFormPayload(formData, eventDate, linkAmenity), organizerId: formData.get('organizerId') }
  if (isCreateMode) {
    data.waitlist = []
    applyOrganizerDenorm(data, members)
  }
  return data
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
    queryKey: ['events', 'admin-list'],
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

  return { allEvents, pendingEvents, members, amenities, isLoading }
}

const useAdminEventMutations = ({ t, setIsModalOpen, resetForm, setIsSubmitting }) => {
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
    mutationFn: (data) => createEvent({ ...data, status: 'approved' }),
    onSuccess: () => {
      invalidate('events', 'pendingEvents', 'approvedEvents', 'upcomingEvents', 'myEvents')
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
    mutationFn: (payload) => reviewEvent({ ...payload, action: 'approved' }),
    onSuccess: () => {
      invalidate('events', 'pendingEvents', 'approvedEvents', 'myEvents', 'upcomingEvents')
      showToast(t('toast.eventApproved'), 'success')
    },
    onError: () => {
      showToast(t('toast.eventApproveFailed'), 'error')
    }
  })

  const rejectMutation = useMutation({
    mutationFn: (payload) => reviewEvent({ ...payload, action: 'rejected' }),
    onSuccess: () => {
      invalidate('events', 'pendingEvents', 'approvedEvents', 'myEvents', 'upcomingEvents')
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

const EventCardActions = ({
  event,
  t,
  onApprove,
  onReject,
  onPromoteWaitlist,
  onEdit,
  onDelete,
  approvePending,
  rejectPending,
  promotePending,
  deletePending,
}) => (
  <div className="event-actions">
    {event.status === 'pending' && (
      <>
        <button
          className="btn btn-primary btn-sm"
          onClick={() => onApprove(event)}
          disabled={approvePending}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
            <span>✓</span>
            <span>{t('common.approve')}</span>
          </span>
        </button>
        <button
          className="btn btn-danger btn-sm"
          onClick={() => onReject(event)}
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
            disabled={promotePending}
          >
            {t('adminEvents.promoteWaitlist')}
          </button>
        )}
        <button
          className="btn btn-danger btn-sm"
          onClick={() => onReject(event, true)}
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
      disabled={deletePending}
    >
      {t('common.delete')}
    </button>
  </div>
)

const AdminEventCard = ({ event, t, onShowHost, onOpenDetails, ...actionProps }) => (
  <EventCard
    event={event}
    view="admin"
    onOpen={onOpenDetails}
    onShowHost={onShowHost}
    actions={<EventCardActions event={event} t={t} {...actionProps} />}
  />
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
  const [activeTab, setActiveTab] = useState('pending') // 'pending', 'approved', 'all'
  const [isSubmitting, setIsSubmitting] = useState(false)
  const bannerInputRef = useRef(null)
  const { allEvents, pendingEvents, members, amenities, isLoading } = useAdminEventsData()
  const {
    linkAmenity, eventDuration, dateError,
    checkEventHall, setEventHallRequest, changeEventDuration, resetEventHallCheck
  } = useEventHallCheck(t, amenities)

  const resetForm = () => {
    setSelectedEvent(null)
    setIsCreateMode(true)
    resetEventHallCheck()
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
  } = useAdminEventMutations({ t, setIsModalOpen, resetForm, setIsSubmitting })

  const handleCreate = () => {
    setIsCreateMode(true)
    setSelectedEvent(null)
    resetEventHallCheck(true)
    setIsModalOpen(true)
  }

  const handleEdit = (event) => {
    setIsCreateMode(false)
    setSelectedEvent(event)
    resetEventHallCheck(Boolean(getEventVenueId(event)), event.duration || 60)
    setIsModalOpen(true)
  }

  const handleDelete = async (id) => {
    if (isPendingFor(deleteMutation, id)) return
    if (window.confirm(t('adminEvents.confirmDelete'))) {
      await deleteMutation.mutateAsync(id)
    }
  }

  const handleApprove = async (event) => {
    if (isPendingFor(approveMutation, event.id)) return
    if (window.confirm(t('adminEvents.confirmApprove'))) {
      await approveMutation.mutateAsync({ eventId: event.id, expectedRevision: event.revision || 1 })
    }
  }

  const handleReject = async (event, isApproved = false) => {
    if (isPendingFor(rejectMutation, event.id)) return
    if (isApproved && !window.confirm(t('adminEvents.confirmRejectApproved'))) return
    const reason = prompt(t('adminEvents.rejectReason'))
    if (reason !== null) {
      await rejectMutation.mutateAsync({
        eventId: event.id,
        expectedRevision: event.revision || 1,
        reason
      })
    }
  }

  const handlePromoteWaitlist = async (eventId) => {
    if (isPendingFor(promoteWaitlistMutation, eventId)) return
    const count = prompt(t('adminEvents.promoteCount'), '1')
    if (count && !isNaN(count)) {
      await promoteWaitlistMutation.mutateAsync({ eventId, count: parseInt(count) })
    }
  }

  const [hostModalMember, setHostModalMember] = useState(null)
  const [detailEvent, setDetailEvent] = useState(null)

  // Admin still keeps the full members list for the organizer <select>, so the
  // pre-fetched roster doubles as the host-modal source.
  const getOrganizer = (organizerId) => members.find(m => m.id === organizerId)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (isSubmitting) return
    setIsSubmitting(true)
    const formData = new FormData(e.target)
    const eventDate = parseHubDateTime(formData.get('date'))

    if (!checkEventHall(e.target)) {
      setIsSubmitting(false)
      return
    }

    const data = buildEventData({ formData, eventDate, isCreateMode, members, linkAmenity })
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
              <AdminEventCard
                key={event.id}
                event={event}
                t={t}
                onShowHost={() => setHostModalMember(getOrganizer(event.organizerId))}
                onOpenDetails={setDetailEvent}
                onApprove={handleApprove}
                onReject={handleReject}
                onPromoteWaitlist={handlePromoteWaitlist}
                onEdit={handleEdit}
                onDelete={handleDelete}
                approvePending={isPendingFor(approveMutation, event.id)}
                rejectPending={isPendingFor(rejectMutation, event.id)}
                promotePending={isPendingFor(promoteWaitlistMutation, event.id)}
                deletePending={isPendingFor(deleteMutation, event.id)}
              />
            ))
          ) : (
            <p className="empty-state">{t('adminEvents.noEventsInCategory')}</p>
          )}
        </div>

        <EventFormModal
          isModalOpen={isModalOpen}
          editingEvent={selectedEvent}
          linkAmenity={linkAmenity}
          prefillAmenityId={null}
          amenities={amenities}
          members={members}
          isAdmin
          dateError={dateError}
          eventDuration={eventDuration}
          changeEventDuration={changeEventDuration}
          checkEventHall={checkEventHall}
          bannerInputRef={bannerInputRef}
          isSubmitting={isSubmitting}
          setEventHallRequest={setEventHallRequest}
          resetEventModal={() => {
            setIsModalOpen(false)
            resetForm()
          }}
          handleSubmit={handleSubmit}
          t={t}
        />

        <EventDetailModal
          event={detailEvent}
          onClose={() => setDetailEvent(null)}
          amenities={amenities}
          onShowHost={(organizerId) => setHostModalMember(getOrganizer(organizerId))}
          view="admin"
        />

        <HostProfileModal member={hostModalMember} onClose={() => setHostModalMember(null)} />
      </div>
    </Layout>
  )
}

export default AdminEvents
