import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
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
import { getUnreadNotifications, markNotificationRead } from '../../services/notifications'
import { getMember } from '../../services/members'
import { getAmenities, validateEventSpaceTime } from '../../services/amenities'
import { getProjects } from '../../services/projects'
import { uploadEventBanner } from '../../services/storage'
import { showToast } from '../../components/Toast'
import { parseHubDateTime, formatEventDate, formatEventTime } from '../../utils/timezone'
import { useTranslation } from 'react-i18next'
import './Events.css'
import './Profile.css'

const MAX_EVENT_CAPACITY = 50

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

  if (eventsError) {
    console.error('Error loading upcoming events:', eventsError)
  }

  // Fetch my created events (all statuses)
  const { data: myEvents = [] } = useQuery({
    queryKey: ['myEvents', currentUser?.uid],
    queryFn: () => getMyEvents(currentUser?.uid),
    enabled: !!currentUser?.uid
  })

  // Fetch unread event-status notifications
  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications', currentUser?.uid],
    queryFn: () => getUnreadNotifications(currentUser?.uid),
    enabled: !!currentUser?.uid
  })

  useEffect(() => {
    if (notifications.length === 0) return
    notifications.forEach(n => {
      if (n.status === 'rejected') {
        const msg = n.rejectionReason
          ? t('memberEvents.eventRejectedWithReason', { title: n.eventTitle, reason: n.rejectionReason })
          : t('memberEvents.eventRejected', { title: n.eventTitle })
        showToast(msg, 'error')
      } else if (n.status === 'approved') {
        showToast(t('memberEvents.eventApproved', { title: n.eventTitle }), 'success')
      }
      markNotificationRead(n.id)
    })
    queryClient.invalidateQueries({ queryKey: ['notifications'] })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notifications.length])

  const { data: amenities = [] } = useQuery({
    queryKey: ['amenities'],
    queryFn: getAmenities
  })

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: getProjects
  })

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

  const registerMutation = useMutation({
    mutationFn: ({ eventId, memberId }) => registerForEvent(eventId, memberId),
    onSuccess: () => {
      queryClient.invalidateQueries(['approvedEvents'])
      queryClient.invalidateQueries(['upcomingEvents'])
      queryClient.invalidateQueries(['myEvents'])
      showToast(t('toast.eventRegisterSuccess'), 'success')
      
      // Reset ref and clean up query params after successful registration
      processedActionRef.current = null
      const newParams = new URLSearchParams(searchParams)
      newParams.delete('action')
      newParams.delete('eventId')
      setSearchParams(newParams, { replace: true })
    },
    onError: (error) => {
      console.error('Registration error:', error)
      showToast(t('toast.eventRegisterFailed'), 'error')
      
      // Reset ref and clean up query params even on error
      processedActionRef.current = null
      const newParams = new URLSearchParams(searchParams)
      newParams.delete('action')
      newParams.delete('eventId')
      setSearchParams(newParams, { replace: true })
    }
  })

  const unregisterMutation = useMutation({
    mutationFn: ({ eventId, memberId }) => unregisterFromEvent(eventId, memberId),
    onSuccess: () => {
      queryClient.invalidateQueries(['approvedEvents'])
      queryClient.invalidateQueries(['upcomingEvents'])
      queryClient.invalidateQueries(['myEvents'])
      showToast(t('toast.eventUnregisterSuccess'), 'success')
      
      // Reset ref and clean up query params
      processedActionRef.current = null
      const newParams = new URLSearchParams(searchParams)
      newParams.delete('action')
      newParams.delete('eventId')
      setSearchParams(newParams, { replace: true })
    },
    onError: () => {
      showToast(t('toast.eventUnregisterFailed'), 'error')
      processedActionRef.current = null
      const newParams = new URLSearchParams(searchParams)
      newParams.delete('action')
      newParams.delete('eventId')
      setSearchParams(newParams, { replace: true })
    }
  })

  const waitlistMutation = useMutation({
    mutationFn: ({ eventId, memberId }) => addToWaitlist(eventId, memberId),
    onSuccess: () => {
      queryClient.invalidateQueries(['approvedEvents'])
      queryClient.invalidateQueries(['upcomingEvents'])
      showToast(t('toast.waitlistJoined'), 'info')
      
      // Reset ref and clean up query params
      processedActionRef.current = null
      const newParams = new URLSearchParams(searchParams)
      newParams.delete('action')
      newParams.delete('eventId')
      setSearchParams(newParams, { replace: true })
    },
    onError: () => {
      showToast(t('toast.waitlistJoinFailed'), 'error')
      processedActionRef.current = null
      const newParams = new URLSearchParams(searchParams)
      newParams.delete('action')
      newParams.delete('eventId')
      setSearchParams(newParams, { replace: true })
    }
  })

  const removeWaitlistMutation = useMutation({
    mutationFn: ({ eventId, memberId }) => removeFromWaitlist(eventId, memberId),
    onSuccess: () => {
      queryClient.invalidateQueries(['approvedEvents'])
      queryClient.invalidateQueries(['upcomingEvents'])
      showToast(t('toast.waitlistRemoved'), 'info')
      
      // Reset ref and clean up query params
      processedActionRef.current = null
      const newParams = new URLSearchParams(searchParams)
      newParams.delete('action')
      newParams.delete('eventId')
      setSearchParams(newParams, { replace: true })
    },
    onError: () => {
      showToast(t('toast.waitlistRemoveFailed'), 'error')
      processedActionRef.current = null
      const newParams = new URLSearchParams(searchParams)
      newParams.delete('action')
      newParams.delete('eventId')
      setSearchParams(newParams, { replace: true })
    }
  })

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

    const rawCapacity = parseInt(formData.get('capacity'), 10)
    const capacity = Number.isNaN(rawCapacity)
      ? MAX_EVENT_CAPACITY
      : Math.min(Math.max(rawCapacity, 1), MAX_EVENT_CAPACITY)

    const data = {
      title: formData.get('title'),
      description: formData.get('description'),
      date: eventDate.toISOString(),
      capacity,
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
    if (linkAmenity && linkedAmenityId) {
      data.requestedAmenityId = linkedAmenityId
      data.amenityNote = formData.get('amenityNote') || ''
    }

    createMutation.mutate(data)
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

  const isRegistered = (event) => {
    return event.attendees?.includes(currentUser?.uid) || false
  }

  const isFull = (event) => {
    return event.capacity && event.attendees?.length >= event.capacity
  }

  const isOnWaitlist = (event) => {
    return event.waitlist?.includes(currentUser?.uid) || false
  }

  const getWaitlistPosition = (event) => {
    if (!event.waitlist || !isOnWaitlist(event)) return null
    return event.waitlist.indexOf(currentUser?.uid) + 1
  }

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
  }, [searchParams, currentUser?.uid])

  // Handle redirect actions from public Events page or Home page
  useEffect(() => {
    const action = searchParams.get('action')
    const eventId = searchParams.get('eventId')
    const actionKey = `${action}-${eventId}`
    
    // Skip if no action/eventId or no user (or if action is 'create' - handled above)
    if (!action || !eventId || !currentUser || action === 'create') {
      processedActionRef.current = null
      return
    }
    
    // Prevent duplicate processing of the same action
    if (processedActionRef.current === actionKey) {
      return
    }
    
    // Wait for data to be loaded - don't proceed if still loading
    if (isLoadingEvents) return
    
    // Try to find event in loaded data
    const event = upcomingEventsData.find(e => e.id === eventId) || approvedEvents.find(e => e.id === eventId)
    
    // If event not found and we have data loaded, event doesn't exist
    if (!event && (upcomingEventsData.length > 0 || approvedEvents.length > 0)) {
      processedActionRef.current = actionKey
      showToast(t('toast.eventNotFound'), 'error')
      const newParams = new URLSearchParams(searchParams)
      newParams.delete('action')
      newParams.delete('eventId')
      setSearchParams(newParams, { replace: true })
      return
    }
    
    // If event not found yet, wait for more data
    if (!event) return
    
    // Mark as processed to prevent duplicate calls
    processedActionRef.current = actionKey
    
    // Process the action
    if (action === 'register') {
      // Only register if not already registered
      if (!event.attendees?.includes(currentUser.uid)) {
        registerMutation.mutate({ eventId, memberId: currentUser.uid })
      } else {
        showToast(t('toast.alreadyRegistered'), 'info')
        const newParams = new URLSearchParams(searchParams)
        newParams.delete('action')
        newParams.delete('eventId')
        setSearchParams(newParams, { replace: true })
      }
    } else if (action === 'unregister') {
      if (window.confirm(t('memberEvents.confirmUnregister'))) {
        unregisterMutation.mutate({ eventId, memberId: currentUser.uid })
      } else {
        // User cancelled, reset ref and remove params
        processedActionRef.current = null
        const newParams = new URLSearchParams(searchParams)
        newParams.delete('action')
        newParams.delete('eventId')
        setSearchParams(newParams, { replace: true })
      }
    } else if (action === 'joinWaitlist') {
      if (!event.waitlist?.includes(currentUser.uid)) {
        waitlistMutation.mutate({ eventId, memberId: currentUser.uid })
      } else {
        showToast(t('toast.alreadyOnWaitlist'), 'info')
        const newParams = new URLSearchParams(searchParams)
        newParams.delete('action')
        newParams.delete('eventId')
        setSearchParams(newParams, { replace: true })
      }
    } else if (action === 'leaveWaitlist') {
      removeWaitlistMutation.mutate({ eventId, memberId: currentUser.uid })
    } else {
      // Unknown action, remove params
      const newParams = new URLSearchParams(searchParams)
      newParams.delete('action')
      newParams.delete('eventId')
      setSearchParams(newParams, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.toString(), currentUser?.uid, isLoadingEvents, upcomingEventsData.length, approvedEvents.length])

  const getStatusBadge = (status) => {
    const statusClasses = {
      pending: 'status-badge pending',
      approved: 'status-badge approved',
      rejected: 'status-badge rejected'
    }
    return statusClasses[status] || 'status-badge'
  }

  // Filter upcoming events by date (approved and pending)
  const upcomingEvents = upcomingEventsData.filter(e => {
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
        {myEvents.length > 0 && (
          <div className="events-section glass">
            <div className="section-header">
              <h2 className="section-title">{t('memberEvents.myEventRequests')}</h2>
              <p className="section-description">{t('memberEvents.myEventRequestsDesc')}</p>
            </div>
            <div className="events-grid">
              {myEvents.map(event => (
                <div key={event.id} className={`event-card my-event ${event.status}`}>
                  {event.bannerUrl && (
                    <div className="event-card-banner">
                      <img src={event.bannerUrl} alt="" loading="lazy" decoding="async" />
                    </div>
                  )}
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
                    {event.duration && (
                      <p className="event-duration">⏱️ {t('memberEvents.duration', { minutes: event.duration })}</p>
                    )}
                    <p className="event-capacity">
                      👥 {t('memberEvents.capacity', { count: event.capacity || 80 })}
                    </p>
                    {event.hostingProjects && (
                      <p className="event-projects">
                        🏢 {t('memberEvents.hosted', { hosts: typeof event.hostingProjects === 'string' 
                          ? event.hostingProjects 
                          : event.hostingProjects.map(projectId => {
                              const project = projects.find(p => p.id === projectId)
                              return project?.name || projectId
                            }).join(', ') })}
                      </p>
                    )}
                    {event.eventLink && (
                      <p className="event-link">
                        🔗 <a href={event.eventLink} target="_blank" rel="noopener noreferrer">{t('memberEvents.eventLink')}</a>
                      </p>
                    )}
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
                        onClick={() => handleDeleteMyEvent(event.id)}
                      >
                        {t('memberEvents.cancelRequest')}
                      </button>
                    )}
                    {event.status === 'approved' && (
                      <p className="event-approved-note">{t('memberEvents.eventLive')}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Upcoming Events (Approved) */}
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
              {upcomingEvents.map(event => {
                const registered = isRegistered(event)
                const full = isFull(event)
                const onWaitlist = isOnWaitlist(event)
                const waitlistPosition = getWaitlistPosition(event)
                const isMyEvent = event.organizerId === currentUser?.uid
                return (
                  <div key={event.id} className={`event-card ${isMyEvent ? 'my-event-approved' : ''}`}>
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
                        {isMyEvent && <span className="my-event-tag"> {t('memberEvents.organizerYou')}</span>}
                      </p>
                      {event.duration && (
                        <p className="event-duration">⏱️ {t('memberEvents.duration', { minutes: event.duration })}</p>
                      )}
                      <p className="event-capacity">
                        👥 {t('memberEvents.attendees', { current: event.attendees?.length || 0, total: event.capacity || 80 })}
                      </p>
                      {event.hostingProjects && (
                        <p className="event-projects">
                          🏢 {t('memberEvents.hosted', { hosts: typeof event.hostingProjects === 'string' 
                            ? event.hostingProjects 
                            : event.hostingProjects.map(projectId => {
                                const project = projects.find(p => p.id === projectId)
                                return project?.name || projectId
                              }).join(', ') })}
                        </p>
                      )}
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
                    <div className="event-actions">
                      {registered ? (
                        <button
                          className="btn btn-secondary btn-full-width"
                          onClick={() => handleUnregister(event.id)}
                        >
                          {t('memberEvents.registeredUnregister')}
                        </button>
                      ) : onWaitlist ? (
                        <button
                          className="btn btn-secondary btn-full-width"
                          onClick={() => handleLeaveWaitlist(event.id)}
                        >
                          {t('memberEvents.onWaitlistLeave')}
                        </button>
                      ) : (
                        <>
                          <button
                            className="btn btn-primary btn-full-width btn-large"
                            onClick={() => handleRegister(event.id)}
                            disabled={full}
                          >
                            {full ? t('memberEvents.eventFull') : t('memberEvents.registerForEvent')}
                          </button>
                          {full && (
                            <button
                              className="btn btn-secondary btn-full-width"
                              onClick={() => handleJoinWaitlist(event.id)}
                              style={{ marginTop: '0.5rem' }}
                            >
                              {t('memberEvents.joinWaitlist')}
                            </button>
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
              <p className="empty-state">{t('memberEvents.noUpcomingEvents')}</p>
              {approvedEvents.length > 0 && (
                <p className="empty-state" style={{ fontSize: '0.875rem', marginTop: '0.5rem', color: '#a1a1aa' }}>
                  {t('memberEvents.approvedButNoneUpcoming', { count: approvedEvents.length })}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Past Events */}
        <div className="events-section glass">
          <div className="section-header">
            <h2 className="section-title">{t('memberEvents.pastEvents')}</h2>
          </div>
          {pastEvents.length > 0 ? (
            <div className="events-grid">
              {pastEvents.map(event => {
                const registered = isRegistered(event)
                return (
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
                        <p className="event-duration">⏱️ {t('memberEvents.duration', { minutes: event.duration })}</p>
                      )}
                      {event.hostingProjects && (
                        <p className="event-projects">
                          🏢 {t('memberEvents.hosted', { hosts: typeof event.hostingProjects === 'string'
                            ? event.hostingProjects
                            : event.hostingProjects.map(projectId => {
                              const project = projects.find(p => p.id === projectId)
                              return project?.name || projectId
                            }).join(', ') })}
                        </p>
                      )}
                      {event.eventLink && (
                        <p className="event-link">
                          🔗 <a href={event.eventLink} target="_blank" rel="noopener noreferrer">{t('memberEvents.eventLink')}</a>
                        </p>
                      )}
                      {registered && (
                        <p className="event-attended">{t('memberEvents.attended')}</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="empty-state">{t('memberEvents.noPastEvents')}</p>
          )}
        </div>

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

        <Modal
          isOpen={!!hostModalMember}
          onClose={() => setHostModalMember(null)}
          title={hostModalMember?.displayName || t('memberEvents.host')}
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
                <h3 className="profile-section-title">Contact</h3>
                {hostModalMember.email && (
                  <div className="profile-detail-item">
                    <span className="detail-label">Email</span>
                    <span className="detail-value">
                      <a href={`mailto:${hostModalMember.email}`} className="profile-link">
                        {hostModalMember.email}
                      </a>
                    </span>
                  </div>
                )}
                {hostModalMember.phone && (
                  <div className="profile-detail-item">
                    <span className="detail-label">Phone</span>
                    <span className="detail-value">
                      <a href={`tel:${hostModalMember.phone}`} className="profile-link">
                        {hostModalMember.phone}
                      </a>
                    </span>
                  </div>
                )}
                {!hostModalMember.email && !hostModalMember.phone && (
                  <div className="profile-detail-item">
                    <span className="detail-value">—</span>
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

export default MemberEvents
