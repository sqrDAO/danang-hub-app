import { useState, useEffect, useMemo, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import Layout from '../../components/Layout'
import Modal from '../../components/Modal'
import BookingCalendar from '../../components/BookingCalendar'
import { CardSkeleton } from '../../components/LoadingSkeleton'
import AmenityPhotoLightbox from '../../components/AmenityPhotoLightbox'
import { getBookings, createBooking, updateBooking, deleteBooking, createRecurringBooking, createFixedDeskPlan, cancelFixedDeskPlan } from '../../services/bookings'
import { getAmenities, DEFAULT_AVAILABILITY } from '../../services/amenities'
import { checkBookingConflicts } from '../../services/functions'
import { showToast } from '../../utils/toast'
import { useTranslation } from 'react-i18next'
import { formatDateDDMMYYYY } from '../../utils/timezone'
import './Bookings.css'

const DEFAULT_DURATION_HOURS = {
  'desk': 2,
  'meeting-room': 2,
  'podcast-room': 2,
  'event-space': 2
}

const getLocale = (i18n) =>
  i18n.language && i18n.language.startsWith('vi') ? 'vi-VN' : 'en-US'

// Member's own bookings: 90 days back (past activity) + 365 days forward
// (recurring/fixed-desk plans can extend up to a year out).
const getMemberBookingsWindow = () => {
  const start = new Date()
  start.setDate(start.getDate() - 90)
  start.setHours(0, 0, 0, 0)
  const end = new Date()
  end.setDate(end.getDate() + 365)
  end.setHours(23, 59, 59, 999)
  return { startDate: start, endDate: end }
}

const computeSlotRange = (slotTime, duration) => {
  const startTime = new Date(slotTime)
  const endTime = new Date(startTime)
  // Use setTime with milliseconds to properly handle fractional hours (e.g., 1.5 hours)
  endTime.setTime(startTime.getTime() + duration * 60 * 60 * 1000)
  return { startTime, endTime }
}

// Client-side check: end time must not exceed the amenity's closing hour
const isBeyondClosingHour = (amenity, endTime) => {
  const amenityEndHour = typeof amenity.endHour === 'number'
    ? amenity.endHour
    : DEFAULT_AVAILABILITY.endHour
  const endHours = endTime.getHours() + endTime.getMinutes() / 60
  return endHours > amenityEndHour
}

const generateAlternativeSlots = (originalStart, originalEnd, durationHours) => {
  const alternatives = []
  const sameDay = new Date(originalStart)
  sameDay.setHours(9, 0, 0, 0) // Start from 9 AM

  // Generate slots every 2 hours
  for (let hour = 9; hour <= 20; hour += 2) {
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

const formatDateTimeForDisplay = (value, locale, t) => {
  if (!value) return t('common.na')
  const d = value instanceof Date ? value : new Date(value)
  const datePart = formatDateDDMMYYYY(d)
  const timePart = d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
  return `${datePart} ${timePart}`
}

const deduplicateBookings = (bookings) => bookings.filter((booking, index, arr) =>
  index === arr.findIndex(b =>
    b.amenityId === booking.amenityId &&
    String(b.startTime) === String(booking.startTime) &&
    String(b.endTime) === String(booking.endTime)
  )
)

const buildFixedDeskPlans = (deduplicatedBookings) => {
  const grouped = {}
  deduplicatedBookings
    .filter(b => b.planType === 'fixed-desk' && new Date(b.startTime) > new Date())
    .forEach(b => {
      if (!grouped[b.planGroupId]) grouped[b.planGroupId] = []
      grouped[b.planGroupId].push(b)
    })
  return Object.entries(grouped).map(([id, bks]) => {
    const sorted = [...bks].sort((a, b) => new Date(a.startTime) - new Date(b.startTime))
    return {
      planGroupId: id,
      amenityId: sorted[0].amenityId,
      planPeriod: sorted[0].planPeriod,
      startDate: sorted[0].startTime,
      endDate: sorted[sorted.length - 1].endTime,
      status: sorted[0].status,
      count: sorted.length,
    }
  })
}

const getTodayString = () => {
  const d = new Date()
  return d.toISOString().split('T')[0]
}

const getMinRecurringEndDate = (selectedDate) => {
  const base = selectedDate instanceof Date ? new Date(selectedDate) : new Date()
  base.setMonth(base.getMonth() + 1)
  base.setHours(0, 0, 0, 0)
  return base.toISOString().split('T')[0]
}

const useBookingForm = (amenities, searchParams, setSearchParams) => {
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
  const [isCheckingConflict, setIsCheckingConflict] = useState(false)
  const [isSubmittingBooking, setIsSubmittingBooking] = useState(false)
  const isSubmittingRef = useRef(false)

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

  // Recalculate end time when duration changes and start time is already selected
  useEffect(() => {
    if (selectedStartTime && duration) {
      const newEndTime = new Date(selectedStartTime)
      // Use setTime with milliseconds to properly handle fractional hours (e.g., 1.5 hours)
      newEndTime.setTime(selectedStartTime.getTime() + duration * 60 * 60 * 1000)
      setSelectedEndTime(newEndTime)
    }
  }, [duration, selectedStartTime])

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

  const openForAmenity = (amenity) => {
    setSelectedAmenity(amenity)
    setDuration(DEFAULT_DURATION_HOURS[amenity.type] || 2)
    setSelectedDate(new Date())
    setIsModalOpen(true)
    setBookingStep(1)
  }

  return {
    isModalOpen,
    selectedAmenity,
    bookingStep,
    setBookingStep,
    selectedDate,
    setSelectedDate,
    selectedStartTime,
    setSelectedStartTime,
    selectedEndTime,
    setSelectedEndTime,
    duration,
    setDuration,
    recurrence,
    setRecurrence,
    conflictError,
    setConflictError,
    alternativeSlots,
    setAlternativeSlots,
    isCheckingConflict,
    setIsCheckingConflict,
    isSubmittingBooking,
    setIsSubmittingBooking,
    isSubmittingRef,
    resetBookingForm,
    openForAmenity,
  }
}

const useFixedDeskForm = () => {
  const [fdModalOpen, setFdModalOpen] = useState(false)
  const [fdStep, setFdStep] = useState(1)
  const [fdAmenity, setFdAmenity] = useState(null)
  const [fdPeriod, setFdPeriod] = useState('weekly')
  const [fdStartDate, setFdStartDate] = useState('')

  const resetFdForm = () => {
    setFdModalOpen(false)
    setFdStep(1)
    setFdAmenity(null)
    setFdPeriod('weekly')
    setFdStartDate('')
  }

  const openForAmenity = (amenity) => {
    setFdAmenity(amenity)
    setFdPeriod('weekly')
    setFdStartDate('')
    setFdStep(1)
    setFdModalOpen(true)
  }

  return {
    fdModalOpen,
    fdStep,
    setFdStep,
    fdAmenity,
    setFdAmenity,
    fdPeriod,
    setFdPeriod,
    fdStartDate,
    setFdStartDate,
    resetFdForm,
    openForAmenity,
  }
}

const useBookingMutations = (form, fd) => {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const createMutation = useMutation({
    mutationFn: createBooking,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] })
      showToast(t('toast.bookingCreated'), 'success')
      form.resetBookingForm()
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
        { allowedWeekdays: form.selectedAmenity?.availableDays }
      ),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] })
      showToast(t('toast.recurringBookingsCreated', { count: result.totalCreated }), 'success')
      form.resetBookingForm()
    },
    onError: (error) => {
      showToast(t('toast.recurringBookingsFailed'), 'error')
      console.error('Recurring booking error:', error)
    }
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => updateBooking(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] })
      showToast(t('toast.bookingUpdated'), 'success')
    }
  })

  const deleteMutation = useMutation({
    mutationFn: deleteBooking,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] })
      showToast(t('toast.bookingDeleted'), 'success')
    }
  })

  const fixedDeskMutation = useMutation({
    mutationFn: ({ memberId, amenityId, period, startDate }) =>
      createFixedDeskPlan({ memberId, amenityId, period, startDate, checkConflictsFn: checkBookingConflicts }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] })
      showToast(t('toast.fixedDeskCreated', { count: result.totalCreated }), 'success')
      fd.resetFdForm()
    },
    onError: () => {
      showToast(t('toast.fixedDeskFailed'), 'error')
    }
  })

  const cancelPlanMutation = useMutation({
    mutationFn: cancelFixedDeskPlan,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] })
      showToast(t('toast.fixedDeskCancelled'), 'success')
    }
  })

  return {
    createMutation,
    recurringMutation,
    updateMutation,
    deleteMutation,
    fixedDeskMutation,
    cancelPlanMutation,
  }
}

const useBookingHandlers = ({ currentUser, navigate, form, fd, mutations, t }) => {
  const handleBookAmenity = (amenity) => {
    if (amenity.type === 'event-space') {
      navigate(`/member/events?action=create&amenityId=${amenity.id}`)
      return
    }
    form.openForAmenity(amenity)
  }

  const applyConflictCheckError = (error) => {
    if (error?.code === 'functions/invalid-argument') {
      form.setConflictError(error.message || t('memberBookings.outsideHoursError'))
    } else {
      console.warn('Could not check conflicts:', error)
      form.setConflictError(t('memberBookings.conflictCheckFailed'))
    }
    form.setAlternativeSlots([])
  }

  const handleTimeSlotSelect = async (slotTime, advance = false) => {
    if (!form.selectedAmenity) return

    const { startTime, endTime } = computeSlotRange(slotTime, form.duration)
    form.setSelectedStartTime(startTime)
    form.setSelectedEndTime(endTime)

    if (isBeyondClosingHour(form.selectedAmenity, endTime)) {
      form.setConflictError(t('memberBookings.outsideHoursError'))
      form.setAlternativeSlots([])
      return
    }

    form.setIsCheckingConflict(true)

    // Check for conflicts
    try {
      const conflictCheck = await checkBookingConflicts(
        form.selectedAmenity.id,
        startTime.toISOString(),
        endTime.toISOString()
      )

      if (conflictCheck.hasConflicts) {
        form.setConflictError(t('memberBookings.conflictError'))
        // Suggest alternatives (same day, different times)
        form.setAlternativeSlots(generateAlternativeSlots(startTime, endTime, form.duration))
      } else {
        form.setConflictError(null)
        form.setAlternativeSlots([])
        if (advance) form.setBookingStep(2)
      }
    } catch (error) {
      applyConflictCheckError(error)
    } finally {
      form.setIsCheckingConflict(false)
    }
  }

  const handleUseAlternative = (altSlot) => {
    handleTimeSlotSelect(altSlot.start, true)
  }

  const finishSubmitting = () => {
    form.isSubmittingRef.current = false
    form.setIsSubmittingBooking(false)
  }

  const handleConfirmBooking = async () => {
    if (!form.selectedStartTime || !form.selectedEndTime || !form.selectedAmenity) return
    if (form.isSubmittingRef.current) return
    form.isSubmittingRef.current = true
    form.setIsSubmittingBooking(true)

    // Final conflict check
    try {
      const conflictCheck = await checkBookingConflicts(
        form.selectedAmenity.id,
        form.selectedStartTime.toISOString(),
        form.selectedEndTime.toISOString()
      )

      if (conflictCheck.hasConflicts) {
        showToast(t('toast.slotNoLongerAvailable'), 'error')
        form.setBookingStep(1)
        finishSubmitting()
        return
      }
    } catch (error) {
      console.warn('Could not check conflicts:', error)
      showToast(t('memberBookings.conflictCheckFailed'), 'error')
      finishSubmitting()
      return
    }

    const baseBooking = {
      memberId: currentUser.uid,
      amenityId: form.selectedAmenity.id,
      startTime: form.selectedStartTime.toISOString(),
      endTime: form.selectedEndTime.toISOString()
    }

    try {
      if (form.recurrence) {
        // Create recurring bookings
        await mutations.recurringMutation.mutateAsync({ baseBooking, recurrence: form.recurrence })
      } else {
        // Create single booking
        await mutations.createMutation.mutateAsync(baseBooking)
      }
    } catch (error) {
      // Errors are already surfaced via mutation onError/toast
      console.error('Booking submission error:', error)
    } finally {
      finishSubmitting()
    }
  }

  const handleRecurringToggle = () => {
    if (form.recurrence) {
      form.setRecurrence(null)
    } else {
      form.setBookingStep(3)
    }
  }

  const handleRecurringSubmit = (e) => {
    e.preventDefault()
    const formData = new FormData(e.target)
    form.setRecurrence({
      frequency: formData.get('frequency'),
      endDate: formData.get('endDate') || null,
      occurrences: formData.get('occurrences') ? parseInt(formData.get('occurrences')) : null
    })
    form.setBookingStep(2)
  }

  const handleCancel = async (id) => {
    if (window.confirm(t('memberBookings.confirmCancel'))) {
      await mutations.updateMutation.mutateAsync({ id, data: { status: 'cancelled' } })
    }
  }

  const handleDelete = async (id) => {
    if (window.confirm(t('memberBookings.confirmDelete'))) {
      await mutations.deleteMutation.mutateAsync(id)
    }
  }

  const handleFdConfirm = () => {
    if (!fd.fdAmenity || !fd.fdStartDate) return
    mutations.fixedDeskMutation.mutate({
      memberId: currentUser.uid,
      amenityId: fd.fdAmenity.id,
      period: fd.fdPeriod,
      startDate: fd.fdStartDate,
    })
  }

  const handleCancelPlan = async (planGroupId) => {
    if (window.confirm(t('fixedDesk.confirmCancel'))) {
      await mutations.cancelPlanMutation.mutateAsync(planGroupId)
    }
  }

  return {
    handleBookAmenity,
    handleTimeSlotSelect,
    handleUseAlternative,
    handleConfirmBooking,
    handleRecurringToggle,
    handleRecurringSubmit,
    handleCancel,
    handleDelete,
    handleFdConfirm,
    handleCancelPlan,
  }
}

const AmenityCard = ({ amenity, t, onBook, onShowPhotos, onRegisterFixedDesk }) => (
  <div className="amenity-card">
    {amenity.photos && amenity.photos.length > 0 ? (
      <button
        type="button"
        className="amenity-photo-preview amenity-photo-clickable"
        onClick={() => onShowPhotos(amenity)}
        aria-label={`View photos of ${amenity.name}`}
      >
        <img src={amenity.photos[0]} alt={amenity.name} loading="lazy" decoding="async" />
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
    <div className="amenity-card-actions">
      <button
        className="btn btn-primary btn-book"
        onClick={() => onBook(amenity)}
      >
        {t('memberBookings.bookNow')}
      </button>
      {amenity.type === 'desk' && (
        <button
          className="btn btn-secondary btn-book"
          onClick={() => onRegisterFixedDesk(amenity)}
        >
          {t('fixedDesk.registerShort')}
        </button>
      )}
    </div>
  </div>
)

const AmenitiesSection = ({ t, amenitiesLoading, availableAmenities, onBook, onShowPhotos, onRegisterFixedDesk }) => (
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
          <AmenityCard
            key={amenity.id}
            amenity={amenity}
            t={t}
            onBook={onBook}
            onShowPhotos={onShowPhotos}
            onRegisterFixedDesk={onRegisterFixedDesk}
          />
        ))}
      </div>
    ) : (
      <p className="empty-state">{t('memberBookings.noAmenities')}</p>
    )}
  </div>
)

const BookingCard = ({ booking, amenity, t, locale, showActions, onCancel, onDelete }) => (
  <div className="booking-card">
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
          {t('memberBookings.start')} {formatDateTimeForDisplay(booking.startTime, locale, t)}
        </p>
        <p className="booking-time">
          {t('memberBookings.end')} {formatDateTimeForDisplay(booking.endTime, locale, t)}
        </p>
      </div>
    </div>
    {showActions && (
      <div className="booking-actions">
        {booking.status === 'pending' && (
          <>
            <button
              className="btn btn-danger btn-sm"
              onClick={() => onCancel(booking.id)}
            >
              {t('common.cancel')}
            </button>
            <button
              className="btn btn-danger btn-sm"
              onClick={() => onDelete(booking.id)}
            >
              {t('common.delete')}
            </button>
          </>
        )}
      </div>
    )}
  </div>
)

const BookingsListSection = ({ title, emptyText, bookings, amenities, t, locale, showActions, onCancel, onDelete }) => (
  <div className="bookings-section glass">
    <div className="section-header">
      <h2 className="section-title">{title}</h2>
    </div>
    {bookings.length > 0 ? (
      <div className="bookings-list">
        {bookings.map(booking => (
          <BookingCard
            key={booking.id}
            booking={booking}
            amenity={amenities.find(a => a.id === booking.amenityId)}
            t={t}
            locale={locale}
            showActions={showActions}
            onCancel={onCancel}
            onDelete={onDelete}
          />
        ))}
      </div>
    ) : (
      <p className="empty-state">{emptyText}</p>
    )}
  </div>
)

const FixedDeskPlanCard = ({ plan, amenity, t, onCancelPlan, cancelPending }) => (
  <div className="fixed-desk-plan-card">
    <div className="fixed-desk-plan-band" />
    <div className="fixed-desk-plan-body">
      <div className="fixed-desk-plan-top">
        <span className="fixed-desk-plan-name">{amenity?.name || plan.amenityId}</span>
        <div className="fixed-desk-plan-badges">
          <span className="fixed-desk-badge">{t('fixedDesk.badge')}</span>
          <span className={`status-badge ${plan.status}`}>{plan.status}</span>
        </div>
      </div>
      <div className="fixed-desk-plan-meta">
        <span className="fixed-desk-plan-period">
          {plan.planPeriod === 'weekly' ? t('fixedDesk.weekly') : t('fixedDesk.monthly')}
        </span>
        <span className="fixed-desk-plan-dates">
          {formatDateDDMMYYYY(plan.startDate)} – {formatDateDDMMYYYY(plan.endDate)}
        </span>
        <span className="fixed-desk-plan-count">
          {t('fixedDesk.workingDays', { count: plan.count })}
        </span>
      </div>
      <button
        className="btn btn-danger btn-sm"
        onClick={() => onCancelPlan(plan.planGroupId)}
        disabled={cancelPending}
      >
        {t('fixedDesk.cancelPlan')}
      </button>
    </div>
  </div>
)

const FixedDeskPlansSection = ({ plans, amenities, t, onCancelPlan, cancelPending }) => {
  if (plans.length === 0) return null
  return (
    <div className="bookings-section glass">
      <div className="section-header">
        <h2 className="section-title">{t('fixedDesk.title')}</h2>
        <p className="section-description">{t('fixedDesk.description')}</p>
      </div>
      <div className="fixed-desk-plans-list">
        {plans.map(plan => (
          <FixedDeskPlanCard
            key={plan.planGroupId}
            plan={plan}
            amenity={amenities.find(a => a.id === plan.amenityId)}
            t={t}
            onCancelPlan={onCancelPlan}
            cancelPending={cancelPending}
          />
        ))}
      </div>
    </div>
  )
}

const BookingStepCalendar = ({ form, handlers, t, locale }) => (
  <div className="booking-step">
    <div className="form-group">
      <label className="form-label">
        {t('memberBookings.modal.duration')}
      </label>
      <select
        className="form-field"
        value={form.duration}
        onChange={(e) => form.setDuration(parseFloat(e.target.value))}
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
        <option value="9">{t('memberBookings.modal.durationFullDay')}</option>
      </select>
    </div>

    <BookingCalendar
      amenityId={form.selectedAmenity.id}
      selectedDate={form.selectedDate}
      onDateChange={form.setSelectedDate}
      onTimeSlotSelect={handlers.handleTimeSlotSelect}
      selectedStartTime={form.selectedStartTime}
      selectedEndTime={form.selectedEndTime}
      viewMode="week"
      disabled={form.isCheckingConflict}
    />

    {form.conflictError && (
      <div className="conflict-error">
        <p className="error-message">{form.conflictError}</p>
        {form.alternativeSlots.length > 0 && (
          <div className="alternative-slots">
            <p>{t('memberBookings.modal.alternativesLabel')}</p>
            {form.alternativeSlots.map((alt, index) => (
              <button
                key={index}
                className="btn btn-secondary btn-sm"
                onClick={() => handlers.handleUseAlternative(alt)}
              >
                {alt.start.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' })} -{' '}
                {alt.end.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' })}
              </button>
            ))}
          </div>
        )}
      </div>
    )}

    {form.selectedStartTime && !form.conflictError && (
      <div className="selected-time-info">
        <p>
          {t('memberBookings.modal.selectedRange', {
            start: formatDateTimeForDisplay(form.selectedStartTime, locale, t),
            end: formatDateTimeForDisplay(form.selectedEndTime, locale, t)
          })}
        </p>
        <button
          className="btn btn-primary"
          onClick={() => handlers.handleTimeSlotSelect(form.selectedStartTime, true)}
          disabled={form.isCheckingConflict}
        >
          {form.isCheckingConflict
            ? t('memberBookings.modal.checking')
            : t('memberBookings.modal.continue')}
        </button>
      </div>
    )}
  </div>
)

const BookingSummary = ({ form, t, locale }) => (
  <div className="booking-summary">
    <h3>{t('memberBookings.modal.summaryTitle')}</h3>
    <div className="summary-item">
      <strong>{t('memberBookings.modal.summaryAmenity')}</strong> {form.selectedAmenity.name}
    </div>
    <div className="summary-item">
      <strong>{t('memberBookings.modal.summaryStart')}</strong>{' '}
      {form.selectedStartTime ? formatDateTimeForDisplay(form.selectedStartTime, locale, t) : t('common.na')}
    </div>
    <div className="summary-item">
      <strong>{t('memberBookings.modal.summaryEnd')}</strong>{' '}
      {form.selectedEndTime ? formatDateTimeForDisplay(form.selectedEndTime, locale, t) : t('common.na')}
    </div>
    <div className="summary-item">
      <strong>{t('memberBookings.modal.summaryDuration')}</strong>{' '}
      {form.duration >= 1
        ? t('memberBookings.modal.durationHours', { count: form.duration })
        : t('memberBookings.modal.durationMinutes', { count: form.duration * 60 })}
    </div>
  </div>
)

const BookingStepConfirm = ({ form, handlers, mutations, t, locale }) => {
  const isSaving = form.isSubmittingBooking || mutations.createMutation.isPending || mutations.recurringMutation.isPending
  return (
    <div className="booking-step">
      <BookingSummary form={form} t={t} locale={locale} />

      <div className="form-group">
        <label className="form-checkbox">
          <input
            type="checkbox"
            checked={!!form.recurrence}
            onChange={handlers.handleRecurringToggle}
          />
          <span>{t('memberBookings.modal.recurringLabel')}</span>
        </label>
        {form.recurrence && (
          <div className="recurrence-info">
            <p>
              {t('memberBookings.modal.recurringSummary', {
                frequency: form.recurrence.frequency
              })}
            </p>
            {form.recurrence.endDate && (
              <p>
                {t('memberBookings.modal.recurringUntil', {
                  date: formatDateDDMMYYYY(form.recurrence.endDate)
                })}
              </p>
            )}
            {form.recurrence.occurrences && (
              <p>
                {t('memberBookings.modal.recurringOccurrences', {
                  count: form.recurrence.occurrences
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
          onClick={() => form.setBookingStep(1)}
        >
          {t('memberBookings.modal.back')}
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={handlers.handleConfirmBooking}
          disabled={isSaving}
        >
          {isSaving
            ? t('memberBookings.modal.creating')
            : t('memberBookings.modal.confirm')}
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={form.resetBookingForm}
        >
          {t('common.close')}
        </button>
      </div>
    </div>
  )
}

const BookingStepRecurring = ({ form, handlers, t }) => (
  <div className="booking-step">
    <h3>{t('memberBookings.modal.recurringOptionsTitle')}</h3>
    <form onSubmit={handlers.handleRecurringSubmit}>
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
          min={getMinRecurringEndDate(form.selectedDate)}
          defaultValue={getMinRecurringEndDate(form.selectedDate)}
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
          onClick={() => form.setBookingStep(2)}
        >
          {t('memberBookings.modal.back')}
        </button>
        <button type="submit" className="btn btn-primary">
          {t('memberBookings.modal.setRecurrence')}
        </button>
      </div>
    </form>
  </div>
)

const BookingModalContent = ({ form, handlers, mutations, t, locale }) => {
  if (!form.selectedAmenity) return null
  return (
    <>
      {form.bookingStep === 1 && (
        <BookingStepCalendar form={form} handlers={handlers} t={t} locale={locale} />
      )}
      {form.bookingStep === 2 && (
        <BookingStepConfirm form={form} handlers={handlers} mutations={mutations} t={t} locale={locale} />
      )}
      {form.bookingStep === 3 && (
        <BookingStepRecurring form={form} handlers={handlers} t={t} />
      )}
    </>
  )
}

const FixedDeskModalContent = ({ fd, deskAmenities, handlers, t, isPending }) => (
  <>
    {fd.fdStep === 1 && (
      <div className="booking-step">
        <div className="form-group">
          <label className="form-label">{t('fixedDesk.selectDesk')}</label>
          <div className="fixed-desk-desk-grid">
            {deskAmenities.map(a => (
              <button
                key={a.id}
                type="button"
                className={`fixed-desk-desk-option${fd.fdAmenity?.id === a.id ? ' selected' : ''}`}
                onClick={() => fd.setFdAmenity(a)}
              >
                {a.name}
              </button>
            ))}
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">{t('fixedDesk.period')}</label>
          <div className="recurring-frequency-options">
            <label className="form-checkbox">
              <input type="radio" checked={fd.fdPeriod === 'weekly'} onChange={() => fd.setFdPeriod('weekly')} />
              <span>{t('fixedDesk.weekly')}</span>
            </label>
            <label className="form-checkbox">
              <input type="radio" checked={fd.fdPeriod === 'monthly'} onChange={() => fd.setFdPeriod('monthly')} />
              <span>{t('fixedDesk.monthly')}</span>
            </label>
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">{t('fixedDesk.startDate')}</label>
          <input
            type="date"
            className="form-field"
            min={getTodayString()}
            value={fd.fdStartDate}
            onChange={e => fd.setFdStartDate(e.target.value)}
          />
        </div>
        <div className="form-actions">
          <button type="button" className="btn btn-secondary" onClick={fd.resetFdForm}>
            {t('common.close')}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => fd.setFdStep(2)}
            disabled={!fd.fdAmenity || !fd.fdStartDate}
          >
            {t('common.continue')}
          </button>
        </div>
      </div>
    )}

    {fd.fdStep === 2 && fd.fdAmenity && (
      <div className="booking-step">
        <div className="booking-summary">
          <h3>{t('fixedDesk.summaryTitle')}</h3>
          <div className="summary-item">
            <strong>{t('fixedDesk.summaryDesk')}</strong> {fd.fdAmenity.name}
          </div>
          <div className="summary-item">
            <strong>{t('fixedDesk.summaryPeriod')}</strong>{' '}
            {fd.fdPeriod === 'weekly' ? t('fixedDesk.weekly') : t('fixedDesk.monthly')}
          </div>
          <div className="summary-item">
            <strong>{t('fixedDesk.summaryStart')}</strong> {formatDateDDMMYYYY(fd.fdStartDate)}
          </div>
          <div className="summary-item">
            <strong>{t('fixedDesk.summaryHours')}</strong> {t('fixedDesk.workingHours')}
          </div>
          <p className="form-hint">{t('fixedDesk.summaryNote')}</p>
        </div>
        <div className="form-actions">
          <button type="button" className="btn btn-secondary" onClick={() => fd.setFdStep(1)}>
            {t('memberBookings.modal.back')}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handlers.handleFdConfirm}
            disabled={isPending}
          >
            {isPending ? t('memberBookings.modal.creating') : t('fixedDesk.confirm')}
          </button>
        </div>
      </div>
    )}
  </>
)

const MemberBookings = () => {
  const { t, i18n } = useTranslation()
  const { currentUser } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [lightboxAmenity, setLightboxAmenity] = useState(null)
  const locale = getLocale(i18n)
  const memberBookingsWindow = getMemberBookingsWindow()

  const { data: myBookings = [] } = useQuery({
    queryKey: ['bookings', currentUser?.uid],
    queryFn: () => getBookings({ memberId: currentUser?.uid, ...memberBookingsWindow }),
    enabled: !!currentUser?.uid
  })

  const { data: amenities = [], isLoading: amenitiesLoading } = useQuery({
    queryKey: ['amenities'],
    queryFn: getAmenities
  })

  const form = useBookingForm(amenities, searchParams, setSearchParams)
  const fd = useFixedDeskForm()
  const mutations = useBookingMutations(form, fd)
  const handlers = useBookingHandlers({ currentUser, navigate, form, fd, mutations, t })

  const availableAmenities = amenities.filter(a => a.isAvailable !== false)
  const deskAmenities = availableAmenities.filter(a => a.type === 'desk')

  const deduplicatedBookings = deduplicateBookings(myBookings)
  const upcomingBookings = deduplicatedBookings.filter(b => new Date(b.startTime) > new Date())
  const pastBookings = deduplicatedBookings.filter(b => new Date(b.startTime) <= new Date())

  const fixedDeskPlans = useMemo(() => buildFixedDeskPlans(deduplicatedBookings), [deduplicatedBookings])

  return (
    <Layout>
      <div className="container">
        <div className="page-header">
          <h1 className="page-title">{t('memberBookings.title')}</h1>
        </div>

        <AmenitiesSection
          t={t}
          amenitiesLoading={amenitiesLoading}
          availableAmenities={availableAmenities}
          onBook={handlers.handleBookAmenity}
          onShowPhotos={setLightboxAmenity}
          onRegisterFixedDesk={fd.openForAmenity}
        />

        <BookingsListSection
          title={t('memberBookings.upcomingBookings')}
          emptyText={t('memberBookings.noUpcomingBookings')}
          bookings={upcomingBookings}
          amenities={amenities}
          t={t}
          locale={locale}
          showActions
          onCancel={handlers.handleCancel}
          onDelete={handlers.handleDelete}
        />

        <FixedDeskPlansSection
          plans={fixedDeskPlans}
          amenities={amenities}
          t={t}
          onCancelPlan={handlers.handleCancelPlan}
          cancelPending={mutations.cancelPlanMutation.isPending}
        />

        <BookingsListSection
          title={t('memberBookings.pastBookings')}
          emptyText={t('memberBookings.noPastBookings')}
          bookings={pastBookings}
          amenities={amenities}
          t={t}
          locale={locale}
        />

        <Modal
          isOpen={form.isModalOpen}
          onClose={form.resetBookingForm}
          title={
            form.selectedAmenity
              ? t('memberBookings.modal.titleWithAmenity', { name: form.selectedAmenity.name })
              : t('memberBookings.modal.titleFallback')
          }
        >
          <BookingModalContent form={form} handlers={handlers} mutations={mutations} t={t} locale={locale} />
        </Modal>

        {/* Fixed Desk Registration Modal */}
        <Modal
          isOpen={fd.fdModalOpen}
          onClose={fd.resetFdForm}
          title={t('fixedDesk.modalTitle')}
        >
          <FixedDeskModalContent
            fd={fd}
            deskAmenities={deskAmenities}
            handlers={handlers}
            t={t}
            isPending={mutations.fixedDeskMutation.isPending}
          />
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
