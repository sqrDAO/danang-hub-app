import { useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Layout from '../../components/Layout'
import Modal from '../../components/Modal'
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
import { getAmenities } from '../../services/amenities'
import { getProjects } from '../../services/projects'
import { createBooking } from '../../services/bookings'
import { uploadEventBanner } from '../../services/storage'
import { showToast } from '../../components/Toast'
import { parseHubDateTime, toDatetimeLocalHub, formatEventDate, formatEventTime } from '../../utils/timezone'
import './Events.css'

const AdminEvents = () => {
  const { t } = useTranslation()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isCreateMode, setIsCreateMode] = useState(true)
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [linkAmenity, setLinkAmenity] = useState(false)
  const [activeTab, setActiveTab] = useState('pending') // 'pending', 'approved', 'all'
  const bannerInputRef = useRef(null)
  const queryClient = useQueryClient()

  const { data: allEvents = [], isLoading } = useQuery({
    queryKey: ['events'],
    queryFn: getEvents
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

  const createMutation = useMutation({
    mutationFn: async (data) => {
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
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] })
      queryClient.invalidateQueries({ queryKey: ['pendingEvents'] })
      queryClient.invalidateQueries({ queryKey: ['approvedEvents'] })
      queryClient.invalidateQueries({ queryKey: ['upcomingEvents'] })
      queryClient.invalidateQueries({ queryKey: ['myEvents'] })
      queryClient.invalidateQueries({ queryKey: ['bookings'] })
      setIsModalOpen(false)
      resetForm()
      showToast(t('toast.eventCreated'), 'success')
    },
    onError: () => {
      showToast(t('toast.eventCreateFailed'), 'error')
    }
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => updateEvent(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] })
      queryClient.invalidateQueries({ queryKey: ['pendingEvents'] })
      queryClient.invalidateQueries({ queryKey: ['upcomingEvents'] })
      queryClient.invalidateQueries({ queryKey: ['approvedEvents'] })
      setIsModalOpen(false)
      resetForm()
      showToast(t('toast.eventUpdated'), 'success')
    },
    onError: () => {
      showToast(t('toast.eventUpdateFailed'), 'error')
    }
  })

  const approveMutation = useMutation({
    mutationFn: async (eventId) => {
      const event = allEvents.find(e => e.id === eventId) || pendingEvents.find(e => e.id === eventId)
      await approveEvent(eventId)
      
      // If amenity was requested, create booking
      if (event?.requestedAmenityId) {
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
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] })
      queryClient.invalidateQueries({ queryKey: ['pendingEvents'] })
      queryClient.invalidateQueries({ queryKey: ['approvedEvents'] })
      queryClient.invalidateQueries({ queryKey: ['myEvents'] })
      queryClient.invalidateQueries({ queryKey: ['upcomingEvents'] })
      queryClient.invalidateQueries({ queryKey: ['bookings'] })
      showToast(t('toast.eventApproved'), 'success')
    },
    onError: () => {
      showToast(t('toast.eventApproveFailed'), 'error')
    }
  })

  const rejectMutation = useMutation({
    mutationFn: ({ eventId, reason }) => rejectEvent(eventId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] })
      queryClient.invalidateQueries({ queryKey: ['pendingEvents'] })
      queryClient.invalidateQueries({ queryKey: ['myEvents'] })
      queryClient.invalidateQueries({ queryKey: ['upcomingEvents'] })
      showToast(t('toast.eventRejected'), 'info')
    },
    onError: () => {
      showToast(t('toast.eventRejectFailed'), 'error')
    }
  })

  const promoteWaitlistMutation = useMutation({
    mutationFn: ({ eventId, count }) => promoteFromWaitlist(eventId, count),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['events'] })
      queryClient.invalidateQueries({ queryKey: ['upcomingEvents'] })
      queryClient.invalidateQueries({ queryKey: ['approvedEvents'] })
      showToast(t('toast.waitlistPromoted', { count: result.promoted }), 'success')
    },
    onError: () => {
      showToast(t('toast.waitlistPromoteFailed'), 'error')
    }
  })

  const deleteMutation = useMutation({
    mutationFn: deleteEvent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] })
      queryClient.invalidateQueries({ queryKey: ['pendingEvents'] })
      queryClient.invalidateQueries({ queryKey: ['upcomingEvents'] })
      queryClient.invalidateQueries({ queryKey: ['approvedEvents'] })
      showToast(t('toast.eventDeleted'), 'success')
    }
  })

  const resetForm = () => {
    setSelectedEvent(null)
    setIsCreateMode(true)
    setLinkAmenity(false)
    if (bannerInputRef.current) {
      bannerInputRef.current.value = ''
    }
  }

  const handleCreate = () => {
    setIsCreateMode(true)
    setSelectedEvent(null)
    setLinkAmenity(true)
    setIsModalOpen(true)
  }

  const handleEdit = (event) => {
    setIsCreateMode(false)
    setSelectedEvent(event)
    setLinkAmenity(!!event.linkedAmenityId)
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

  const handleReject = async (eventId) => {
    const reason = prompt(t('adminEvents.rejectReason'))
    if (reason !== null) { // User clicked OK (even if empty)
      await rejectMutation.mutateAsync({ eventId, reason })
    }
  }

  const handlePromoteWaitlist = async (eventId) => {
    const count = prompt(t('adminEvents.promoteCount'), '1')
    if (count && !isNaN(count)) {
      await promoteWaitlistMutation.mutateAsync({ eventId, count: parseInt(count) })
    }
  }

  const getOrganizerName = (organizerId) => {
    const organizer = members.find(m => m.id === organizerId)
    return organizer?.displayName || organizer?.email || organizerId
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const formData = new FormData(e.target)
    const linkedAmenityId = formData.get('linkedAmenityId')
    const eventDate = parseHubDateTime(formData.get('date'))

    const data = {
      title: formData.get('title'),
      description: formData.get('description'),
      date: eventDate.toISOString(),
      capacity: parseInt(formData.get('capacity')) || 80,
      duration: parseInt(formData.get('duration')) || 60, // Duration in minutes
      organizerId: formData.get('organizerId'),
      waitlist: []
    }

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

    // Handle amenity linking
    if (linkAmenity && linkedAmenityId) {
      const duration = data.duration || 60
      const startTime = new Date(eventDate)
      startTime.setHours(startTime.getHours() - 1) // 1 hour before event
      const endTime = new Date(eventDate)
      endTime.setMinutes(endTime.getMinutes() + duration + 60) // Duration + 1 hour buffer after event
      
      data.linkedAmenityId = linkedAmenityId
      data.linkedAmenityStartTime = startTime.toISOString()
      data.linkedAmenityEndTime = endTime.toISOString()
    }

    if (isCreateMode) {
      const bannerFile = bannerInputRef.current?.files?.[0]
      if (!bannerFile) {
        showToast(t('toast.eventBannerRequired'), 'error')
        return
      }
      try {
        data.bannerUrl = await uploadEventBanner(bannerFile)
      } catch (err) {
        showToast(err.message || t('toast.eventBannerUploadFailed'), 'error')
        return
      }
      createMutation.mutate(data)
    } else {
      const bannerFile = bannerInputRef.current?.files?.[0]
      if (bannerFile) {
        try {
          data.bannerUrl = await uploadEventBanner(bannerFile)
        } catch (err) {
          showToast(err.message || t('toast.eventBannerUploadFailed'), 'error')
          return
        }
      } else if (selectedEvent?.bannerUrl) {
        data.bannerUrl = selectedEvent.bannerUrl
      }
      updateMutation.mutate({ id: selectedEvent.id, data })
    }
  }

  const getStatusBadge = (status) => {
    const statusClasses = {
      pending: 'status-badge pending',
      approved: 'status-badge approved',
      rejected: 'status-badge rejected'
    }
    return statusClasses[status] || 'status-badge'
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
              <div key={event.id} className={`event-card glass ${event.status}`}>
                {event.bannerUrl && (
                  <div className="event-card-banner">
                    <img src={event.bannerUrl} alt="" />
                  </div>
                )}
                <div className="event-header">
                  <h3 className="event-title">{event.title}</h3>
                  <span className={getStatusBadge(event.status || 'approved')}>
                    {t(`status.${event.status || 'approved'}`)}
                  </span>
                </div>
                <div className="event-info">
                  <p className="event-date">
                    📅 {formatEventDate(event.date)} at {formatEventTime(event.date)}
                  </p>
                  <p className="event-organizer">
                    👤 {t('adminEvents.organizer', { name: getOrganizerName(event.organizerId) })}
                  </p>
                  {event.duration && (
                    <p className="event-duration">⏱️ {t('adminEvents.duration', { minutes: event.duration })}</p>
                  )}
                  <p className="event-capacity">
                    👥 {event.attendees?.length || 0} / {event.capacity || 80}
                  </p>
                  {event.hostingProjects && (
                    <p className="event-projects">
                      🏢 {t('adminEvents.hosted', { hosts: typeof event.hostingProjects === 'string' 
? event.hostingProjects
                        : event.hostingProjects.map(projectId => {
                            const project = projects.find(p => p.id === projectId)
                            return project?.name || projectId
                          }).join(', ') })}
                    </p>
                  )}
                  {event.waitlist && event.waitlist.length > 0 && (
                    <p className="event-waitlist">
                      ⏳ {t('adminEvents.waitlist', { count: event.waitlist.length })}
                    </p>
                  )}
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
                  {event.eventLink && (
                    <p className="event-link">
                      🔗 <a href={event.eventLink} target="_blank" rel="noopener noreferrer">{t('adminEvents.eventLink')}</a>
                    </p>
                  )}
                  {event.description && (
                    <p className="event-description">{event.description}</p>
                  )}
                </div>
                <div className="event-actions">
                  {event.status === 'pending' && (
                    <>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => handleApprove(event.id)}
                        disabled={approveMutation.isPending}
                      >
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                          <span>✓</span>
                          <span>{t('common.approve')}</span>
                        </span>
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleReject(event.id)}
                        disabled={rejectMutation.isPending}
                      >
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                          <span>✗</span>
                          <span>{t('common.reject')}</span>
                        </span>
                      </button>
                    </>
                  )}
                  {event.status === 'approved' && event.waitlist && event.waitlist.length > 0 && (
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => handlePromoteWaitlist(event.id)}
                    >
                      {t('adminEvents.promoteWaitlist')}
                    </button>
                  )}
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleEdit(event)}
                  >
                    {t('common.edit')}
                  </button>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => handleDelete(event.id)}
                  >
                    {t('common.delete')}
                  </button>
                </div>
              </div>
            ))
          ) : (
            <p className="empty-state">{t('adminEvents.noEventsInCategory')}</p>
          )}
        </div>

        <Modal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false)
            resetForm()
          }}
          title={isCreateMode ? t('adminEvents.modal.createTitle') : t('adminEvents.modal.editTitle')}
        >
          <form onSubmit={handleSubmit}>
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
            <div className="form-group">
              <label className="form-label">{t('adminEvents.modal.dateTimeLabel')}</label>
              <input
                type="datetime-local"
                name="date"
                className="form-field"
                defaultValue={selectedEvent?.date ? toDatetimeLocalHub(selectedEvent.date) : ''}
                required
              />
              {linkAmenity && (
                <small className="form-hint">{t('adminEvents.modal.depositRequired')}</small>
              )}
            </div>
            <div className="form-group">
              <label className="form-label">{t('adminEvents.modal.durationLabel')}</label>
              <input
                type="number"
                name="duration"
                className="form-field"
                placeholder={t('adminEvents.modal.durationPlaceholder')}
                defaultValue={selectedEvent?.duration || 60}
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
                defaultValue={selectedEvent?.capacity || 80}
                min="1"
                max="80"
                required
              />
              <small className="form-hint">{t('adminEvents.modal.capacityHint')}</small>
            </div>
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
                  <p><strong>{t('adminEvents.modal.eventHallNotice')}</strong> {t('adminEvents.modal.eventHallDeposit')}</p>
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
            <div className="form-actions">
              <button type="submit" className="btn btn-primary">
                {isCreateMode ? t('common.create') : t('common.save')}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setIsModalOpen(false)
                  resetForm()
                }}
              >
                {t('common.cancel')}
              </button>
            </div>
          </form>
        </Modal>
      </div>
    </Layout>
  )
}

export default AdminEvents
