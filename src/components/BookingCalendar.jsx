import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
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
  const [currentDate, setCurrentDate] = useState(selectedDate || new Date())
  const [hoveredSlot, setHoveredSlot] = useState(null)

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

  // Check if a time slot is booked
  const isSlotBooked = (date, timeSlot) => {
    if (!bookings.length) return false
    
    const slotDateTime = new Date(date)
    const [hours, minutes] = timeSlot.time.split(':').map(Number)
    slotDateTime.setHours(hours, minutes, 0, 0)
    
    return bookings.some(booking => {
      const start = new Date(booking.startTime)
      const end = new Date(booking.endTime)
      return slotDateTime >= start && slotDateTime < end
    })
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

  const handlePrevWeek = () => {
    const newDate = new Date(currentDate)
    newDate.setDate(newDate.getDate() - 7)
    setCurrentDate(newDate)
    onDateChange?.(newDate)
  }

  const handleNextWeek = () => {
    const newDate = new Date(currentDate)
    newDate.setDate(newDate.getDate() + 7)
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
        <div className="date-day-name">{date.toLocaleDateString('en-US', { weekday: 'short' })}</div>
        <div className="date-day-number">{date.getDate()}</div>
        <div className="date-month">{date.toLocaleDateString('en-US', { month: 'short' })}</div>
        {isWeekend && <div className="weekend-label">Closed</div>}
      </div>
    )
  }

  const displayDates = viewMode === 'week' ? weekDates : [currentDate]

  if (isLoading && !amenityId) {
    return <CalendarSkeleton />
  }

  return (
    <div className="booking-calendar">
      <div className="calendar-header">
        <div className="calendar-nav">
          <button className="btn btn-secondary btn-sm" onClick={handlePrevWeek}>
            ← Prev
          </button>
          <button className="btn btn-secondary btn-sm" onClick={handleToday}>
            Today
          </button>
          <button className="btn btn-secondary btn-sm" onClick={handleNextWeek}>
            Next →
          </button>
        </div>
        <div className="calendar-title">
          {viewMode === 'week' 
            ? `${weekStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`
            : currentDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
          }
        </div>
        <div className="calendar-hours-info">
          Hours: {availability.startHour}:00 - {availability.endHour}:00 (Mon-Fri)
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
                        status === 'unavailable' ? 'Closed' :
                        status === 'past' ? 'Past' :
                        status === 'booked' ? 'Booked' : 
                        status === 'selected' ? 'Selected' : 
                        `Available - ${slot.time}`
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
          <span>Available</span>
        </div>
        <div className="legend-item">
          <div className="legend-color booked"></div>
          <span>Booked</span>
        </div>
        <div className="legend-item">
          <div className="legend-color selected"></div>
          <span>Selected</span>
        </div>
        <div className="legend-item">
          <div className="legend-color unavailable"></div>
          <span>Closed/Past</span>
        </div>
      </div>
    </div>
  )
}

export default BookingCalendar
