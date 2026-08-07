import { httpsCallable } from 'firebase/functions'
import { functions } from './firebase'
import { parseBookingRanges } from '../utils/bookingRanges'

// Check for booking conflicts before creating a booking
export const checkBookingConflicts = async (amenityId, startTime, endTime, excludeBookingId = null) => {
  try {
    const checkConflicts = httpsCallable(functions, 'checkBookingConflicts')
    const result = await checkConflicts({
      amenityId,
      startTime: new Date(startTime).toISOString(),
      endTime: new Date(endTime).toISOString(),
      excludeBookingId
    })
    return result.data
  } catch (error) {
    console.error('Error checking booking conflicts:', error)
    // If function doesn't exist or fails, return no conflicts (graceful degradation)
    return { hasConflicts: false, conflicts: [] }
  }
}

// Busy ranges for one amenity, used by BookingCalendar to grey out taken
// slots. Members may not list bookings by amenity directly — firestore.rules
// scopes their reads to their own documents — so occupancy comes from the
// callable, which returns start/end/status and no member identity.
//
// Deliberately unlike checkBookingConflicts above: this one throws. Swallowing
// the error would leave the calendar with an empty range list, which paints
// every slot free and invites the double booking that neither the advisory
// conflict check nor firestore.rules would catch.
export const getAmenityBookingRanges = async (amenityId, startTime, endTime) => {
  const loadRanges = httpsCallable(functions, 'getAmenityBookingRanges')
  const result = await loadRanges({
    amenityId,
    startTime: new Date(startTime).toISOString(),
    endTime: new Date(endTime).toISOString()
  })
  // Throws on a malformed payload rather than reporting an empty calendar.
  return parseBookingRanges(result.data)
}
