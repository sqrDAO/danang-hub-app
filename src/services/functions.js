import { httpsCallable } from 'firebase/functions'
import { functions } from './firebase'

// Check slot availability (no auth required - for chatbot)
export const checkSlotAvailabilityCallable = async (amenityId, startTime, endTime) => {
  try {
    const checkAvailability = httpsCallable(functions, 'checkSlotAvailability')
    const result = await checkAvailability({
      amenityId,
      startTime: new Date(startTime).toISOString(),
      endTime: new Date(endTime).toISOString()
    })
    return result.data
  } catch (error) {
    console.error('Error checking slot availability:', error)
    return { available: false, conflicts: [] }
  }
}

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
