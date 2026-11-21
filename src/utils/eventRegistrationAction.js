const registrationOutcome = (event, memberId) => {
  if (!event) return 'missing'
  if (event.status !== 'approved' || !(new Date(event.date) > new Date())) return 'unavailable'
  if (event.attendees?.includes(memberId)) return 'alreadyRegistered'
  if (event.capacity && event.attendees?.length >= event.capacity) return 'full'
  return 'ready'
}

// The caller supplies a server-only read. No cached list participates in this
// decision. This remains best-effort: another client can fill the last seat
// between the read and write until capacity is enforced atomically server-side.
export const runFreshRegistration = async ({ eventId, memberId, loadEvent, isActive, register }) => {
  let event
  try {
    event = await loadEvent(eventId)
  } catch {
    return isActive() ? 'failed' : 'cancelled'
  }
  if (!isActive()) return 'cancelled'
  const outcome = registrationOutcome(event, memberId)
  if (outcome !== 'ready') return outcome
  register({ eventId, memberId })
  return 'registered'
}
