import { useState, useMemo, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { getBookings } from '../services/bookings'
import { DEFAULT_AVAILABILITY } from '../services/amenities'
import { getBaseSlotStatus, getPointState } from '../utils/bookingRange'
import { CalendarSkeleton } from './LoadingSkeleton'
import './BookingCalendar.css'

const CLICKABLE_STATUSES = new Set([
  'available',
  'range-start',
  'range-end',
  'range-selected',
  'range-end-candidate',
  'range-start-candidate',
])

const SLOT_TITLE_KEYS = {
  booked: 'calendar.booked',
  closing: 'calendar.closingTime',
  past: 'calendar.past',
  'range-blocked': 'calendar.rangeUnavailable',
  'range-end': 'calendar.endSelected',
  'range-end-candidate': 'calendar.selectEndAt',
  'range-selected': 'calendar.adjustEndAt',
  'range-start': 'calendar.startSelected',
  'range-start-candidate': 'calendar.adjustStartAt',
  unavailable: 'calendar.closed',
}

const SLOT_MARKER_KEYS = {
  'range-end': 'calendar.endMarker',
  'range-start': 'calendar.startMarker',
}

const TimeSlot = ({ point, onSelect }) => {
  const clickable = CLICKABLE_STATUSES.has(point.status)

  return (
    <button
      type="button"
      className={`time-slot ${point.status}`}
      onClick={clickable ? () => onSelect(point.nextRange) : undefined}
      disabled={!clickable}
      title={point.title}
      aria-label={point.title}
    >
      {point.marker && <span className="time-slot-marker">{point.marker}</span>}
    </button>
  )
}

const getSlotTitle = (status, time, t) => {
  const key = SLOT_TITLE_KEYS[status]
  return key ? t(key, { time }) : t('calendar.availableAt', { time })
}

const makeDateAtTime = (date, hour, minute) => {
  const slotDate = new Date(date)
  slotDate.setHours(hour, minute, 0, 0)
  return slotDate.getTime()
}

const getTimeSlots = (availability) => {
  const slots = []
  for (let hour = availability.startHour; hour < availability.endHour; hour++) {
    for (let minute = 0; minute < 60; minute += availability.slotDuration) {
      slots.push({ hour, minute, time: `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}` })
    }
  }
  return slots
}

const getWeekStart = (value) => {
  const date = new Date(value)
  const day = date.getDay()
  date.setDate(date.getDate() - day + (day === 0 ? -6 : 1))
  return date
}

const getWeekDates = (weekStart) => Array.from({ length: 7 }, (_, index) => {
  const date = new Date(weekStart)
  date.setDate(weekStart.getDate() + index)
  return date
})

const BookingCalendar = ({
  amenity,
  onRangeChange,
  selectedStartTime = null,
  selectedEndTime = null,
  viewMode = 'week',
  disabled = false,
}) => {
  const { t, i18n } = useTranslation()
  const locale = i18n.language?.startsWith('vi') ? 'vi-VN' : 'en-US'
  const [currentDate, setCurrentDate] = useState(new Date())
  const [isMobile, setIsMobile] = useState(false)
  const availability = useMemo(() => ({
    startHour: amenity?.startHour ?? DEFAULT_AVAILABILITY.startHour,
    endHour: amenity?.endHour ?? DEFAULT_AVAILABILITY.endHour,
    availableDays: amenity?.availableDays ?? DEFAULT_AVAILABILITY.availableDays,
    slotDuration: amenity?.slotDuration ?? DEFAULT_AVAILABILITY.slotDuration,
  }), [amenity])
  const weekStart = useMemo(() => getWeekStart(currentDate), [currentDate])
  const timeSlots = useMemo(() => getTimeSlots(availability), [availability])
  const weekDates = useMemo(() => getWeekDates(weekStart), [weekStart])
  const effectiveViewMode = isMobile ? 'day' : viewMode
  const displayDates = useMemo(
    () => (effectiveViewMode === 'week' ? weekDates : [currentDate]),
    [effectiveViewMode, weekDates, currentDate]
  )
  const bookingWindow = useMemo(() => {
    const startDate = new Date(weekStart)
    startDate.setDate(startDate.getDate() - 7)
    startDate.setHours(0, 0, 0, 0)
    const endDate = new Date(weekStart)
    endDate.setDate(endDate.getDate() + 14)
    endDate.setHours(23, 59, 59, 999)
    return { startDate, endDate }
  }, [weekStart])
  const { data: allBookings = [], isLoading } = useQuery({
    queryKey: ['bookings', amenity?.id, weekStart.toISOString().split('T')[0]],
    queryFn: () => getBookings({ amenityId: amenity.id, ...bookingWindow }),
    enabled: !!amenity?.id,
  })

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768)
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const dateSlots = useMemo(() => {
    const now = Date.now()
    const selection = {
      startMs: selectedStartTime ? new Date(selectedStartTime).getTime() : null,
      endMs: selectedEndTime ? new Date(selectedEndTime).getTime() : null,
    }
    const capacity = typeof amenity?.capacity === 'number' && amenity.capacity > 0 ? amenity.capacity : 1
    const isSharedDesk = amenity?.type === 'desk' && capacity > 1
    const bookingRanges = allBookings
      .filter(({ status }) => ['pending', 'approved', 'checked-in'].includes(status))
      .map(({ startTime, endTime }) => [new Date(startTime).getTime(), new Date(endTime).getTime()])

    return displayDates.map(date => {
      const dayAvailable = availability.availableDays.includes(date.getDay())
      const context = { dayAvailable, now, bookingRanges, isSharedDesk, capacity }
      const intervals = timeSlots.map(slot => {
        const key = makeDateAtTime(date, slot.hour, slot.minute)
        return { ...slot, key, status: getBaseSlotStatus(key, context) }
      })
      const closingPoint = {
        key: makeDateAtTime(date, availability.endHour, 0),
        time: `${availability.endHour.toString().padStart(2, '0')}:00`,
        baseStatus: 'closing',
        isBoundary: true,
      }
      const points = intervals.map(interval => ({ ...interval, baseStatus: interval.status, isBoundary: false }))
      return {
        date,
        dayAvailable,
        points: [...points, closingPoint].map(point => {
          const state = getPointState(point, selection, intervals)
          const markerKey = SLOT_MARKER_KEYS[state.status]
          return {
            ...point,
            ...state,
            marker: markerKey ? t(markerKey) : null,
            title: getSlotTitle(state.status, point.time, t),
          }
        }),
      }
    })
  }, [allBookings, amenity?.capacity, amenity?.type, availability, displayDates, selectedEndTime, selectedStartTime, t, timeSlots])

  const updateCurrentDate = (nextDate) => {
    setCurrentDate(nextDate)
  }

  const handlePointSelect = (nextRange) => {
    if (disabled || !nextRange) return
    onRangeChange?.({
      startTime: nextRange.startMs === null ? null : new Date(nextRange.startMs),
      endTime: nextRange.endMs === null ? null : new Date(nextRange.endMs),
    })
  }

  const handlePrevWeek = () => {
    const nextDate = new Date(currentDate)
    nextDate.setDate(nextDate.getDate() + (effectiveViewMode === 'week' ? -7 : -1))
    updateCurrentDate(nextDate)
  }

  const handleNextWeek = () => {
    const nextDate = new Date(currentDate)
    nextDate.setDate(nextDate.getDate() + (effectiveViewMode === 'week' ? 7 : 1))
    updateCurrentDate(nextDate)
  }

  const formatDateHeader = (date, dayAvailable) => {
    const isToday = date.toDateString() === new Date().toDateString()
    return (
      <div className={`calendar-date-header ${isToday ? 'today' : ''} ${!dayAvailable ? 'weekend' : ''}`}>
        <div className="date-day-name">{date.toLocaleDateString(locale, { weekday: 'short' })}</div>
        <div className="date-day-number">{date.getDate()}</div>
        <div className="date-month">{date.toLocaleDateString(locale, { month: 'short' })}</div>
        {!dayAvailable && <div className="weekend-label">{t('calendar.closed')}</div>}
      </div>
    )
  }

  if (isLoading) return <CalendarSkeleton />

  const closingTime = `${availability.endHour.toString().padStart(2, '0')}:00`
  const timePoints = [...timeSlots, { minute: 0, time: closingTime }]

  return (
    <div className="booking-calendar">
      <div className="calendar-header">
        <div className="calendar-nav">
          <button type="button" className="btn btn-secondary btn-sm" onClick={handlePrevWeek}>{t('calendar.prev')}</button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => updateCurrentDate(new Date())}>{t('calendar.today')}</button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={handleNextWeek}>{t('calendar.next')}</button>
        </div>
        <div className="calendar-title">
          {effectiveViewMode === 'week'
            ? weekStart.toLocaleDateString(locale, { month: 'long', year: 'numeric' })
            : currentDate.toLocaleDateString(locale, { month: 'long', day: 'numeric', year: 'numeric' })}
        </div>
        <div className="calendar-hours-info">
          {t('calendar.hours')} {availability.startHour}:00 - {availability.endHour}:00 {t('calendar.monFri')}
        </div>
      </div>

      <div className={`calendar-grid${disabled ? ' calendar-grid--disabled' : ''}`}>
        <div className="time-column">
          <div className="time-labels">
            {timePoints.map((slot, index) => (
              <div key={`${slot.time}-${index}`} className={slot.minute === 0 ? 'time-label' : 'time-spacer'}>
                {slot.minute === 0 ? slot.time : ''}
              </div>
            ))}
          </div>
        </div>

        {dateSlots.map(({ date, dayAvailable, points }) => (
          <div key={date.toISOString()} className={`date-column ${!dayAvailable ? 'unavailable-day' : ''}`}>
            {formatDateHeader(date, dayAvailable)}
            <div className="time-slots">
              {points.map(point => <TimeSlot key={point.key} point={point} onSelect={handlePointSelect} />)}
            </div>
          </div>
        ))}
      </div>

    </div>
  )
}

export default BookingCalendar
