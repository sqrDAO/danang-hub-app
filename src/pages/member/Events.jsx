import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import Layout from '../../components/Layout'
import Modal from '../../components/Modal'
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
import { getMembers } from '../../services/members'
import { getAmenities } from '../../services/amenities'
import { getProjects } from '../../services/projects'
import { showToast } from '../../components/Toast'
import './Events.css'

const MemberEvents = () => {
  const { currentUser } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [linkAmenity, setLinkAmenity] = useState(false)
  const [prefillAmenityId, setPrefillAmenityId] = useState(null)
  const [dateError, setDateError] = useState(null)
  const processedActionRef = useRef(null)

  const validateEventHallDate = (dateValue) => {
    if (!linkAmenity || !dateValue) {
      setDateError(null)
      return true
    }
    const eventDate = new Date(dateValue)
    const twoWeeksFromNow = new Date()
    twoWeeksFromNow.setDate(twoWeeksFromNow.getDate() + 14)
    twoWeeksFromNow.setHours(0, 0, 0, 0)
    if (eventDate < twoWeeksFromNow) {
      setDateError('Event Hall must be booked at least 2 weeks in advance.')
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

  // Debug logging
  if (eventsError) {
    console.error('Error loading upcoming events:', eventsError)
  }
  if (upcomingEventsData.length > 0) {
    console.log('Upcoming events loaded:', upcomingEventsData.length, upcomingEventsData)
  }

  // Fetch my created events (all statuses)
  const { data: myEvents = [] } = useQuery({
    queryKey: ['myEvents', currentUser?.uid],
    queryFn: () => getMyEvents(currentUser?.uid),
    enabled: !!currentUser?.uid
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
    mutationFn: createEvent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myEvents'] })
      queryClient.invalidateQueries({ queryKey: ['approvedEvents'] })
      queryClient.invalidateQueries({ queryKey: ['pendingEvents'] })
      queryClient.invalidateQueries({ queryKey: ['upcomingEvents'] })
      setIsModalOpen(false)
      showToast('Event submitted for approval! You will be notified when approved.', 'success')
    },
    onError: () => {
      showToast('Failed to create event. Please try again.', 'error')
    }
  })

  const deleteMutation = useMutation({
    mutationFn: deleteEvent,
    onSuccess: () => {
      queryClient.invalidateQueries(['myEvents'])
      showToast('Event request deleted.', 'success')
    },
    onError: () => {
      showToast('Failed to delete event. Please try again.', 'error')
    }
  })

  const registerMutation = useMutation({
    mutationFn: ({ eventId, memberId }) => registerForEvent(eventId, memberId),
    onSuccess: () => {
      queryClient.invalidateQueries(['approvedEvents'])
      queryClient.invalidateQueries(['upcomingEvents'])
      queryClient.invalidateQueries(['myEvents'])
      showToast('Successfully registered for event!', 'success')
      
      // Reset ref and clean up query params after successful registration
      processedActionRef.current = null
      const newParams = new URLSearchParams(searchParams)
      newParams.delete('action')
      newParams.delete('eventId')
      setSearchParams(newParams, { replace: true })
    },
    onError: (error) => {
      console.error('Registration error:', error)
      showToast('Failed to register. Please try again.', 'error')
      
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
      showToast('Successfully unregistered from event.', 'success')
      
      // Reset ref and clean up query params
      processedActionRef.current = null
      const newParams = new URLSearchParams(searchParams)
      newParams.delete('action')
      newParams.delete('eventId')
      setSearchParams(newParams, { replace: true })
    },
    onError: () => {
      showToast('Failed to unregister. Please try again.', 'error')
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
      showToast('Added to waitlist! You will be notified if a spot becomes available.', 'info')
      
      // Reset ref and clean up query params
      processedActionRef.current = null
      const newParams = new URLSearchParams(searchParams)
      newParams.delete('action')
      newParams.delete('eventId')
      setSearchParams(newParams, { replace: true })
    },
    onError: () => {
      showToast('Failed to join waitlist. Please try again.', 'error')
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
      showToast('Removed from waitlist.', 'info')
      
      // Reset ref and clean up query params
      processedActionRef.current = null
      const newParams = new URLSearchParams(searchParams)
      newParams.delete('action')
      newParams.delete('eventId')
      setSearchParams(newParams, { replace: true })
    },
    onError: () => {
      showToast('Failed to remove from waitlist. Please try again.', 'error')
      processedActionRef.current = null
      const newParams = new URLSearchParams(searchParams)
      newParams.delete('action')
      newParams.delete('eventId')
      setSearchParams(newParams, { replace: true })
    }
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    const formData = new FormData(e.target)
    const eventDate = new Date(formData.get('date'))
    const linkedAmenityId = formData.get('linkedAmenityId')

    // Event hall must be booked at least 2 weeks in advance
    if (linkAmenity && linkedAmenityId) {
      const requestedAmenity = amenities.find(a => a.id === linkedAmenityId)
      if (requestedAmenity?.type === 'event-space') {
        const twoWeeksFromNow = new Date()
        twoWeeksFromNow.setDate(twoWeeksFromNow.getDate() + 14)
        twoWeeksFromNow.setHours(0, 0, 0, 0)
        if (eventDate < twoWeeksFromNow) {
          showToast('Event Hall must be booked at least 2 weeks in advance.', 'error')
          return
        }
      }
    }

    const data = {
      title: formData.get('title'),
      description: formData.get('description'),
      date: formData.get('date'),
      capacity: parseInt(formData.get('capacity')) || 80,
      duration: parseInt(formData.get('duration')) || 60, // Duration in minutes
      organizerId: currentUser.uid,
      status: 'pending',
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
    if (window.confirm('Are you sure you want to delete this event request?')) {
      await deleteMutation.mutateAsync(eventId)
    }
  }

  const getOrganizerName = (organizerId) => {
    const organizer = members.find(m => m.id === organizerId)
    return organizer?.displayName || organizerId
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
    if (window.confirm('Are you sure you want to unregister from this event?')) {
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
      showToast('Event not found', 'error')
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
        showToast('You are already registered for this event', 'info')
        const newParams = new URLSearchParams(searchParams)
        newParams.delete('action')
        newParams.delete('eventId')
        setSearchParams(newParams, { replace: true })
      }
    } else if (action === 'unregister') {
      if (window.confirm('Are you sure you want to unregister from this event?')) {
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
        showToast('You are already on the waitlist for this event', 'info')
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
            <h1 className="page-title">Events</h1>
            <p className="page-subtitle">Browse, register, or create your own events</p>
          </div>
          <button className="btn btn-primary" onClick={handleOpenCreateModal}>
            + Create Event
          </button>
        </div>

        {/* My Created Events */}
        {myEvents.length > 0 && (
          <div className="events-section glass">
            <div className="section-header">
              <h2 className="section-title">My Event Requests</h2>
              <p className="section-description">Events you've created. Pending events await admin approval.</p>
            </div>
            <div className="events-grid">
              {myEvents.map(event => (
                <div key={event.id} className={`event-card my-event ${event.status}`}>
                  <div className="event-header">
                    <h3 className="event-title">{event.title}</h3>
                    <span className={getStatusBadge(event.status)}>
                      {event.status}
                    </span>
                  </div>
                  <div className="event-info">
                    <p className="event-date">
                      📅 {event.date?.toLocaleDateString()} at {event.date?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                    {event.duration && (
                      <p className="event-duration">⏱️ Duration: {event.duration} minutes</p>
                    )}
                    <p className="event-capacity">
                      👥 Capacity: {event.capacity || 80}
                    </p>
                    {event.hostingProjects && (
                      <p className="event-projects">
                        🏢 Hosted by: {typeof event.hostingProjects === 'string' 
                          ? event.hostingProjects 
                          : event.hostingProjects.map(projectId => {
                              const project = projects.find(p => p.id === projectId)
                              return project?.name || projectId
                            }).join(', ')}
                      </p>
                    )}
                    {event.eventLink && (
                      <p className="event-link">
                        🔗 <a href={event.eventLink} target="_blank" rel="noopener noreferrer">Event Link</a>
                      </p>
                    )}
                    {event.status === 'rejected' && event.rejectionReason && (
                      <p className="event-rejection-reason">
                        ❌ Reason: {event.rejectionReason}
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
                        Cancel Request
                      </button>
                    )}
                    {event.status === 'approved' && (
                      <p className="event-approved-note">✅ Your event is live!</p>
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
            <h2 className="section-title">Upcoming Events</h2>
            {upcomingEvents.length > 0 && (
              <p className="section-description">Click "Register" to join an event. If full, join the waitlist!</p>
            )}
          </div>
          {isLoadingEvents ? (
            <p className="empty-state">Loading events...</p>
          ) : eventsError ? (
            <p className="empty-state" style={{ color: '#ef4444' }}>
              Error loading events. Please refresh the page.
              {process.env.NODE_ENV === 'development' && (
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
                    <div className="event-header">
                      <h3 className="event-title">{event.title}</h3>
                      <span className="event-date-badge">
                        {event.date?.toLocaleDateString() || 'N/A'}
                      </span>
                    </div>
                    <div className="event-info">
                      <p className="event-organizer">
                        Organizer: {getOrganizerName(event.organizerId)}
                        {isMyEvent && <span className="my-event-tag"> (You)</span>}
                      </p>
                      {event.duration && (
                        <p className="event-duration">⏱️ Duration: {event.duration} minutes</p>
                      )}
                      <p className="event-capacity">
                        👥 {event.attendees?.length || 0} / {event.capacity || 80} attendees
                      </p>
                      {event.hostingProjects && (
                        <p className="event-projects">
                          🏢 Hosted by: {typeof event.hostingProjects === 'string' 
                            ? event.hostingProjects 
                            : event.hostingProjects.map(projectId => {
                                const project = projects.find(p => p.id === projectId)
                                return project?.name || projectId
                              }).join(', ')}
                        </p>
                      )}
                      {event.eventLink && (
                        <p className="event-link">
                          🔗 <a href={event.eventLink} target="_blank" rel="noopener noreferrer">Event Link</a>
                        </p>
                      )}
                      {event.waitlist && event.waitlist.length > 0 && (
                        <p className="event-waitlist">
                          {event.waitlist.length} on waitlist
                        </p>
                      )}
                      {waitlistPosition && (
                        <p className="event-waitlist-position">
                          Your position: #{waitlistPosition}
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
                          ✓ Registered - Click to Unregister
                        </button>
                      ) : onWaitlist ? (
                        <button
                          className="btn btn-secondary btn-full-width"
                          onClick={() => handleLeaveWaitlist(event.id)}
                        >
                          On Waitlist - Click to Leave
                        </button>
                      ) : (
                        <>
                          <button
                            className="btn btn-primary btn-full-width btn-large"
                            onClick={() => handleRegister(event.id)}
                            disabled={full}
                          >
                            {full ? 'Event Full' : '✓ Register for Event'}
                          </button>
                          {full && (
                            <button
                              className="btn btn-secondary btn-full-width"
                              onClick={() => handleJoinWaitlist(event.id)}
                              style={{ marginTop: '0.5rem' }}
                            >
                              Join Waitlist
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
              <p className="empty-state">No upcoming events. Why not create one?</p>
              {approvedEvents.length > 0 && (
                <p className="empty-state" style={{ fontSize: '0.875rem', marginTop: '0.5rem', color: '#a1a1aa' }}>
                  ({approvedEvents.length} approved event(s) found, but none are upcoming)
                </p>
              )}
            </div>
          )}
        </div>

        {/* Past Events */}
        <div className="events-section glass">
          <div className="section-header">
            <h2 className="section-title">Past Events</h2>
          </div>
          {pastEvents.length > 0 ? (
            <div className="events-grid">
              {pastEvents.map(event => {
                const registered = isRegistered(event)
                return (
                  <div key={event.id} className="event-card past-event">
                    <div className="event-header">
                      <h3 className="event-title">{event.title}</h3>
                      <span className="event-date-badge">
                        {event.date?.toLocaleDateString() || 'N/A'}
                      </span>
                    </div>
                    <div className="event-info">
                      <p className="event-organizer">
                        Organizer: {getOrganizerName(event.organizerId)}
                      </p>
                      {event.duration && (
                        <p className="event-duration">⏱️ Duration: {event.duration} minutes</p>
                      )}
                      {event.hostingProjects && (
                        <p className="event-projects">
                          🏢 Hosted by: {typeof event.hostingProjects === 'string'
                            ? event.hostingProjects
                            : event.hostingProjects.map(projectId => {
                              const project = projects.find(p => p.id === projectId)
                              return project?.name || projectId
                            }).join(', ')}
                        </p>
                      )}
                      {event.eventLink && (
                        <p className="event-link">
                          🔗 <a href={event.eventLink} target="_blank" rel="noopener noreferrer">Event Link</a>
                        </p>
                      )}
                      {registered && (
                        <p className="event-attended">✅ You attended this event</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="empty-state">No past events</p>
          )}
        </div>

        {/* Create Event Modal */}
        <Modal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false)
            setLinkAmenity(false)
            setPrefillAmenityId(null)
            setDateError(null)
          }}
          title="Create Event Request"
        >
          <p className="modal-description">
            Submit your event for approval. Once approved by an admin, it will appear on the calendar.
          </p>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Event Title *</label>
              <input
                type="text"
                name="title"
                className="form-field"
                placeholder="e.g., Web3 Workshop"
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea
                name="description"
                className="form-field"
                placeholder="What's your event about?"
                rows="3"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Date & Time *</label>
              <input
                type="datetime-local"
                name="date"
                className={`form-field ${dateError ? 'form-field-error' : ''}`}
                min={linkAmenity ? (() => {
                  const min = new Date()
                  min.setDate(min.getDate() + 14)
                  return min.toISOString().slice(0, 16)
                })() : undefined}
                onChange={(e) => validateEventHallDate(e.target.value)}
                required
              />
              {dateError && (
                <p className="form-error">{dateError}</p>
              )}
              {linkAmenity && !dateError && (
                <small className="form-hint">Event Hall requires booking at least 2 weeks in advance</small>
              )}
            </div>
            <div className="form-group">
              <label className="form-label">Duration (minutes) *</label>
              <input
                type="number"
                name="duration"
                className="form-field"
                placeholder="e.g., 60"
                defaultValue="60"
                min="15"
                step="15"
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Capacity *</label>
              <input
                type="number"
                name="capacity"
                className="form-field"
                defaultValue="80"
                min="1"
                max="80"
                required
              />
              <small className="form-hint">Maximum capacity is 80 (Main Hall)</small>
            </div>
            <div className="form-group">
              <label className="form-label">Hosting Project(s)</label>
              <input
                type="text"
                name="hostingProjects"
                className="form-field"
                placeholder="e.g., Project Alpha, Project Beta"
              />
              <small className="form-hint">Enter the name(s) of the project(s) hosting this event</small>
            </div>
            <div className="form-group">
              <label className="form-label">Event Link</label>
              <input
                type="url"
                name="eventLink"
                className="form-field"
                placeholder="e.g., https://lu.ma/your-event"
              />
              <small className="form-hint">Optional. Add a link to your event page (e.g. Lu.ma, Eventbrite)</small>
            </div>
            <div className="form-group">
              <label className="form-checkbox">
                <input
                  type="checkbox"
                  checked={linkAmenity}
                  onChange={(e) => {
                    const checked = e.target.checked
                    setLinkAmenity(checked)
                    if (!checked) {
                      setDateError(null)
                    } else {
                      const dateInput = e.target.closest('form')?.querySelector('input[name="date"]')
                      if (dateInput?.value) validateEventHallDate(dateInput.value)
                    }
                  }}
                />
                <span>Request Event Space (Main Hall) booking</span>
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
                  <p><strong>Event Hall requirements:</strong></p>
                  <ul>
                    <li>Must be booked at least 2 weeks in advance</li>
                    <li>$50 deposit required for cleaning and support</li>
                  </ul>
                </div>
                <div className="form-group">
                  <label className="form-label">Preferred Amenity</label>
                  <select name="linkedAmenityId" className="form-field" defaultValue={defaultAmenity?.id || ''}>
                    <option value="">Select amenity</option>
                    {eventSpaceAmenities.map(amenity => (
                      <option key={amenity.id} value={amenity.id}>
                        {amenity.name} ({amenity.type})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Additional Notes for Admin</label>
                  <input
                    type="text"
                    name="amenityNote"
                    className="form-field"
                    placeholder="e.g., Need projector, extra chairs"
                  />
                </div>
              </>
              )
            })()}
            <div className="form-actions">
              <button 
                type="submit" 
                className="btn btn-primary"
                disabled={createMutation.isPending || !!dateError}
              >
                {createMutation.isPending ? 'Submitting...' : 'Submit for Approval'}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setIsModalOpen(false)
                  setLinkAmenity(false)
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        </Modal>
      </div>
    </Layout>
  )
}

export default MemberEvents
