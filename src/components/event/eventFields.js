import { formatEventDate, formatEventTime } from '../../utils/timezone.js'

// Which event fields each viewer sees. A card and its detail modal show every
// field except `hide`, so a card never shows what its modal hides. The page's
// `context`/`actions` slots are outside this model.
// Restricted fields (venue, revision) stay off unless `allowRestricted`.
// Attendee counts show only to admins and the organizer: few members register
// through the portal, so a public "1 / 50" reads as an empty event.
export const EVENT_VIEWS = {
  admin: { hide: [], allowRestricted: true },
  organizer: { hide: ['organizer'] }, // the viewer is the organizer
  member: { hide: ['status', 'attendees'] }
}

// Every event field the card/modal can show (the card has no event link row).
export const EVENT_FIELDS = [
  'status', 'date', 'hosts', 'organizer', 'attendees',
  'eventLink', 'description', 'rejection', 'venue', 'revision'
]

// Admin-only data: hidden unless the view sets `allowRestricted`.
const RESTRICTED_FIELDS = new Set(['venue', 'revision'])

const isAllowed = (field, view) =>
  !view.hide.includes(field) && (view.allowRestricted || !RESTRICTED_FIELDS.has(field))

export const getVisibleFields = (viewName) => {
  const view = EVENT_VIEWS[viewName]
  return new Set(EVENT_FIELDS.filter(field => isAllowed(field, view)))
}

export const getWhenText = (event) => {
  const start = `${formatEventDate(event.date)} · ${formatEventTime(event.date)}`
  if (!event.duration) return start
  const end = new Date(new Date(event.date).getTime() + event.duration * 60 * 1000)
  return `${start} – ${formatEventTime(end)}`
}

export const getHostNames = (hostingProjects) => hostingProjects || ''

export const getAmenityName = (amenities, amenityId) =>
  amenities.find(a => a.id === amenityId)?.name || amenityId

// Event links are member-entered; only render real web links (blocks e.g.
// `javascript:` URLs, which React 18 would still render).
export const isWebLink = (url) => /^https?:\/\//i.test(url || '')

// An event's venue is `requestedAmenityId`. Events approved before bookings were
// dropped may still carry `linkedAmenityId` (cleared on their next edit), and
// there it is the venue ops agreed to.
export const getEventVenueId = (event) => event?.linkedAmenityId || event?.requestedAmenityId || ''

// Both roles write the venue the same way, so either form reads it back.
export const getVenuePayload = (formData, linkAmenity) => ({
  requestedAmenityId: linkAmenity ? formData.get('linkedAmenityId') || '' : '',
  amenityNote: linkAmenity ? formData.get('amenityNote') || '' : ''
})

export const getEventSpaces = (amenities) =>
  amenities.filter(amenity => amenity.isAvailable !== false && amenity.type === 'event-space')

export const getDefaultEventSpace = (amenities) => {
  const eventSpaces = getEventSpaces(amenities)
  return eventSpaces.find(amenity => /event hall|event space|main hall/i.test(amenity.name)) || eventSpaces[0]
}
