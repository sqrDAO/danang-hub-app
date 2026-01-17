import { useState } from 'react'
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
import { showToast } from '../../components/Toast'
import './Events.css'

const AdminEvents = () => {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isCreateMode, setIsCreateMode] = useState(true)
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [linkAmenity, setLinkAmenity] = useState(false)
  const [activeTab, setActiveTab] = useState('pending') // 'pending', 'approved', 'all'
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
          showToast('Event created but failed to link amenity booking.', 'warning')
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
      showToast('Event created successfully!', 'success')
    },
    onError: () => {
      showToast('Failed to create event. Please try again.', 'error')
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
      showToast('Event updated successfully!', 'success')
    },
    onError: () => {
      showToast('Failed to update event. Please try again.', 'error')
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
      showToast('Event approved! It will now appear on the calendar.', 'success')
    },
    onError: () => {
      showToast('Failed to approve event. Please try again.', 'error')
    }
  })

  const rejectMutation = useMutation({
    mutationFn: ({ eventId, reason }) => rejectEvent(eventId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] })
      queryClient.invalidateQueries({ queryKey: ['pendingEvents'] })
      queryClient.invalidateQueries({ queryKey: ['myEvents'] })
      queryClient.invalidateQueries({ queryKey: ['upcomingEvents'] })
      showToast('Event rejected.', 'info')
    },
    onError: () => {
      showToast('Failed to reject event. Please try again.', 'error')
    }
  })

  const promoteWaitlistMutation = useMutation({
    mutationFn: ({ eventId, count }) => promoteFromWaitlist(eventId, count),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['events'] })
      queryClient.invalidateQueries({ queryKey: ['upcomingEvents'] })
      queryClient.invalidateQueries({ queryKey: ['approvedEvents'] })
      showToast(`Promoted ${result.promoted} member(s) from waitlist!`, 'success')
    },
    onError: () => {
      showToast('Failed to promote from waitlist. Please try again.', 'error')
    }
  })

  const deleteMutation = useMutation({
    mutationFn: deleteEvent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] })
      queryClient.invalidateQueries({ queryKey: ['pendingEvents'] })
      queryClient.invalidateQueries({ queryKey: ['upcomingEvents'] })
      queryClient.invalidateQueries({ queryKey: ['approvedEvents'] })
      showToast('Event deleted successfully!', 'success')
    }
  })

  const resetForm = () => {
    setSelectedEvent(null)
    setIsCreateMode(true)
    setLinkAmenity(false)
  }

  const handleCreate = () => {
    setIsCreateMode(true)
    setSelectedEvent(null)
    setIsModalOpen(true)
  }

  const handleEdit = (event) => {
    setIsCreateMode(false)
    setSelectedEvent(event)
    setLinkAmenity(!!event.linkedAmenityId)
    setIsModalOpen(true)
  }

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this event?')) {
      await deleteMutation.mutateAsync(id)
    }
  }

  const handleApprove = async (eventId) => {
    if (window.confirm('Approve this event? It will appear on the calendar for all members.')) {
      await approveMutation.mutateAsync(eventId)
    }
  }

  const handleReject = async (eventId) => {
    const reason = prompt('Reason for rejection (optional):')
    if (reason !== null) { // User clicked OK (even if empty)
      await rejectMutation.mutateAsync({ eventId, reason })
    }
  }

  const handlePromoteWaitlist = async (eventId) => {
    const count = prompt('How many members to promote from waitlist?', '1')
    if (count && !isNaN(count)) {
      await promoteWaitlistMutation.mutateAsync({ eventId, count: parseInt(count) })
    }
  }

  const getOrganizerName = (organizerId) => {
    const organizer = members.find(m => m.id === organizerId)
    return organizer?.displayName || organizer?.email || organizerId
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const formData = new FormData(e.target)
    const linkedAmenityId = formData.get('linkedAmenityId')
    
    const data = {
      title: formData.get('title'),
      description: formData.get('description'),
      date: formData.get('date'),
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

    // Handle amenity linking
    if (linkAmenity && linkedAmenityId) {
      const eventDate = new Date(formData.get('date'))
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
      createMutation.mutate(data)
    } else {
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
          <h1 className="page-title">Events Management</h1>
          <button className="btn btn-primary" onClick={handleCreate}>
            + Create Event
          </button>
        </div>

        {/* Pending Events Alert */}
        {pendingEvents.length > 0 && (
          <div className="pending-alert glass">
            <span className="alert-icon">⏳</span>
            <span>{pendingEvents.length} event(s) awaiting approval</span>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="tabs">
          <button
            className={`tab ${activeTab === 'pending' ? 'active' : ''}`}
            onClick={() => setActiveTab('pending')}
          >
            Pending ({pendingEvents.length})
          </button>
          <button
            className={`tab ${activeTab === 'approved' ? 'active' : ''}`}
            onClick={() => setActiveTab('approved')}
          >
            Approved ({allEvents.filter(e => e.status === 'approved').length})
          </button>
          <button
            className={`tab ${activeTab === 'all' ? 'active' : ''}`}
            onClick={() => setActiveTab('all')}
          >
            All Events ({allEvents.length})
          </button>
        </div>

        <div className="events-grid">
          {filteredEvents.length > 0 ? (
            filteredEvents.map(event => (
              <div key={event.id} className={`event-card glass ${event.status}`}>
                <div className="event-header">
                  <h3 className="event-title">{event.title}</h3>
                  <span className={getStatusBadge(event.status || 'approved')}>
                    {event.status || 'approved'}
                  </span>
                </div>
                <div className="event-info">
                  <p className="event-date">
                    📅 {event.date?.toLocaleDateString()} at {event.date?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                  <p className="event-organizer">
                    👤 Organizer: {getOrganizerName(event.organizerId)}
                  </p>
                  {event.duration && (
                    <p className="event-duration">⏱️ Duration: {event.duration} minutes</p>
                  )}
                  <p className="event-capacity">
                    👥 {event.attendees?.length || 0} / {event.capacity || 80}
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
                      ⏳ Waitlist: {event.waitlist.length}
                    </p>
                  )}
                  {event.requestedAmenityId && (
                    <p className="event-amenity-request">
                      🏢 Requested: {amenities.find(a => a.id === event.requestedAmenityId)?.name}
                      {event.amenityNote && <span> - "{event.amenityNote}"</span>}
                    </p>
                  )}
                  {event.linkedAmenityId && (
                    <p className="event-linked-amenity">
                      ✅ Linked: {amenities.find(a => a.id === event.linkedAmenityId)?.name}
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
                        ✓ Approve
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleReject(event.id)}
                        disabled={rejectMutation.isPending}
                      >
                        ✗ Reject
                      </button>
                    </>
                  )}
                  {event.status === 'approved' && event.waitlist && event.waitlist.length > 0 && (
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => handlePromoteWaitlist(event.id)}
                    >
                      Promote Waitlist
                    </button>
                  )}
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleEdit(event)}
                  >
                    Edit
                  </button>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => handleDelete(event.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))
          ) : (
            <p className="empty-state">No events in this category</p>
          )}
        </div>

        <Modal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false)
            resetForm()
          }}
          title={isCreateMode ? 'Create Event' : 'Edit Event'}
        >
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Title</label>
              <input
                type="text"
                name="title"
                className="form-field"
                defaultValue={selectedEvent?.title || ''}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea
                name="description"
                className="form-field"
                defaultValue={selectedEvent?.description || ''}
                rows="3"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Date & Time</label>
              <input
                type="datetime-local"
                name="date"
                className="form-field"
                defaultValue={selectedEvent?.date ? new Date(selectedEvent.date).toISOString().slice(0, 16) : ''}
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
                defaultValue={selectedEvent?.duration || 60}
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
                defaultValue={selectedEvent?.capacity || 80}
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
                defaultValue={typeof selectedEvent?.hostingProjects === 'string' 
                  ? selectedEvent.hostingProjects 
                  : selectedEvent?.hostingProjects?.map(projectId => {
                      const project = projects.find(p => p.id === projectId)
                      return project?.name || projectId
                    }).join(', ') || ''}
              />
              <small className="form-hint">Enter the name(s) of the project(s) hosting this event</small>
            </div>
            <div className="form-group">
              <label className="form-label">Organizer</label>
              <select name="organizerId" className="form-field" defaultValue={selectedEvent?.organizerId || ''} required>
                <option value="">Select organizer</option>
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
                  checked={linkAmenity}
                  onChange={(e) => setLinkAmenity(e.target.checked)}
                />
                <span>Link to amenity booking</span>
              </label>
            </div>
            {linkAmenity && (
              <div className="form-group">
                <label className="form-label">Amenity</label>
                <select name="linkedAmenityId" className="form-field" defaultValue={selectedEvent?.linkedAmenityId || ''}>
                  <option value="">Select amenity</option>
                  {amenities.filter(a => a.isAvailable !== false).map(amenity => (
                    <option key={amenity.id} value={amenity.id}>
                      {amenity.name}
                    </option>
                  ))}
                </select>
                <small className="form-hint">Amenity will be booked 1 hour before and 2 hours after event</small>
              </div>
            )}
            <div className="form-actions">
              <button type="submit" className="btn btn-primary">
                {isCreateMode ? 'Create' : 'Save Changes'}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setIsModalOpen(false)
                  resetForm()
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

export default AdminEvents
