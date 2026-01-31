import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../contexts/AuthContext'
import { getBookings } from '../services/bookings'
import { getApprovedEvents } from '../services/events'
import { getAmenities } from '../services/amenities'
import './UnifiedCalendar.css'

const UnifiedCalendar = ({ viewMode = 'month' }) => {
  const { currentUser, isAdmin } = useAuth()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedFilter, setSelectedFilter] = useState('all') // 'all', 'bookings', 'events'
  const [selectedAmenityType, setSelectedAmenityType] = useState('')

  // Fetch bookings - admins see all, members see only their own
  const { data: bookings = [], isLoading: bookingsLoading, error: bookingsError } = useQuery({
    queryKey: ['bookings', isAdmin() ? 'all' : currentUser?.uid],
    queryFn: () => {
      if (isAdmin()) {
        // Admin can see all bookings
        return getBookings()
      } else {
        // Members can only see their own bookings
        return getBookings({ memberId: currentUser?.uid })
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
      filtered = filtered.filter(b => {
        const amenity = amenities.find(a => a.id === b.amenityId)
        return amenity?.type === selectedAmenityType
      })
    }

    return filtered
  }, [bookings, selectedAmenityType, amenities, bookingsError])

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
    
    if (selectedFilter === 'all' || selectedFilter === 'bookings') {
      filteredBookings.forEach(booking => {
        // Ensure booking has valid dates
        if (!booking.startTime) return
        
        const startDate = new Date(booking.startTime)
        const endDate = booking.endTime ? new Date(booking.endTime) : startDate
        
        // Skip if date is invalid
        if (isNaN(startDate.getTime())) return
        
        // Check if this booking belongs to the current user
        const userIsAdmin = isAdmin()
        const currentUserId = currentUser?.uid
        const bookingMemberId = booking.memberId
        
        // Determine ownership:
        // - For members: All bookings in the query result are theirs (query filters by memberId)
        //   But we still verify to catch any data issues
        // - For admins: Check if booking.memberId matches currentUser.uid
        let belongsToUser = false
        
        if (!currentUserId) {
          // No current user - can't be theirs
          belongsToUser = false
        } else if (userIsAdmin) {
          // Admin viewing all bookings - check memberId
          belongsToUser = String(bookingMemberId || '') === String(currentUserId)
        } else {
          // Member viewing - query filters by memberId, so all should be theirs
          // But verify to catch data issues
          const bookingIdStr = String(bookingMemberId || '').trim()
          const userIdStr = String(currentUserId).trim()
          belongsToUser = bookingIdStr === userIdStr && bookingIdStr !== ''
          
          // If mismatch, log warning but still mark as theirs (trust the query filter)
          if (!belongsToUser && bookingIdStr !== '') {
            console.warn('UnifiedCalendar: Booking memberId mismatch (but query filtered by memberId)', {
              bookingId: booking.id,
              bookingMemberId: bookingIdStr,
              currentUserId: userIdStr,
              booking
            })
            // Trust the query - if it's in results, it's the user's booking
            belongsToUser = true
          } else if (bookingIdStr === '') {
            // No memberId in booking - shouldn't happen
            console.warn('UnifiedCalendar: Booking missing memberId', {
              bookingId: booking.id,
              booking
            })
            belongsToUser = false
          }
        }
        
        items.push({
          type: 'booking',
          id: booking.id,
          title: amenities.find(a => a.id === booking.amenityId)?.name || 'Unknown Amenity',
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
        // Ensure event has valid date
        if (!event.date) return
        
        const eventDate = new Date(event.date)
        
        // Skip if date is invalid
        if (isNaN(eventDate.getTime())) return
        
        items.push({
          type: 'event',
          id: event.id,
          title: event.title || 'Untitled Event',
          start: eventDate,
          end: eventDate,
          isMine: event.attendees?.includes(currentUser?.uid) || false,
          data: event
        })
      })
    }

    return items
  }, [filteredBookings, filteredEvents, selectedFilter, amenities, currentUser])

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
    const newDate = new Date(currentDate)
    newDate.setMonth(newDate.getMonth() - 1)
    setCurrentDate(newDate)
  }

  const handleNextMonth = () => {
    const newDate = new Date(currentDate)
    newDate.setMonth(newDate.getMonth() + 1)
    setCurrentDate(newDate)
  }

  const handleToday = () => {
    setCurrentDate(new Date())
  }

  const getDayItems = (date) => {
    if (!date) return []
    return itemsByDate[date.toDateString()] || []
  }

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
          {calendarDays.map((date, index) => {
            const isToday = date && date.toDateString() === new Date().toDateString()
            const dayItems = getDayItems(date)
            
            return (
              <div
                key={index}
                className={`calendar-day ${!date ? 'empty' : ''} ${isToday ? 'today' : ''}`}
              >
                {date && (
                  <>
                    <div className="day-number">{date.getDate()}</div>
                    <div className="day-items">
                      {dayItems.slice(0, 3).map(item => (
                        <div
                          key={item.id}
                          className={`day-item day-item-${item.type} ${item.isMine ? 'mine' : ''} ${item.status === 'pending' ? 'pending' : ''}`}
                          title={`${item.type === 'booking' ? 'Booking' : 'Event'}: ${item.title}${item.status === 'pending' ? ' (Pending)' : ''}`}
                        >
                          {item.title}
                        </div>
                      ))}
                      {dayItems.length > 3 && (
                        <div className="day-item-more">
                          +{dayItems.length - 3} more
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )
          })}
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
