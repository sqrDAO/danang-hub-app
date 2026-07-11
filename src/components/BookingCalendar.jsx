import { useState, useMemo, useEffect, useCallback, memo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { getBookings } from '../services/bookings'
import { getAmenity, DEFAULT_AVAILABILITY } from '../services/amenities'
import { CalendarSkeleton } from './LoadingSkeleton'
import './BookingCalendar.css'

const TimeSlot = memo(function TimeSlot({ status, title, slotKey, onSelect }) {
  const clickable = status === 'available'
  return (
    <div
      className={`time-slot ${status}`}
      onClick={clickable && onSelect ? () => onSelect(slotKey) : undefined}
      title={title}
    />
  )
})

const countOverlappingBookings = (slotMs, bookingRanges) => {
  let overlapping = 0
  for (let i = 0; i < bookingRanges.length; i++) {
    const [s, e] = bookingRanges[i]
    if (slotMs >= s && slotMs < e) overlapping++
  }
  return overlapping
}

const computeSlotStatus = (slotMs, { dayAvailable, now, selStart, selEnd, bookingRanges, isSharedDesk, capacity }) => {
  if (!dayAvailable) return 'unavailable'
  if (slotMs < now) return 'past'
  if (selStart !== null && selEnd !== null && slotMs >= selStart && slotMs < selEnd) return 'selected'
  const overlapping = countOverlappingBookings(slotMs, bookingRanges)
  const booked = isSharedDesk ? overlapping >= capacity : overlapping > 0
  return booked ? 'booked' : 'available'
}

const getSlotTitle = (status, time, t) =>
  status === 'unavailable' ? t('calendar.closed') :
  status === 'past' ? t('calendar.past') :
  status === 'booked' ? t('calendar.booked') :
  status === 'selected' ? t('calendar.selected') :
  t('calendar.availableAt', { time })

const BookingCalendar = ({
  amenityId,
  selectedDate,
  onDateChange,
  onTimeSlotSelect,
  selectedStartTime = null,
  selectedEndTime = null,
  viewMode = 'week', // 'day' or 'week'
  disabled = false
}) => {
  const { t, i18n } = useTranslation()
  const locale = i18n.language?.startsWith('vi') ? 'vi-VN' : 'en-US'
  const [currentDate, setCurrentDate] = useState(selectedDate || new Date())
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

  // Fetch bookings for the visible week (with a 1-week buffer on each side
  // to cover prev/next nav without a refetch storm).
  const weekWindowStart = useMemo(() => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() - 7)
    d.setHours(0, 0, 0, 0)
    return d
  }, [weekStart])
  const weekWindowEnd = useMemo(() => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + 14)
    d.setHours(23, 59, 59, 999)
    return d
  }, [weekStart])
  const { data: allBookings = [], isLoading } = useQuery({
    queryKey: ['bookings', amenityId, weekStart.toISOString().split('T')[0]],
    queryFn: () => getBookings({ amenityId, startDate: weekWindowStart, endDate: weekWindowEnd }),
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

  // Check if a day is available for booking (used by date column header)
  const isDayAvailable = useCallback((date) => {
    return availability.availableDays.includes(date.getDay())
  }, [availability.availableDays])

  const effectiveViewMode = isMobile ? 'day' : viewMode
  const displayDates = useMemo(
    () => (effectiveViewMode === 'week' ? weekDates : [currentDate]),
    [effectiveViewMode, weekDates, currentDate]
  )

  // Pre-compute status + title for every slot in the visible grid.
  // Recomputes only when bookings, selection, availability, or visible dates change —
  // not on every parent re-render. Hover state was removed (was dead, caused 196-slot thrash).
  const dateSlots = useMemo(() => {
    const now = Date.now()
    const selStart = selectedStartTime ? new Date(selectedStartTime).getTime() : null
    const selEnd = selectedEndTime ? new Date(selectedEndTime).getTime() : null
    const capacity = typeof amenity?.capacity === 'number' && amenity.capacity > 0
      ? amenity.capacity
      : 1
    const isSharedDesk = amenity?.type === 'desk' && capacity > 1

    // Pre-parse booking ranges once per memo run instead of per slot
    const bookingRanges = bookings.map(b => [
      new Date(b.startTime).getTime(),
      new Date(b.endTime).getTime(),
    ])

    return displayDates.map(date => {
      const dayAvailable = availability.availableDays.includes(date.getDay())
      const ctx = { dayAvailable, now, selStart, selEnd, bookingRanges, isSharedDesk, capacity }
      const slots = timeSlots.map(slot => {
        const slotDate = new Date(date)
        const [h, m] = slot.time.split(':').map(Number)
        slotDate.setHours(h, m, 0, 0)
        const slotMs = slotDate.getTime()

        const status = computeSlotStatus(slotMs, ctx)
        const title = getSlotTitle(status, slot.time, t)

        return { key: slotMs, status, title }
      })
      return { date, dayAvailable, slots }
    })
  }, [
    displayDates, timeSlots, bookings,
    selectedStartTime, selectedEndTime,
    availability.availableDays,
    amenity?.capacity, amenity?.type,
    t,
  ])

  const handleSlotSelect = useCallback((slotKey) => {
    if (disabled) return
    onTimeSlotSelect?.(new Date(slotKey))
  }, [disabled, onTimeSlotSelect])

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

      <div className={`calendar-grid${disabled ? ' calendar-grid--disabled' : ''}`}>
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

        {dateSlots.map(({ date, dayAvailable, slots }, dateIndex) => (
          <div key={dateIndex} className={`date-column ${!dayAvailable ? 'unavailable-day' : ''}`}>
            {formatDateHeader(date)}
            <div className="time-slots">
              {slots.map(slot => (
                <TimeSlot
                  key={slot.key}
                  slotKey={slot.key}
                  status={slot.status}
                  title={slot.title}
                  onSelect={handleSlotSelect}
                />
              ))}
            </div>
          </div>
        ))}
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
