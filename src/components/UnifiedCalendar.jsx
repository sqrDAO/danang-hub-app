import { useState, useMemo, memo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../hooks/useAuth'
import { getBookings } from '../services/bookings'
import { getApprovedEvents } from '../services/events'
import { getAmenities } from '../services/amenities'
import './UnifiedCalendar.css'

const EMPTY_ITEMS = []

const DayCell = memo(function DayCell({ date, isToday, items }) {
  if (!date) return <div className="calendar-day empty" />
  const visible = items.slice(0, 3)
  const extra = items.length - 3
  return (
    <div className={`calendar-day ${isToday ? 'today' : ''}`}>
      <div className="day-number">{date.getDate()}</div>
      <div className="day-items">
        {visible.map(item => (
          <div
            key={item.id}
            className={`day-item day-item-${item.type} ${item.isMine ? 'mine' : ''} ${item.status === 'pending' ? 'pending' : ''}`}
            title={`${item.type === 'booking' ? 'Booking' : 'Event'}: ${item.title}${item.status === 'pending' ? ' (Pending)' : ''}`}
          >
            {item.title}
          </div>
        ))}
        {extra > 0 && (
          <div className="day-item-more">+{extra} more</div>
        )}
      </div>
    </div>
  )
})

// Determine ownership:
// - For members: All bookings in the query result are theirs (query filters by memberId)
//   But we still verify to catch any data issues
// - For admins: Check if booking.memberId matches currentUser.uid
const bookingBelongsToUser = (booking, currentUserId, userIsAdmin) => {
  const bookingMemberId = booking.memberId

  if (!currentUserId) {
    return false
  }
  if (userIsAdmin) {
    return String(bookingMemberId || '') === String(currentUserId)
  }

  const bookingIdStr = String(bookingMemberId || '').trim()
  const userIdStr = String(currentUserId).trim()
  const belongsToUser = bookingIdStr === userIdStr && bookingIdStr !== ''

  if (!belongsToUser && bookingIdStr !== '') {
    console.warn('UnifiedCalendar: Booking memberId mismatch (but query filtered by memberId)', {
      bookingId: booking.id,
      bookingMemberId: bookingIdStr,
      currentUserId: userIdStr,
      booking
    })
    return true
  }
  if (bookingIdStr === '') {
    console.warn('UnifiedCalendar: Booking missing memberId', {
      bookingId: booking.id,
      booking
    })
    return false
  }
  return belongsToUser
}

const UnifiedCalendar = () => {
  const { currentUser, isAdmin } = useAuth()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedFilter, setSelectedFilter] = useState('all') // 'all', 'bookings', 'events'
  const [selectedAmenityType, setSelectedAmenityType] = useState('')

  // Calendar shows one month at a time; fetch a buffered window around the
  // currently viewed month so prev/next navigation doesn't refetch the world.
  const calendarYear = currentDate.getFullYear()
  const calendarMonth = currentDate.getMonth()
  const calendarWindowStart = new Date(calendarYear, calendarMonth - 1, 1)
  const calendarWindowEnd = new Date(calendarYear, calendarMonth + 2, 0, 23, 59, 59, 999)

  // Fetch bookings - admins see all, members see only their own
  const { data: bookings = [], error: bookingsError } = useQuery({
    queryKey: ['bookings', isAdmin() ? 'all' : currentUser?.uid, calendarYear, calendarMonth],
    queryFn: () => {
      const window = { startDate: calendarWindowStart, endDate: calendarWindowEnd }
      if (isAdmin()) {
        // Admin can see all bookings in the visible window
        return getBookings(window)
      } else {
        // Members can only see their own bookings in the visible window
        return getBookings({ memberId: currentUser?.uid, ...window })
      }
    },
    enabled: !!currentUser?.uid,
    onError: (error) => {
      console.error('Error fetching bookings:', error)
    }
  })

  const { data: events = [] } = useQuery({
    queryKey: ['approvedEvents'],
    queryFn: getApprovedEvents
  })

  const { data: amenities = [] } = useQuery({
    queryKey: ['amenities'],
    queryFn: getAmenities
  })

  // O(1) amenity lookup by id, built once per amenities update.
  // Replaces amenities.find() inside per-booking loops (was O(N×M)).
  const amenitiesById = useMemo(() => {
    const map = new Map()
    amenities.forEach(a => map.set(a.id, a))
    return map
  }, [amenities])

  // Filter bookings - only show approved, pending, or checked-in bookings
  const filteredBookings = useMemo(() => {
    if (!bookings || bookings.length === 0) {
      if (bookingsError) {
        console.error('UnifiedCalendar: Error loading bookings', bookingsError)
      }
      return []
    }

    let filtered = bookings.filter(b => {
      // Ensure booking has required fields
      if (!b || !b.status || !b.startTime) {
        return false
      }
      return ['pending', 'approved', 'checked-in'].includes(b.status)
    })

    if (selectedAmenityType) {
      filtered = filtered.filter(b => amenitiesById.get(b.amenityId)?.type === selectedAmenityType)
    }

    return filtered
  }, [bookings, selectedAmenityType, amenitiesById, bookingsError])

  // Filter events - only show approved events that are today or in the future
  const filteredEvents = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0) // Normalize to start of day
    
    return events.filter(e => {
      if (!e.date) return false
      const eventDate = new Date(e.date)
      eventDate.setHours(0, 0, 0, 0) // Normalize to start of day
      return eventDate >= today
    })
  }, [events])

  // Get items for current month
  const calendarItems = useMemo(() => {
    const items = []
    // Hoist user state out of the per-booking loop — invariant across this memo run
    const userIsAdmin = isAdmin()
    const currentUserId = currentUser?.uid

    if (selectedFilter === 'all' || selectedFilter === 'bookings') {
      filteredBookings.forEach(booking => {
        if (!booking.startTime) return

        const startDate = new Date(booking.startTime)
        const endDate = booking.endTime ? new Date(booking.endTime) : startDate

        if (isNaN(startDate.getTime())) return

        const belongsToUser = bookingBelongsToUser(booking, currentUserId, userIsAdmin)

        items.push({
          type: 'booking',
          id: booking.id,
          title: amenitiesById.get(booking.amenityId)?.name || 'Unknown Amenity',
          start: startDate,
          end: endDate,
          isMine: belongsToUser,
          status: booking.status,
          data: booking
        })
      })
    }

    if (selectedFilter === 'all' || selectedFilter === 'events') {
      filteredEvents.forEach(event => {
        if (!event.date) return

        const eventDate = new Date(event.date)
        if (isNaN(eventDate.getTime())) return

        items.push({
          type: 'event',
          id: event.id,
          title: event.title || 'Untitled Event',
          start: eventDate,
          end: eventDate,
          isMine: event.attendees?.includes(currentUserId) || false,
          data: event
        })
      })
    }

    return items
  }, [filteredBookings, filteredEvents, selectedFilter, amenitiesById, currentUser, isAdmin])

  // Group items by date
  const itemsByDate = useMemo(() => {
    const grouped = {}
    calendarItems.forEach(item => {
      const dateKey = item.start.toDateString()
      if (!grouped[dateKey]) {
        grouped[dateKey] = []
      }
      grouped[dateKey].push(item)
    })
    return grouped
  }, [calendarItems])

  // Generate calendar days
  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startingDayOfWeek = firstDay.getDay()

    const days = []
    
    // Add empty cells for days before month starts
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null)
    }

    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day)
      days.push(date)
    }

    return days
  }, [currentDate])

  const handlePrevMonth = () => {
    const newDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1)
    setCurrentDate(newDate)
  }

  const handleNextMonth = () => {
    const newDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1)
    setCurrentDate(newDate)
  }

  const handleToday = () => {
    setCurrentDate(new Date())
  }

  const todayKey = new Date().toDateString()

  const uniqueAmenityTypes = useMemo(() => {
    const types = new Set()
    amenities.forEach(a => {
      if (a.type) types.add(a.type)
    })
    return Array.from(types)
  }, [amenities])

  // Show error if bookings query failed
  if (bookingsError) {
    console.error('UnifiedCalendar: Bookings query error', bookingsError)
  }

  return (
    <div className="unified-calendar">
      {bookingsError && (
        <div className="error-message" style={{ 
          padding: '1rem', 
          marginBottom: '1rem', 
          backgroundColor: '#fee', 
          color: '#c33',
          borderRadius: '4px'
        }}>
          Error loading bookings: {bookingsError.message}
        </div>
      )}
      <div className="calendar-controls">
        <div className="calendar-nav">
          <button className="btn btn-secondary btn-sm" onClick={handlePrevMonth}>
            ← Prev
          </button>
          <button className="btn btn-secondary btn-sm" onClick={handleToday}>
            Today
          </button>
          <button className="btn btn-secondary btn-sm" onClick={handleNextMonth}>
            Next →
          </button>
        </div>
        <h2 className="calendar-title">
          {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </h2>
        <div className="calendar-filters">
          <select
            className="form-field filter-select"
            value={selectedFilter}
            onChange={(e) => setSelectedFilter(e.target.value)}
          >
            <option value="all">All</option>
            <option value="bookings">Bookings Only</option>
            <option value="events">Events Only</option>
          </select>
          {selectedFilter === 'all' || selectedFilter === 'bookings' ? (
            <select
              className="form-field filter-select"
              value={selectedAmenityType}
              onChange={(e) => setSelectedAmenityType(e.target.value)}
            >
              <option value="">All Amenity Types</option>
              {uniqueAmenityTypes.map(type => (
                <option key={type} value={type}>
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </option>
              ))}
            </select>
          ) : null}
        </div>
      </div>

      <div className="calendar-grid-month">
        <div className="calendar-weekdays">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="weekday-header">{day}</div>
          ))}
        </div>
        <div className="calendar-days">
          {calendarDays.map((date, index) => (
            <DayCell
              key={index}
              date={date}
              isToday={date ? date.toDateString() === todayKey : false}
              items={date ? (itemsByDate[date.toDateString()] || EMPTY_ITEMS) : EMPTY_ITEMS}
            />
          ))}
        </div>
      </div>

      <div className="calendar-legend">
        <div className="legend-item">
          <div className="legend-color day-item-booking"></div>
          <span>Booking</span>
        </div>
        <div className="legend-item">
          <div className="legend-color day-item-event"></div>
          <span>Event</span>
        </div>
        <div className="legend-item">
          <div className="legend-color pending"></div>
          <span>Pending</span>
        </div>
        <div className="legend-item">
          <div className="legend-color mine"></div>
          <span>Yours</span>
        </div>
      </div>
    </div>
  )
}

export default UnifiedCalendar
