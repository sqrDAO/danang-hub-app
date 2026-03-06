import { useState, useMemo, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { getBookings } from '../services/bookings'
import { getAmenity, DEFAULT_AVAILABILITY } from '../services/amenities'
import { CalendarSkeleton } from './LoadingSkeleton'
import './BookingCalendar.css'

const BookingCalendar = ({ 
  amenityId, 
  selectedDate, 
  onDateChange, 
  onTimeSlotSelect,
  selectedStartTime = null,
  selectedEndTime = null,
  viewMode = 'week' // 'day' or 'week'
}) => {
  const { t, i18n } = useTranslation()
  const locale = i18n.language?.startsWith('vi') ? 'vi-VN' : 'en-US'
  const [currentDate, setCurrentDate] = useState(selectedDate || new Date())
  const [hoveredSlot, setHoveredSlot] = useState(null)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768)
    }

    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Fetch amenity to get its availability settings
  const { data: amenity } = useQuery({
    queryKey: ['amenity', amenityId],
    queryFn: () => getAmenity(amenityId),
    enabled: !!amenityId
  })

  // Get availability settings from amenity or use defaults
  const availability = useMemo(() => {
    return {
      startHour: amenity?.startHour ?? DEFAULT_AVAILABILITY.startHour,
      endHour: amenity?.endHour ?? DEFAULT_AVAILABILITY.endHour,
      availableDays: amenity?.availableDays ?? DEFAULT_AVAILABILITY.availableDays,
      slotDuration: amenity?.slotDuration ?? DEFAULT_AVAILABILITY.slotDuration
    }
  }, [amenity])

  // Get start of week for week view
  const weekStart = useMemo(() => {
    const date = new Date(currentDate)
    const day = date.getDay()
    const diff = date.getDate() - day + (day === 0 ? -6 : 1) // Monday as first day
    return new Date(date.setDate(diff))
  }, [currentDate])

  // Fetch bookings for the visible period
  const { data: allBookings = [], isLoading } = useQuery({
    queryKey: ['bookings', amenityId, weekStart.toISOString().split('T')[0]],
    queryFn: () => getBookings({ amenityId }),
    enabled: !!amenityId
  })

  // Filter to only active bookings
  const bookings = useMemo(() => {
    return allBookings.filter(b => 
      ['pending', 'approved', 'checked-in'].includes(b.status)
    )
  }, [allBookings])

  // Generate time slots based on availability settings
  const timeSlots = useMemo(() => {
    const slots = []
    for (let hour = availability.startHour; hour < availability.endHour; hour++) {
      for (let minute = 0; minute < 60; minute += availability.slotDuration) {
        slots.push({
          hour,
          minute,
          time: `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
        })
      }
    }
    return slots
  }, [availability.startHour, availability.endHour, availability.slotDuration])

  // Generate dates for week view
  const weekDates = useMemo(() => {
    const dates = []
    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStart)
      date.setDate(weekStart.getDate() + i)
      dates.push(date)
    }
    return dates
  }, [weekStart])

  // Check if a day is available for booking
  const isDayAvailable = (date) => {
    const dayOfWeek = date.getDay()
    return availability.availableDays.includes(dayOfWeek)
  }

  // Check if a slot is in the past
  const isSlotInPast = (date, timeSlot) => {
    const now = new Date()
    const slotDateTime = new Date(date)
    const [hours, minutes] = timeSlot.time.split(':').map(Number)
    slotDateTime.setHours(hours, minutes, 0, 0)
    return slotDateTime < now
  }

  // Check if a time slot is fully booked (respect amenity capacity for shared spaces)
  const isSlotBooked = (date, timeSlot) => {
    if (!bookings.length) return false

    const slotDateTime = new Date(date)
    const [hours, minutes] = timeSlot.time.split(':').map(Number)
    slotDateTime.setHours(hours, minutes, 0, 0)

    const overlappingCount = bookings.reduce((count, booking) => {
      const start = new Date(booking.startTime)
      const end = new Date(booking.endTime)
      return slotDateTime >= start && slotDateTime < end
        ? count + 1
        : count
    }, 0)

    const capacity = typeof amenity?.capacity === 'number' && amenity.capacity > 0
      ? amenity.capacity
      : 1

    // Desks are treated as shared coworking spaces with capacity-based concurrency
    if (amenity?.type === 'desk' && capacity > 1) {
      return overlappingCount >= capacity
    }

    // For non-desk amenities, any overlap means the slot is booked
    return overlappingCount > 0
  }

  // Check if slot is selected
  const isSlotSelected = (date, timeSlot) => {
    if (!selectedStartTime || !selectedEndTime) return false
    
    const slotDateTime = new Date(date)
    const [hours, minutes] = timeSlot.time.split(':').map(Number)
    slotDateTime.setHours(hours, minutes, 0, 0)
    
    return slotDateTime >= new Date(selectedStartTime) && slotDateTime < new Date(selectedEndTime)
  }

  // Get slot status
  const getSlotStatus = (date, timeSlot) => {
    if (!isDayAvailable(date)) return 'unavailable'
    if (isSlotInPast(date, timeSlot)) return 'past'
    if (isSlotSelected(date, timeSlot)) return 'selected'
    if (isSlotBooked(date, timeSlot)) return 'booked'
    return 'available'
  }

  const handleSlotClick = (date, timeSlot) => {
    const status = getSlotStatus(date, timeSlot)
    if (status !== 'available') return
    
    const slotDateTime = new Date(date)
    const [hours, minutes] = timeSlot.time.split(':').map(Number)
    slotDateTime.setHours(hours, minutes, 0, 0)
    
    onTimeSlotSelect?.(slotDateTime)
  }

  const effectiveViewMode = isMobile ? 'day' : viewMode

  const handlePrevWeek = () => {
    const newDate = new Date(currentDate)
    const step = effectiveViewMode === 'week' ? -7 : -1
    newDate.setDate(newDate.getDate() + step)
    setCurrentDate(newDate)
    onDateChange?.(newDate)
  }

  const handleNextWeek = () => {
    const newDate = new Date(currentDate)
    const step = effectiveViewMode === 'week' ? 7 : 1
    newDate.setDate(newDate.getDate() + step)
    setCurrentDate(newDate)
    onDateChange?.(newDate)
  }

  const handleToday = () => {
    const today = new Date()
    setCurrentDate(today)
    onDateChange?.(today)
  }

  const formatDateHeader = (date) => {
    const today = new Date()
    const isToday = date.toDateString() === today.toDateString()
    const isWeekend = !isDayAvailable(date)
    
    return (
      <div className={`calendar-date-header ${isToday ? 'today' : ''} ${isWeekend ? 'weekend' : ''}`}>
        <div className="date-day-name">{date.toLocaleDateString(locale, { weekday: 'short' })}</div>
        <div className="date-day-number">{date.getDate()}</div>
        <div className="date-month">{date.toLocaleDateString(locale, { month: 'short' })}</div>
        {isWeekend && <div className="weekend-label">{t('calendar.closed')}</div>}
      </div>
    )
  }

  const displayDates = effectiveViewMode === 'week' ? weekDates : [currentDate]

  if (isLoading && !amenityId) {
    return <CalendarSkeleton />
  }

  return (
    <div className="booking-calendar">
      <div className="calendar-header">
        <div className="calendar-nav">
          <button className="btn btn-secondary btn-sm" onClick={handlePrevWeek}>
            {t('calendar.prev')}
          </button>
          <button className="btn btn-secondary btn-sm" onClick={handleToday}>
            {t('calendar.today')}
          </button>
          <button className="btn btn-secondary btn-sm" onClick={handleNextWeek}>
            {t('calendar.next')}
          </button>
        </div>
        <div className="calendar-title">
          {effectiveViewMode === 'week' 
            ? weekStart.toLocaleDateString(locale, { month: 'long', year: 'numeric' })
            : currentDate.toLocaleDateString(locale, { month: 'long', day: 'numeric', year: 'numeric' })
          }
        </div>
        <div className="calendar-hours-info">
          {t('calendar.hours')} {availability.startHour}:00 - {availability.endHour}:00 {t('calendar.monFri')}
        </div>
      </div>

      <div className="calendar-grid">
        <div className="time-column">
          <div className="time-labels">
            {timeSlots.map((slot, index) => (
              <div 
                key={index} 
                className={slot.minute === 0 ? 'time-label' : 'time-spacer'}
              >
                {slot.minute === 0 ? slot.time : ''}
              </div>
            ))}
          </div>
        </div>

        {displayDates.map((date, dateIndex) => {
          const dayAvailable = isDayAvailable(date)
          return (
            <div key={dateIndex} className={`date-column ${!dayAvailable ? 'unavailable-day' : ''}`}>
              {formatDateHeader(date)}
              <div className="time-slots">
                {timeSlots.map((slot, slotIndex) => {
                  const status = getSlotStatus(date, slot)
                  return (
                    <div
                      key={slotIndex}
                      className={`time-slot ${status}`}
                      onClick={() => handleSlotClick(date, slot)}
                      onMouseEnter={() => setHoveredSlot({ date, slot })}
                      onMouseLeave={() => setHoveredSlot(null)}
                      title={
                        status === 'unavailable' ? t('calendar.closed') :
                        status === 'past' ? t('calendar.past') :
                        status === 'booked' ? t('calendar.booked') :
                        status === 'selected' ? t('calendar.selected') :
                        t('calendar.availableAt', { time: slot.time })
                      }
                    />
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      <div className="calendar-legend">
        <div className="legend-item">
          <div className="legend-color available"></div>
          <span>{t('calendar.legendAvailable')}</span>
        </div>
        <div className="legend-item">
          <div className="legend-color booked"></div>
          <span>{t('calendar.legendBooked')}</span>
        </div>
        <div className="legend-item">
          <div className="legend-color selected"></div>
          <span>{t('calendar.legendSelected')}</span>
        </div>
        <div className="legend-item">
          <div className="legend-color unavailable"></div>
          <span>{t('calendar.legendClosedPast')}</span>
        </div>
      </div>
    </div>
  )
}

export default BookingCalendar
