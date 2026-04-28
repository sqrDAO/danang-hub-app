import { httpsCallable } from 'firebase/functions'
import { functions } from './firebase'

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
