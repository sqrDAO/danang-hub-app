import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../contexts/AuthContext'
import Layout from '../../components/Layout'
import Modal from '../../components/Modal'
import BookingCalendar from '../../components/BookingCalendar'
import SmartBookingSuggestions from '../../components/SmartBookingSuggestions'
import { CardSkeleton } from '../../components/LoadingSkeleton'
import { getBookings, createBooking, updateBooking, deleteBooking, createRecurringBooking } from '../../services/bookings'
import { getAmenities } from '../../services/amenities'
import { checkBookingConflicts } from '../../services/functions'
import { showToast } from '../../components/Toast'
import './Bookings.css'

const DEFAULT_DURATION_HOURS = {
  'desk': 4,
  'meeting-room': 2,
  'podcast-room': 3
}

const MemberBookings = () => {
  const { currentUser } = useAuth()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedAmenity, setSelectedAmenity] = useState(null)
  const [bookingStep, setBookingStep] = useState(1) // 1: calendar, 2: confirm, 3: recurring
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [selectedStartTime, setSelectedStartTime] = useState(null)
  const [selectedEndTime, setSelectedEndTime] = useState(null)
  const [duration, setDuration] = useState(2) // hours
  const [recurrence, setRecurrence] = useState(null)
  const [conflictError, setConflictError] = useState(null)
  const [alternativeSlots, setAlternativeSlots] = useState([])
  const queryClient = useQueryClient()

  const handleSuggestionSelect = (suggestionData) => {
    const { amenity, timeSlot } = suggestionData
    setSelectedAmenity(amenity)
    setIsModalOpen(true)
    setBookingStep(1)
    
    // Try to parse time slot if provided
    if (timeSlot) {
      const timeMatch = timeSlot.match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
      if (timeMatch) {
        const today = new Date()
        const startHour = parseInt(timeMatch[1])
        const startMin = parseInt(timeMatch[2])
        const endHour = parseInt(timeMatch[3])
        const endMin = parseInt(timeMatch[4])
        
        const startTime = new Date(today)
        startTime.setHours(startHour, startMin, 0, 0)
        
        const endTime = new Date(today)
        endTime.setHours(endHour, endMin, 0, 0)
        
        setSelectedStartTime(startTime)
        setSelectedEndTime(endTime)
        setSelectedDate(today)
      }
    }
  }

  const { data: myBookings = [] } = useQuery({
    queryKey: ['bookings', currentUser?.uid],
    queryFn: () => getBookings({ memberId: currentUser?.uid }),
    enabled: !!currentUser?.uid
  })

  const { data: amenities = [], isLoading: amenitiesLoading } = useQuery({
    queryKey: ['amenities'],
    queryFn: getAmenities
  })

  const createMutation = useMutation({
    mutationFn: createBooking,
    onSuccess: () => {
      queryClient.invalidateQueries(['bookings'])
      showToast('Booking created successfully!', 'success')
      resetBookingForm()
    },
    onError: (error) => {
      showToast('Failed to create booking. Please try again.', 'error')
      console.error('Booking creation error:', error)
    }
  })

  const recurringMutation = useMutation({
    mutationFn: ({ baseBooking, recurrence }) => createRecurringBooking(baseBooking, recurrence, checkBookingConflicts),
    onSuccess: (result) => {
      queryClient.invalidateQueries(['bookings'])
      showToast(`Created ${result.totalCreated} recurring booking(s)!`, 'success')
      resetBookingForm()
    },
    onError: (error) => {
      showToast('Failed to create recurring bookings. Please try again.', 'error')
      console.error('Recurring booking error:', error)
    }
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => updateBooking(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['bookings'])
      showToast('Booking updated successfully!', 'success')
    }
  })

  const deleteMutation = useMutation({
    mutationFn: deleteBooking,
    onSuccess: () => {
      queryClient.invalidateQueries(['bookings'])
      showToast('Booking deleted successfully!', 'success')
    }
  })

  const resetBookingForm = () => {
    setIsModalOpen(false)
    setSelectedAmenity(null)
    setBookingStep(1)
    setSelectedDate(new Date())
    setSelectedStartTime(null)
    setSelectedEndTime(null)
    setDuration(2)
    setRecurrence(null)
    setConflictError(null)
    setAlternativeSlots([])
  }

  const handleBookAmenity = (amenity) => {
    setSelectedAmenity(amenity)
    setDuration(DEFAULT_DURATION_HOURS[amenity.type] || 2)
    setSelectedDate(new Date())
    setIsModalOpen(true)
    setBookingStep(1)
  }

  const handleTimeSlotSelect = async (slotTime) => {
    if (!selectedAmenity) return

    const startTime = new Date(slotTime)
    const endTime = new Date(startTime)
    endTime.setHours(endTime.getHours() + duration)

    setSelectedStartTime(startTime)
    setSelectedEndTime(endTime)

    // Check for conflicts
    try {
      const conflictCheck = await checkBookingConflicts(
        selectedAmenity.id,
        startTime.toISOString(),
        endTime.toISOString()
      )

      if (conflictCheck.hasConflicts) {
        setConflictError('This time slot conflicts with an existing booking.')
        
        // Suggest alternatives (same day, different times)
        const suggestions = generateAlternativeSlots(startTime, endTime, duration)
        setAlternativeSlots(suggestions)
      } else {
        setConflictError(null)
        setAlternativeSlots([])
        setBookingStep(2) // Move to confirmation step
      }
    } catch (error) {
      console.warn('Could not check conflicts:', error)
      setConflictError(null)
      setBookingStep(2)
    }
  }

  const generateAlternativeSlots = (originalStart, originalEnd, durationHours) => {
    const alternatives = []
    const sameDay = new Date(originalStart)
    sameDay.setHours(8, 0, 0, 0) // Start from 8 AM
    
    // Generate slots every 2 hours
    for (let hour = 8; hour <= 20; hour += 2) {
      const altStart = new Date(sameDay)
      altStart.setHours(hour, 0, 0, 0)
      
      const altEnd = new Date(altStart)
      altEnd.setHours(altEnd.getHours() + durationHours)
      
      // Don't suggest the original time
      if (altStart.getTime() !== originalStart.getTime()) {
        alternatives.push({ start: altStart, end: altEnd })
      }
    }
    
    return alternatives.slice(0, 3) // Return top 3 alternatives
  }

  const handleUseAlternative = (altSlot) => {
    setSelectedStartTime(altSlot.start)
    setSelectedEndTime(altSlot.end)
    setConflictError(null)
    setAlternativeSlots([])
    setBookingStep(2)
  }

  const handleCancel = async (id) => {
    if (window.confirm('Are you sure you want to cancel this booking?')) {
      await updateMutation.mutateAsync({ id, data: { status: 'cancelled' } })
    }
  }

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this booking?')) {
      await deleteMutation.mutateAsync(id)
    }
  }

  const handleConfirmBooking = async () => {
    if (!selectedStartTime || !selectedEndTime || !selectedAmenity) return

    // Final conflict check
    try {
      const conflictCheck = await checkBookingConflicts(
        selectedAmenity.id,
        selectedStartTime.toISOString(),
        selectedEndTime.toISOString()
      )

      if (conflictCheck.hasConflicts) {
        showToast('This time slot is no longer available. Please select another time.', 'error')
        setBookingStep(1)
        return
      }
    } catch (error) {
      console.warn('Could not check conflicts:', error)
    }

    const baseBooking = {
      memberId: currentUser.uid,
      amenityId: selectedAmenity.id,
      startTime: selectedStartTime.toISOString(),
      endTime: selectedEndTime.toISOString()
    }

    if (recurrence) {
      // Create recurring bookings
      recurringMutation.mutate({ baseBooking, recurrence })
    } else {
      // Create single booking
      createMutation.mutate(baseBooking)
    }
  }

  const handleRecurringToggle = () => {
    if (recurrence) {
      setRecurrence(null)
    } else {
      setBookingStep(3)
    }
  }

  const handleRecurringSubmit = (e) => {
    e.preventDefault()
    const formData = new FormData(e.target)
    setRecurrence({
      frequency: formData.get('frequency'),
      endDate: formData.get('endDate') || null,
      occurrences: formData.get('occurrences') ? parseInt(formData.get('occurrences')) : null
    })
    setBookingStep(2)
  }

  const availableAmenities = amenities.filter(a => a.isAvailable !== false)
  const upcomingBookings = myBookings.filter(b => new Date(b.startTime) > new Date())
  const pastBookings = myBookings.filter(b => new Date(b.startTime) <= new Date())

  return (
    <Layout>
      <div className="container">
        <div className="page-header">
          <h1 className="page-title">My Bookings</h1>
        </div>

        <div className="bookings-section glass">
          <div className="section-header">
            <h2 className="section-title">Available Amenities</h2>
            <p className="section-description">Select an amenity and click "Book Now" to make a reservation</p>
          </div>
          {amenitiesLoading ? (
            <CardSkeleton count={3} />
          ) : availableAmenities.length > 0 ? (
            <div className="amenities-grid">
              {availableAmenities.map(amenity => (
              <div key={amenity.id} className="amenity-card">
                <div className="amenity-header">
                  <h3 className="amenity-name">{amenity.name}</h3>
                  <span className="amenity-type">{amenity.type}</span>
                </div>
                <div className="amenity-info">
                  <p>Capacity: {amenity.capacity || 'N/A'}</p>
                  {amenity.description && (
                    <p className="amenity-description">{amenity.description}</p>
                  )}
                </div>
                <button
                  className="btn btn-primary btn-book"
                  onClick={() => handleBookAmenity(amenity)}
                >
                  📅 Book Now
                </button>
              </div>
              ))}
            </div>
          ) : (
            <p className="empty-state">No amenities available. Please contact admin.</p>
          )}
        </div>

        <SmartBookingSuggestions onSelectSuggestion={handleSuggestionSelect} amenities={amenities} />

        <div className="bookings-section glass">
          <div className="section-header">
            <h2 className="section-title">Upcoming Bookings</h2>
          </div>
          {upcomingBookings.length > 0 ? (
            <div className="bookings-list">
              {upcomingBookings.map(booking => {
                const amenity = amenities.find(a => a.id === booking.amenityId)
                return (
                  <div key={booking.id} className="booking-card">
                    <div className="booking-info">
                      <h4 className="booking-amenity">{amenity?.name || booking.amenityId}</h4>
                      <span className={`status-badge ${booking.status}`}>
                        {booking.status}
                      </span>
                    </div>
                    <div className="booking-details">
                      <p>Start: {booking.startTime?.toLocaleString() || 'N/A'}</p>
                      <p>End: {booking.endTime?.toLocaleString() || 'N/A'}</p>
                    </div>
                    <div className="booking-actions">
                      {booking.status === 'pending' && (
                        <>
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => handleCancel(booking.id)}
                          >
                            Cancel
                          </button>
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => handleDelete(booking.id)}
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="empty-state">No upcoming bookings</p>
          )}
        </div>

        <div className="bookings-section glass">
          <div className="section-header">
            <h2 className="section-title">Past Bookings</h2>
          </div>
          {pastBookings.length > 0 ? (
            <div className="bookings-list">
              {pastBookings.map(booking => {
                const amenity = amenities.find(a => a.id === booking.amenityId)
                return (
                  <div key={booking.id} className="booking-card">
                    <div className="booking-info">
                      <h4 className="booking-amenity">{amenity?.name || booking.amenityId}</h4>
                      <span className={`status-badge ${booking.status}`}>
                        {booking.status}
                      </span>
                    </div>
                    <div className="booking-details">
                      <p>Start: {booking.startTime?.toLocaleString() || 'N/A'}</p>
                      <p>End: {booking.endTime?.toLocaleString() || 'N/A'}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="empty-state">No past bookings</p>
          )}
        </div>

        <Modal
          isOpen={isModalOpen}
          onClose={resetBookingForm}
          title={`Book ${selectedAmenity?.name || 'Amenity'}`}
        >
          {selectedAmenity && (
            <>
              {bookingStep === 1 && (
                <div className="booking-step">
                  <div className="form-group">
                    <label className="form-label">Duration</label>
                    <select
                      className="form-field"
                      value={duration}
                      onChange={(e) => setDuration(parseFloat(e.target.value))}
                    >
                      <option value="0.5">30 minutes</option>
                      <option value="1">1 hour</option>
                      <option value="1.5">1.5 hours</option>
                      <option value="2">2 hours</option>
                      <option value="2.5">2.5 hours</option>
                      <option value="3">3 hours</option>
                      <option value="4">4 hours</option>
                      <option value="5">5 hours</option>
                      <option value="6">6 hours</option>
                      <option value="8">Full day (8 hours)</option>
                    </select>
                  </div>
                  
                  <BookingCalendar
                    amenityId={selectedAmenity.id}
                    selectedDate={selectedDate}
                    onDateChange={setSelectedDate}
                    onTimeSlotSelect={handleTimeSlotSelect}
                    selectedStartTime={selectedStartTime}
                    selectedEndTime={selectedEndTime}
                    viewMode="week"
                  />

                  {conflictError && (
                    <div className="conflict-error">
                      <p className="error-message">{conflictError}</p>
                      {alternativeSlots.length > 0 && (
                        <div className="alternative-slots">
                          <p>Suggested alternative times:</p>
                          {alternativeSlots.map((alt, index) => (
                            <button
                              key={index}
                              className="btn btn-secondary btn-sm"
                              onClick={() => handleUseAlternative(alt)}
                            >
                              {alt.start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} - {alt.end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {selectedStartTime && !conflictError && (
                    <div className="selected-time-info">
                      <p>Selected: {selectedStartTime.toLocaleString()} - {selectedEndTime.toLocaleString()}</p>
                      <button
                        className="btn btn-primary"
                        onClick={() => setBookingStep(2)}
                      >
                        Continue to Confirm
                      </button>
                    </div>
                  )}
                </div>
              )}

              {bookingStep === 2 && (
                <div className="booking-step">
                  <div className="booking-summary">
                    <h3>Booking Summary</h3>
                    <div className="summary-item">
                      <strong>Amenity:</strong> {selectedAmenity.name}
                    </div>
                    <div className="summary-item">
                      <strong>Start:</strong> {selectedStartTime?.toLocaleString()}
                    </div>
                    <div className="summary-item">
                      <strong>End:</strong> {selectedEndTime?.toLocaleString()}
                    </div>
                    <div className="summary-item">
                      <strong>Duration:</strong> {duration >= 1 ? `${duration} hour${duration > 1 ? 's' : ''}` : `${duration * 60} minutes`}
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-checkbox">
                      <input
                        type="checkbox"
                        checked={!!recurrence}
                        onChange={handleRecurringToggle}
                      />
                      <span>Make this a recurring booking</span>
                    </label>
                    {recurrence && (
                      <div className="recurrence-info">
                        <p>Recurring: {recurrence.frequency}</p>
                        {recurrence.endDate && <p>Until: {new Date(recurrence.endDate).toLocaleDateString()}</p>}
                        {recurrence.occurrences && <p>Occurrences: {recurrence.occurrences}</p>}
                      </div>
                    )}
                  </div>

                  <div className="form-actions">
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setBookingStep(1)}
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={handleConfirmBooking}
                      disabled={createMutation.isPending || recurringMutation.isPending}
                    >
                      {createMutation.isPending || recurringMutation.isPending ? 'Creating...' : 'Confirm Booking'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={resetBookingForm}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {bookingStep === 3 && (
                <div className="booking-step">
                  <h3>Recurring Booking Options</h3>
                  <form onSubmit={handleRecurringSubmit}>
                    <div className="form-group">
                      <label className="form-label">Frequency</label>
                      <select name="frequency" className="form-field" required>
                        <option value="">Select frequency</option>
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">End Date (optional)</label>
                      <input
                        type="date"
                        name="endDate"
                        className="form-field"
                        min={selectedDate.toISOString().split('T')[0]}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Number of Occurrences (optional)</label>
                      <input
                        type="number"
                        name="occurrences"
                        className="form-field"
                        min="2"
                        max="52"
                      />
                      <small className="form-hint">Leave empty if using end date</small>
                    </div>
                    <div className="form-actions">
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => setBookingStep(2)}
                      >
                        Back
                      </button>
                      <button type="submit" className="btn btn-primary">
                        Set Recurrence
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </>
          )}
        </Modal>
      </div>
    </Layout>
  )
}

export default MemberBookings
