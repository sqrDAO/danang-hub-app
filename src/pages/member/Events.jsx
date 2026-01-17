import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
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
  const queryClient = useQueryClient()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [linkAmenity, setLinkAmenity] = useState(false)

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
      showToast('Successfully registered for event!', 'success')
    },
    onError: () => {
      showToast('Failed to register. Please try again.', 'error')
    }
  })

  const unregisterMutation = useMutation({
    mutationFn: ({ eventId, memberId }) => unregisterFromEvent(eventId, memberId),
    onSuccess: () => {
      queryClient.invalidateQueries(['approvedEvents'])
      showToast('Successfully unregistered from event.', 'success')
    },
    onError: () => {
      showToast('Failed to unregister. Please try again.', 'error')
    }
  })

  const waitlistMutation = useMutation({
    mutationFn: ({ eventId, memberId }) => addToWaitlist(eventId, memberId),
    onSuccess: () => {
      queryClient.invalidateQueries(['approvedEvents'])
      showToast('Added to waitlist! You will be notified if a spot becomes available.', 'info')
    },
    onError: () => {
      showToast('Failed to join waitlist. Please try again.', 'error')
    }
  })

  const removeWaitlistMutation = useMutation({
    mutationFn: ({ eventId, memberId }) => removeFromWaitlist(eventId, memberId),
    onSuccess: () => {
      queryClient.invalidateQueries(['approvedEvents'])
      showToast('Removed from waitlist.', 'info')
    },
    onError: () => {
      showToast('Failed to remove from waitlist. Please try again.', 'error')
    }
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    const formData = new FormData(e.target)
    
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

    // Handle optional amenity linking request
    if (linkAmenity) {
      const linkedAmenityId = formData.get('linkedAmenityId')
      if (linkedAmenityId) {
        data.requestedAmenityId = linkedAmenityId
        data.amenityNote = formData.get('amenityNote') || ''
      }
    }

    createMutation.mutate(data)
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
          <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
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
                      {event.hostingProjects && event.hostingProjects.length > 0 && (
                        <p className="event-projects">
                          🏢 Hosted by: {event.hostingProjects.map(projectId => {
                            const project = projects.find(p => p.id === projectId)
                            return project?.name || projectId
                          }).join(', ')}
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
                className="form-field"
                required
              />
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
              <label className="form-checkbox">
                <input
                  type="checkbox"
                  checked={linkAmenity}
                  onChange={(e) => setLinkAmenity(e.target.checked)}
                />
                <span>Request amenity booking (e.g., meeting room)</span>
              </label>
            </div>
            {linkAmenity && (
              <>
                <div className="form-group">
                  <label className="form-label">Preferred Amenity</label>
                  <select name="linkedAmenityId" className="form-field">
                    <option value="">Select amenity</option>
                    {amenities.filter(a => a.isAvailable !== false).map(amenity => (
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
            )}
            <div className="form-actions">
              <button 
                type="submit" 
                className="btn btn-primary"
                disabled={createMutation.isPending}
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
