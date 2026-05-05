import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import Layout from '../../components/Layout'
import Modal from '../../components/Modal'
import BookingCalendar from '../../components/BookingCalendar'
import { CardSkeleton } from '../../components/LoadingSkeleton'
import AmenityPhotoLightbox from '../../components/AmenityPhotoLightbox'
import { getBookings, createBooking, updateBooking, deleteBooking, createRecurringBooking } from '../../services/bookings'
import { getAmenities, DEFAULT_AVAILABILITY } from '../../services/amenities'
import { checkBookingConflicts } from '../../services/functions'
import { showToast } from '../../components/Toast'
import { useTranslation } from 'react-i18next'
import { formatDateDDMMYYYY } from '../../utils/timezone'
import './Bookings.css'

const DEFAULT_DURATION_HOURS = {
  'desk': 2,
  'meeting-room': 2,
  'podcast-room': 2,
  'event-space': 2
}

const MemberBookings = () => {
  const { t, i18n } = useTranslation()
  const { currentUser } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedAmenity, setSelectedAmenity] = useState(null)
  const [lightboxAmenity, setLightboxAmenity] = useState(null)
  const [bookingStep, setBookingStep] = useState(1) // 1: calendar, 2: confirm, 3: recurring
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [selectedStartTime, setSelectedStartTime] = useState(null)
  const [selectedEndTime, setSelectedEndTime] = useState(null)
  const [duration, setDuration] = useState(2) // hours
  const [recurrence, setRecurrence] = useState(null)
  const [conflictError, setConflictError] = useState(null)
  const [alternativeSlots, setAlternativeSlots] = useState([])
  const [isCheckingConflict, setIsCheckingConflict] = useState(false)
  const [isSubmittingBooking, setIsSubmittingBooking] = useState(false)
  const isSubmittingRef = useRef(false)
  const locale = i18n.language && i18n.language.startsWith('vi') ? 'vi-VN' : 'en-US'
  const queryClient = useQueryClient()

  const { data: myBookings = [] } = useQuery({
    queryKey: ['bookings', currentUser?.uid],
    queryFn: () => getBookings({ memberId: currentUser?.uid }),
    enabled: !!currentUser?.uid
  })

  const { data: amenities = [], isLoading: amenitiesLoading } = useQuery({
    queryKey: ['amenities'],
    queryFn: getAmenities
  })

  // Check for amenityId in URL params and auto-open booking modal
  useEffect(() => {
    const amenityId = searchParams.get('amenityId')
    if (amenityId && amenities.length > 0 && !isModalOpen) {
      const amenity = amenities.find(a => a.id === amenityId)
      if (amenity) {
        setSelectedAmenity(amenity)
        setDuration(DEFAULT_DURATION_HOURS[amenity.type] || 2)
        setSelectedDate(new Date())
        setIsModalOpen(true)
        setBookingStep(1)
        // Remove amenityId from URL params after opening modal
        const newParams = new URLSearchParams(searchParams)
        newParams.delete('amenityId')
        setSearchParams(newParams, { replace: true })
      }
    }
  }, [amenities, searchParams, isModalOpen, setSearchParams])

  const createMutation = useMutation({
    mutationFn: createBooking,
    onSuccess: () => {
      queryClient.invalidateQueries(['bookings'])
      showToast(t('toast.bookingCreated'), 'success')
      resetBookingForm()
    },
    onError: (error) => {
      showToast(t('toast.bookingCreateFailed'), 'error')
      console.error('Booking creation error:', error)
    }
  })

  const recurringMutation = useMutation({
    mutationFn: ({ baseBooking, recurrence }) =>
      createRecurringBooking(
        baseBooking,
        recurrence,
        checkBookingConflicts,
        { allowedWeekdays: selectedAmenity?.availableDays }
      ),
    onSuccess: (result) => {
      queryClient.invalidateQueries(['bookings'])
      showToast(t('toast.recurringBookingsCreated', { count: result.totalCreated }), 'success')
      resetBookingForm()
    },
    onError: (error) => {
      showToast(t('toast.recurringBookingsFailed'), 'error')
      console.error('Recurring booking error:', error)
    }
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => updateBooking(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['bookings'])
      showToast(t('toast.bookingUpdated'), 'success')
    }
  })

  const deleteMutation = useMutation({
    mutationFn: deleteBooking,
    onSuccess: () => {
      queryClient.invalidateQueries(['bookings'])
      showToast(t('toast.bookingDeleted'), 'success')
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

  // Recalculate end time when duration changes and start time is already selected
  useEffect(() => {
    if (selectedStartTime && duration) {
      const newEndTime = new Date(selectedStartTime)
      // Use setTime with milliseconds to properly handle fractional hours (e.g., 1.5 hours)
      newEndTime.setTime(selectedStartTime.getTime() + duration * 60 * 60 * 1000)
      setSelectedEndTime(newEndTime)
    }
  }, [duration, selectedStartTime])

  const handleBookAmenity = (amenity) => {
    if (amenity.type === 'event-space') {
      navigate(`/member/events?action=create&amenityId=${amenity.id}`)
      return
    }
    setSelectedAmenity(amenity)
    setDuration(DEFAULT_DURATION_HOURS[amenity.type] || 2)
    setSelectedDate(new Date())
    setIsModalOpen(true)
    setBookingStep(1)
  }

  const handleTimeSlotSelect = async (slotTime, advance = false) => {
    if (!selectedAmenity) return

    const startTime = new Date(slotTime)
    const endTime = new Date(startTime)
    // Use setTime with milliseconds to properly handle fractional hours (e.g., 1.5 hours)
    endTime.setTime(startTime.getTime() + duration * 60 * 60 * 1000)

    // Client-side check: end time must not exceed the amenity's closing hour
    const amenityEndHour = typeof selectedAmenity.endHour === 'number'
      ? selectedAmenity.endHour
      : DEFAULT_AVAILABILITY.endHour
    const endHours = endTime.getHours() + endTime.getMinutes() / 60
    if (endHours > amenityEndHour) {
      setConflictError(t('memberBookings.outsideHoursError'))
      setAlternativeSlots([])
      setSelectedStartTime(startTime)
      setSelectedEndTime(endTime)
      return
    }

    setSelectedStartTime(startTime)
    setSelectedEndTime(endTime)
    setIsCheckingConflict(true)

    // Check for conflicts
    try {
      const conflictCheck = await checkBookingConflicts(
        selectedAmenity.id,
        startTime.toISOString(),
        endTime.toISOString()
      )

      if (conflictCheck.hasConflicts) {
        setConflictError(t('memberBookings.conflictError'))

        // Suggest alternatives (same day, different times)
        const suggestions = generateAlternativeSlots(startTime, endTime, duration)
        setAlternativeSlots(suggestions)
      } else {
        setConflictError(null)
        setAlternativeSlots([])
        if (advance) setBookingStep(2)
      }
    } catch (error) {
      if (error?.code === 'functions/invalid-argument') {
        setConflictError(error.message || t('memberBookings.outsideHoursError'))
        setAlternativeSlots([])
      } else {
        console.warn('Could not check conflicts:', error)
        setConflictError(t('memberBookings.conflictCheckFailed'))
        setAlternativeSlots([])
      }
    } finally {
      setIsCheckingConflict(false)
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
      // Use setTime with milliseconds to properly handle fractional hours (e.g., 1.5 hours)
      altEnd.setTime(altStart.getTime() + durationHours * 60 * 60 * 1000)
      
      // Don't suggest the original time
      if (altStart.getTime() !== originalStart.getTime()) {
        alternatives.push({ start: altStart, end: altEnd })
      }
    }
    
    return alternatives.slice(0, 3) // Return top 3 alternatives
  }

  const handleUseAlternative = (altSlot) => {
    handleTimeSlotSelect(altSlot.start, true)
  }

  const handleCancel = async (id) => {
    if (window.confirm(t('memberBookings.confirmCancel'))) {
      await updateMutation.mutateAsync({ id, data: { status: 'cancelled' } })
    }
  }

  const handleDelete = async (id) => {
    if (window.confirm(t('memberBookings.confirmDelete'))) {
      await deleteMutation.mutateAsync(id)
    }
  }

  const handleConfirmBooking = async () => {
    if (!selectedStartTime || !selectedEndTime || !selectedAmenity) return
    if (isSubmittingRef.current) return
    isSubmittingRef.current = true
    setIsSubmittingBooking(true)

    // Final conflict check
    try {
      const conflictCheck = await checkBookingConflicts(
        selectedAmenity.id,
        selectedStartTime.toISOString(),
        selectedEndTime.toISOString()
      )

      if (conflictCheck.hasConflicts) {
        showToast(t('toast.slotNoLongerAvailable'), 'error')
        setBookingStep(1)
        isSubmittingRef.current = false
        setIsSubmittingBooking(false)
        return
      }
    } catch (error) {
      console.warn('Could not check conflicts:', error)
      showToast(t('memberBookings.conflictCheckFailed'), 'error')
      isSubmittingRef.current = false
      setIsSubmittingBooking(false)
      return
    }

    const baseBooking = {
      memberId: currentUser.uid,
      amenityId: selectedAmenity.id,
      startTime: selectedStartTime.toISOString(),
      endTime: selectedEndTime.toISOString()
    }

    try {
      if (recurrence) {
        // Create recurring bookings
        await recurringMutation.mutateAsync({ baseBooking, recurrence })
      } else {
        // Create single booking
        await createMutation.mutateAsync(baseBooking)
      }
    } catch (error) {
      // Errors are already surfaced via mutation onError/toast
      console.error('Booking submission error:', error)
    } finally {
      isSubmittingRef.current = false
      setIsSubmittingBooking(false)
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

  const formatDateTimeForDisplay = (value) => {
    if (!value) return t('common.na')
    const d = value instanceof Date ? value : new Date(value)
    const datePart = formatDateDDMMYYYY(d)
    const timePart = d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
    return `${datePart} ${timePart}`
  }
  const deduplicatedBookings = myBookings.filter((booking, index, arr) =>
    index === arr.findIndex(b =>
      b.amenityId === booking.amenityId &&
      String(b.startTime) === String(booking.startTime) &&
      String(b.endTime) === String(booking.endTime)
    )
  )
  const upcomingBookings = deduplicatedBookings.filter(b => new Date(b.startTime) > new Date())
  const pastBookings = deduplicatedBookings.filter(b => new Date(b.startTime) <= new Date())

  const getMinRecurringEndDate = () => {
    const base = selectedDate instanceof Date ? new Date(selectedDate) : new Date()
    base.setMonth(base.getMonth() + 1)
    base.setHours(0, 0, 0, 0)
    return base.toISOString().split('T')[0]
  }

  return (
    <Layout>
      <div className="container">
        <div className="page-header">
          <h1 className="page-title">{t('memberBookings.title')}</h1>
        </div>

        <div className="bookings-section glass">
          <div className="section-header">
            <h2 className="section-title">{t('memberBookings.availableAmenities')}</h2>
            <p className="section-description">{t('memberBookings.availableAmenitiesDesc')}</p>
          </div>
          {amenitiesLoading ? (
            <CardSkeleton count={3} />
          ) : availableAmenities.length > 0 ? (
            <div className="amenities-grid">
              {availableAmenities.map(amenity => (
              <div key={amenity.id} className="amenity-card">
                {amenity.photos && amenity.photos.length > 0 ? (
                  <button
                    type="button"
                    className="amenity-photo-preview amenity-photo-clickable"
                    onClick={() => setLightboxAmenity(amenity)}
                    aria-label={`View photos of ${amenity.name}`}
                  >
                    <img src={amenity.photos[0]} alt={amenity.name} />
                    {amenity.photos.length > 1 && (
                      <span className="amenity-photo-count-badge">{amenity.photos.length}</span>
                    )}
                  </button>
                ) : (
                  <div className="amenity-photo-placeholder">
                    <span>{t('memberBookings.noPhoto')}</span>
                  </div>
                )}
                <div className="amenity-header">
                  <h3 className="amenity-name">{amenity.name}</h3>
                  <span className="amenity-type">{amenity.type}</span>
                </div>
                <div className="amenity-info">
                  <p>{t('memberBookings.capacity', { count: amenity.capacity || t('common.na') })}</p>
                  {amenity.description && (
                    <p className="amenity-description">{amenity.description}</p>
                  )}
                </div>
                <button
                  className="btn btn-primary btn-book"
                  onClick={() => handleBookAmenity(amenity)}
                >
                  {t('memberBookings.bookNow')}
                </button>
              </div>
              ))}
            </div>
          ) : (
            <p className="empty-state">{t('memberBookings.noAmenities')}</p>
          )}
        </div>

        <div className="bookings-section glass">
          <div className="section-header">
            <h2 className="section-title">{t('memberBookings.upcomingBookings')}</h2>
          </div>
          {upcomingBookings.length > 0 ? (
            <div className="bookings-list">
              {upcomingBookings.map(booking => {
                const amenity = amenities.find(a => a.id === booking.amenityId)
                return (
                  <div key={booking.id} className="booking-card">
                    <div className="booking-header">
                      <h4 className="booking-amenity">{amenity?.name || booking.amenityId}</h4>
                    </div>
                    <div className="booking-content">
                      <div className="booking-status-section">
                        <span className={`status-badge ${booking.status}`}>
                          {booking.status}
                        </span>
                        {booking.startTime && booking.endTime ? (() => {
                          const hours = (new Date(booking.endTime) - new Date(booking.startTime)) / (1000 * 60 * 60)
                          const durationText = hours % 1 === 0 
                            ? `${hours} hour${hours !== 1 ? 's' : ''}` 
                            : `${hours.toFixed(1)} hours`
                          return <p className="booking-duration">{durationText}</p>
                        })() : null}
                      </div>
                      <div className="booking-time-section">
                        <p className="booking-time">
                          {t('memberBookings.start')} {formatDateTimeForDisplay(booking.startTime)}
                        </p>
                        <p className="booking-time">
                          {t('memberBookings.end')} {formatDateTimeForDisplay(booking.endTime)}
                        </p>
                      </div>
                    </div>
                    <div className="booking-actions">
                      {booking.status === 'pending' && (
                        <>
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => handleCancel(booking.id)}
                          >
                            {t('common.cancel')}
                          </button>
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => handleDelete(booking.id)}
                          >
                            {t('common.delete')}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="empty-state">{t('memberBookings.noUpcomingBookings')}</p>
          )}
        </div>

        <div className="bookings-section glass">
          <div className="section-header">
            <h2 className="section-title">{t('memberBookings.pastBookings')}</h2>
          </div>
          {pastBookings.length > 0 ? (
            <div className="bookings-list">
              {pastBookings.map(booking => {
                const amenity = amenities.find(a => a.id === booking.amenityId)
                return (
                  <div key={booking.id} className="booking-card">
                    <div className="booking-header">
                      <h4 className="booking-amenity">{amenity?.name || booking.amenityId}</h4>
                    </div>
                    <div className="booking-content">
                      <div className="booking-status-section">
                        <span className={`status-badge ${booking.status}`}>
                          {booking.status}
                        </span>
                        {booking.startTime && booking.endTime ? (() => {
                          const hours = (new Date(booking.endTime) - new Date(booking.startTime)) / (1000 * 60 * 60)
                          const durationText = hours % 1 === 0 
                            ? `${hours} hour${hours !== 1 ? 's' : ''}` 
                            : `${hours.toFixed(1)} hours`
                          return <p className="booking-duration">{durationText}</p>
                        })() : null}
                      </div>
                      <div className="booking-time-section">
                        <p className="booking-time">
                          {t('memberBookings.start')} {formatDateTimeForDisplay(booking.startTime)}
                        </p>
                        <p className="booking-time">
                          {t('memberBookings.end')} {formatDateTimeForDisplay(booking.endTime)}
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="empty-state">{t('memberBookings.noPastBookings')}</p>
          )}
        </div>

        <Modal
          isOpen={isModalOpen}
          onClose={resetBookingForm}
          title={
            selectedAmenity
              ? t('memberBookings.modal.titleWithAmenity', { name: selectedAmenity.name })
              : t('memberBookings.modal.titleFallback')
          }
        >
          {selectedAmenity && (
            <>
              {bookingStep === 1 && (
                <div className="booking-step">
                  <div className="form-group">
                    <label className="form-label">
                      {t('memberBookings.modal.duration')}
                    </label>
                    <select
                      className="form-field"
                      value={duration}
                      onChange={(e) => setDuration(parseFloat(e.target.value))}
                    >
                      <option value="0.5">{t('memberBookings.modal.duration30')}</option>
                      <option value="1">{t('memberBookings.modal.duration1h')}</option>
                      <option value="1.5">{t('memberBookings.modal.duration1h30')}</option>
                      <option value="2">{t('memberBookings.modal.duration2h')}</option>
                      <option value="2.5">{t('memberBookings.modal.duration2h30')}</option>
                      <option value="3">{t('memberBookings.modal.duration3h')}</option>
                      <option value="4">{t('memberBookings.modal.duration4h')}</option>
                      <option value="5">{t('memberBookings.modal.duration5h')}</option>
                      <option value="6">{t('memberBookings.modal.duration6h')}</option>
                      <option value="8">{t('memberBookings.modal.durationFullDay')}</option>
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
                    disabled={isCheckingConflict}
                  />

                  {conflictError && (
                    <div className="conflict-error">
                      <p className="error-message">{conflictError}</p>
                      {alternativeSlots.length > 0 && (
                        <div className="alternative-slots">
                          <p>{t('memberBookings.modal.alternativesLabel')}</p>
                          {alternativeSlots.map((alt, index) => (
                            <button
                              key={index}
                              className="btn btn-secondary btn-sm"
                              onClick={() => handleUseAlternative(alt)}
                            >
                              {alt.start.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' })} -{' '}
                              {alt.end.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' })}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {selectedStartTime && !conflictError && (
                    <div className="selected-time-info">
                      <p>
                        {t('memberBookings.modal.selectedRange', {
                          start: formatDateTimeForDisplay(selectedStartTime),
                          end: formatDateTimeForDisplay(selectedEndTime)
                        })}
                      </p>
                      <button
                        className="btn btn-primary"
                        onClick={() => handleTimeSlotSelect(selectedStartTime, true)}
                        disabled={isCheckingConflict}
                      >
                        {isCheckingConflict
                          ? t('memberBookings.modal.checking')
                          : t('memberBookings.modal.continue')}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {bookingStep === 2 && (
                <div className="booking-step">
                  <div className="booking-summary">
                    <h3>{t('memberBookings.modal.summaryTitle')}</h3>
                    <div className="summary-item">
                      <strong>{t('memberBookings.modal.summaryAmenity')}</strong> {selectedAmenity.name}
                    </div>
                    <div className="summary-item">
                      <strong>{t('memberBookings.modal.summaryStart')}</strong>{' '}
                      {selectedStartTime ? formatDateTimeForDisplay(selectedStartTime) : t('common.na')}
                    </div>
                    <div className="summary-item">
                      <strong>{t('memberBookings.modal.summaryEnd')}</strong>{' '}
                      {selectedEndTime ? formatDateTimeForDisplay(selectedEndTime) : t('common.na')}
                    </div>
                    <div className="summary-item">
                      <strong>{t('memberBookings.modal.summaryDuration')}</strong>{' '}
                      {duration >= 1
                        ? t('memberBookings.modal.durationHours', { count: duration })
                        : t('memberBookings.modal.durationMinutes', { count: duration * 60 })}
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-checkbox">
                      <input
                        type="checkbox"
                        checked={!!recurrence}
                        onChange={handleRecurringToggle}
                      />
                      <span>{t('memberBookings.modal.recurringLabel')}</span>
                    </label>
                    {recurrence && (
                      <div className="recurrence-info">
                        <p>
                          {t('memberBookings.modal.recurringSummary', {
                            frequency: recurrence.frequency
                          })}
                        </p>
                        {recurrence.endDate && (
                          <p>
                            {t('memberBookings.modal.recurringUntil', {
                              date: formatDateDDMMYYYY(recurrence.endDate)
                            })}
                          </p>
                        )}
                        {recurrence.occurrences && (
                          <p>
                            {t('memberBookings.modal.recurringOccurrences', {
                              count: recurrence.occurrences
                            })}
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="form-actions">
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setBookingStep(1)}
                    >
                      {t('memberBookings.modal.back')}
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={handleConfirmBooking}
                      disabled={isSubmittingBooking || createMutation.isPending || recurringMutation.isPending}
                    >
                      {isSubmittingBooking || createMutation.isPending || recurringMutation.isPending
                        ? t('memberBookings.modal.creating')
                        : t('memberBookings.modal.confirm')}
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={resetBookingForm}
                    >
                      {t('common.close')}
                    </button>
                  </div>
                </div>
              )}

              {bookingStep === 3 && (
                <div className="booking-step">
                  <h3>{t('memberBookings.modal.recurringOptionsTitle')}</h3>
                  <form onSubmit={handleRecurringSubmit}>
                    <div className="form-group">
                      <label className="form-label">
                        {t('memberBookings.modal.frequency')}
                      </label>
                      <div className="recurring-frequency-options">
                        <label className="form-checkbox">
                          <input
                            type="radio"
                            name="frequency"
                            value="daily"
                            required
                          />
                          <span>{t('memberBookings.modal.frequencyDaily')}</span>
                        </label>
                        <label className="form-checkbox">
                          <input
                            type="radio"
                            name="frequency"
                            value="weekly"
                          />
                          <span>{t('memberBookings.modal.frequencyWeekly')}</span>
                        </label>
                        <label className="form-checkbox">
                          <input
                            type="radio"
                            name="frequency"
                            value="monthly"
                          />
                          <span>{t('memberBookings.modal.frequencyMonthly')}</span>
                        </label>
                      </div>
                    </div>
                    <div className="form-group">
                      <label className="form-label">
                        {t('memberBookings.modal.endDateOptional')}
                      </label>
                      <input
                        type="date"
                        name="endDate"
                        className="form-field"
                        min={getMinRecurringEndDate()}
                        defaultValue={getMinRecurringEndDate()}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">
                        {t('memberBookings.modal.occurrencesOptional')}
                      </label>
                      <input
                        type="number"
                        name="occurrences"
                        className="form-field"
                        min="2"
                        max="52"
                      />
                      <small className="form-hint">
                        {t('memberBookings.modal.occurrencesHint')}
                      </small>
                    </div>
                    <div className="form-actions">
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => setBookingStep(2)}
                      >
                        {t('memberBookings.modal.back')}
                      </button>
                      <button type="submit" className="btn btn-primary">
                        {t('memberBookings.modal.setRecurrence')}
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </>
          )}
        </Modal>

        <AmenityPhotoLightbox
          isOpen={!!lightboxAmenity}
          onClose={() => setLightboxAmenity(null)}
          photos={lightboxAmenity?.photos || []}
          alt={lightboxAmenity?.name || ''}
        />
      </div>
    </Layout>
  )
}

export default MemberBookings
