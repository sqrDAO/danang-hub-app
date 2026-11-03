import { httpsCallable } from 'firebase/functions'
import { functions } from './firebase'
import { parseBookingRanges } from '../utils/bookingRanges'
import { LOCAL_DEV_MODE } from '../utils/localDevMode'
import { markConflictCheckError, retryTransientOnce } from '../utils/conflictCheck'
import {
  checkLocalBookingConflicts,
  editLocalOwnEvent,
  listLocalAmenityRanges,
  reviewLocalEvent
} from './localDevStore'

// Fails closed: this callable is the only overlap check (firestore.rules has
// none), so an error means the slot could not be verified and booking it would
// be unsafe. A transient failure (network, cold start) is retried once. A day
// the amenity does not take is rejected with invalid-argument and
// details.reason 'slot-unavailable' (see isSlotUnavailableError). Every error
// thrown is tagged conflictCheckFailed so callers can name the cause.
export const checkBookingConflicts = async (amenityId, startTime, endTime, excludeBookingId = null) => {
  if (LOCAL_DEV_MODE) {
    return checkLocalBookingConflicts(amenityId, startTime, endTime, excludeBookingId)
  }
  const checkConflicts = httpsCallable(functions, 'checkBookingConflicts')
  const payload = {
    amenityId,
    startTime: new Date(startTime).toISOString(),
    endTime: new Date(endTime).toISOString(),
    excludeBookingId
  }
  try {
    const result = await retryTransientOnce(() => checkConflicts(payload))
    if (typeof result?.data?.hasConflicts !== 'boolean') {
      throw new Error('Invalid booking conflict response')
    }
    return result.data
  } catch (error) {
    throw markConflictCheckError(error)
  }
}

// Busy ranges for one amenity, used by BookingCalendar to grey out taken
// slots. Members may not list bookings by amenity directly — firestore.rules
// scopes their reads to their own documents — so occupancy comes from the
// callable, which returns start/end/status and no member identity.
//
// Throws like checkBookingConflicts above. Swallowing the error would leave
// the calendar with an empty range list, which paints every slot free and
// invites the double booking that firestore.rules would not catch.
export const getAmenityBookingRanges = async (amenityId, startTime, endTime) => {
  if (LOCAL_DEV_MODE) return listLocalAmenityRanges(amenityId, startTime, endTime)
  const loadRanges = httpsCallable(functions, 'getAmenityBookingRanges')
  const result = await loadRanges({
    amenityId,
    startTime: new Date(startTime).toISOString(),
    endTime: new Date(endTime).toISOString()
  })
  // Throws on a malformed payload rather than reporting an empty calendar.
  return parseBookingRanges(result.data)
}

// Boots getAmenityBookingRanges before the member picks an amenity, so the
// calendar's real call lands on a running instance instead of a cold start.
// No amenityId, so the function rejects with invalid-argument; that rejection
// is the expected outcome and is ignored.
export const warmAmenityBookingRanges = () => {
  if (LOCAL_DEV_MODE) return
  httpsCallable(functions, 'getAmenityBookingRanges')({}).catch(() => {})
}

// Same for checkBookingConflicts, which the member's Continue waits on.
export const warmBookingConflictCheck = () => {
  if (LOCAL_DEV_MODE) return
  httpsCallable(functions, 'checkBookingConflicts')({}).catch(() => {})
}

export const editOwnEvent = async ({ eventId, expectedRevision, data }) => {
  if (LOCAL_DEV_MODE) return editLocalOwnEvent({ eventId, expectedRevision, data })
  const editEvent = httpsCallable(functions, 'editOwnEvent')
  const result = await editEvent({ eventId, expectedRevision, data })
  return result.data
}

export const reviewEvent = async ({ eventId, expectedRevision, action, reason = '' }) => {
  if (LOCAL_DEV_MODE) return reviewLocalEvent({ eventId, action, reason })
  const review = httpsCallable(functions, 'reviewEvent')
  const result = await review({ eventId, expectedRevision, action, reason })
  return result.data
}

// Admin-only: detaches the partner's members, releases its desk, deletes it
// and cancels the members' upcoming partner days. Local dev goes through
// deletePartner (services/partners.js) instead.
export const removePartner = async (partnerId) => {
  const remove = httpsCallable(functions, 'removePartner')
  const result = await remove({ partnerId })
  return result.data
}
