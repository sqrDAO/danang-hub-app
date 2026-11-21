import { openEventLink } from '../components/event/eventFields.js'

export const EVENT_LIST_KEYS = [['approvedEvents'], ['upcomingEvents']]

export const isEventFull = event => event.capacity && event.attendees?.length >= event.capacity

export const registerFromEventCard = (event, memberId, register) => {
  openEventLink(event.eventLink)
  if (!isEventFull(event)) return register({ eventId: event.id, memberId })
}

const refreshCachedEvent = (queryClient, eventId, freshEvent) => {
  for (const queryKey of EVENT_LIST_KEYS) {
    const events = queryClient.getQueryData(queryKey)
    if (events === undefined) {
      // Restart an initial list read that might still deliver the older snapshot.
      if (queryClient.isFetching({ queryKey, exact: true })) void queryClient.resetQueries({ queryKey, exact: true })
      continue
    }
    // A background list refetch started before the server read can otherwise
    // overwrite the newer event when it resolves.
    void queryClient.cancelQueries({ queryKey, exact: true })
    if (!events.some(event => event.id === eventId)) continue
    queryClient.setQueryData(queryKey, freshEvent?.status === 'approved'
      ? events.map(event => event.id === eventId ? freshEvent : event)
      : events.filter(event => event.id !== eventId))
  }
}

const registrationOutcome = (event, memberId) => {
  if (!event) return 'missing'
  if (event.status !== 'approved' || !(new Date(event.date) > new Date())) return 'unavailable'
  if (event.attendees?.includes(memberId)) return 'alreadyRegistered'
  if (isEventFull(event)) return 'full'
  return 'ready'
}

// The caller supplies a server-only read. No cached list participates in this
// decision. This remains best-effort: another client can fill the last seat
// between the read and write until capacity is enforced atomically server-side.
export const runFreshRegistration = async ({ eventId, memberId, loadEvent, isActive, register, queryClient }) => {
  let event
  try {
    event = await loadEvent(eventId)
  } catch {
    return isActive() ? 'failed' : 'cancelled'
  }
  if (!isActive()) return 'cancelled'
  refreshCachedEvent(queryClient, eventId, event)
  const outcome = registrationOutcome(event, memberId)
  if (outcome !== 'ready') return outcome
  register({ eventId, memberId })
  return 'registered'
}
