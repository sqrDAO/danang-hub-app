// Pure helpers for the checkBookingConflicts callable: which failures are
// worth one retry, which rejection means "the amenity does not take this
// slot", and which message a failure should show. No Firebase imports, so
// node --test can load this file.

// Set by functions/index.js on the invalid-argument it raises for a closure,
// a day off or hours outside the amenity's. Malformed input carries no reason.
export const SLOT_UNAVAILABLE_REASON = 'slot-unavailable'

// Codes a second attempt can plausibly fix: the network, a cold start or a
// server hiccup. Anything else (invalid-argument, permission-denied,
// unauthenticated, not-found, failed-precondition, ...) would fail again.
const TRANSIENT_CODES = new Set([
  'functions/unavailable',
  'functions/deadline-exceeded',
  'functions/internal',
  'functions/unknown',
  'functions/aborted'
])

export const isTransientConflictError = (error) => TRANSIENT_CODES.has(error?.code)

// True only for the server's deliberate "not this slot" answer. A plain
// invalid-argument means the client sent a bad request and must not be
// mistaken for an unavailable day.
export const isSlotUnavailableError = (error) =>
  error?.code === 'functions/invalid-argument' &&
  error?.details?.reason === SLOT_UNAVAILABLE_REASON

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms))

// Runs `attempt` and, if it fails with a transient error, runs it once more
// after `delayMs`. The second failure (or any non-transient one) is thrown.
export const retryTransientOnce = async (attempt, delayMs = 300) => {
  try {
    return await attempt()
  } catch (error) {
    if (!isTransientConflictError(error)) throw error
    if (delayMs > 0) await wait(delayMs)
    return attempt()
  }
}

// Tags an error as coming from the conflict check, so a caller several layers
// up (a recurring or fixed-desk mutation) can say "could not verify
// availability" instead of a generic failure.
export const markConflictCheckError = (error) => {
  if (error && typeof error === 'object') error.conflictCheckFailed = true
  return error
}

// Message key for a failed check on a single booking.
export const conflictCheckErrorKey = (error) =>
  isSlotUnavailableError(error) ? 'toast.slotNoLongerAvailable' : 'memberBookings.conflictCheckFailed'

// Message key for a failed series (recurring, fixed desk, renewal): the
// conflict-check message when the check itself failed, else `fallbackKey`.
export const seriesErrorKey = (error, fallbackKey) =>
  error?.conflictCheckFailed ? 'memberBookings.conflictCheckFailed' : fallbackKey

// Whether a slot must be left out of a series. Taken, or refused by the
// server as a day the amenity does not take, both mean "skip it"; any other
// failure (malformed input, network, permissions) is thrown, so the series
// fails closed instead of silently skipping every day.
export const isSlotTaken = async (checkConflictsFn, ...args) => {
  try {
    const { hasConflicts } = await checkConflictsFn(...args)
    return hasConflicts
  } catch (error) {
    if (isSlotUnavailableError(error)) return true
    throw error
  }
}
