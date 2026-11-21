import { formatEventDate, formatEventTime, toDatetimeLocalHub } from '../../utils/timezone.js'
import { isEventSpaceAmenity } from '../../utils/bookingDeepLink.js'

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
// `linkCheck` is the unfamiliar-site caution on the event link.
export const EVENT_FIELDS = [
  'status', 'date', 'hosts', 'organizer', 'attendees',
  'eventLink', 'linkCheck', 'description', 'rejection', 'venue', 'revision'
]

// Admin-only data: hidden unless the view sets `allowRestricted`.
const RESTRICTED_FIELDS = new Set(['venue', 'revision', 'linkCheck'])

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

// An event whose real sign-up lives on its own page (Luma, a form…). The Hub
// only points there: Register always opens the page, and Hub capacity and the
// waitlist never stand in the way.
export const hasEventPage = (event) => isWebLink(event?.eventLink)

// Event platforms admins see all the time. A link elsewhere is not blocked:
// the admin just gets a caution before approving the event or opening it.
export const KNOWN_EVENT_HOSTS = [
  'lu.ma', 'luma.com', 'meetup.com', 'eventbrite.com', 'zoom.us',
  'meet.google.com', 'forms.gle', 'docs.google.com', 't.me', 'discord.gg',
  'x.com', 'facebook.com', 'youtube.com'
]

// An exact match or a subdomain. Never a substring check: `lu.ma.evil.com`
// contains `lu.ma` but is not it.
const isKnownHost = (host) =>
  KNOWN_EVENT_HOSTS.some(known => host === known || host.endsWith(`.${known}`))

// `value` read as a web link relative to `base`, or null. Resolved the way the
// browser resolves a redirect, so odd spellings (`/\evil.com`, ` https://evil.com`,
// a tab inside `https`) land where the browser would actually go.
const toWebUrl = (value, base) => {
  try {
    const target = new URL(value, base)
    return isWebLink(target.href) ? target : null
  } catch {
    return null // e.g. `https://` alone: not a link a browser could follow
  }
}

// A known host can forward through query links. Return the destination found
// in the first flagged chain, rather than naming its familiar forwarding host.
// Beyond MAX_HOPS, warn about the last inspected host even if it is known.
const MAX_HOPS = 3
const getForwardedHost = (url, hops = 1) => {
  for (const value of url.searchParams.values()) {
    const target = toWebUrl(value, url)
    if (!target) continue
    if (hops > MAX_HOPS) return target.hostname
    const nestedHost = getForwardedHost(target, hops + 1)
    if (nestedHost) return nestedHost
    if (!isKnownHost(target.hostname)) return target.hostname
  }
  return ''
}

// The host to warn the admin about, or '' for no link or a known platform.
// Uses the parsed hostname, the site the browser actually loads: the raw text
// can mislead (`https://lu.ma@evil.com` loads evil.com). A non-web link has no
// host, so it is shown as typed.
export const getUnfamiliarLinkHost = (url) => {
  if (!url) return ''
  const parsed = isWebLink(url) && toWebUrl(url)
  if (!parsed) return url
  return isKnownHost(parsed.hostname) ? getForwardedHost(parsed) : parsed.hostname
}

// New tab without `window.opener`, so the event site cannot redirect this tab.
// `<a target="_blank">` gets that by default; `window.open` does not. Call it
// synchronously in the click handler: after an `await` the browser no longer
// treats it as the user's click and blocks the popup.
export const openEventLink = (url) => {
  if (isWebLink(url)) window.open(url, '_blank', 'noopener,noreferrer')
}

// An event's venue. Older events may also carry `linkedAmenityId`; they are
// decorative only, so it is deliberately ignored.
export const getEventVenueId = (event) => event?.requestedAmenityId || ''

export const MAX_EVENT_CAPACITY = 50

const clampCapacity = (rawValue) => {
  const capacity = parseInt(rawValue, 10)
  return Number.isNaN(capacity) ? MAX_EVENT_CAPACITY : Math.min(Math.max(capacity, 1), MAX_EVENT_CAPACITY)
}

// Both roles write the venue the same way, so either form reads it back.
export const getVenuePayload = (formData, linkAmenity) => ({
  requestedAmenityId: linkAmenity ? formData.get('amenityId') || '' : '',
  amenityNote: linkAmenity ? formData.get('amenityNote') || '' : ''
})

// Every field the shared form edits, read the same way for both roles. Cleared
// optional fields are '' so an edit actually clears them.
export const getEventFormPayload = (formData, eventDate, linkAmenity) => ({
  title: formData.get('title'),
  description: formData.get('description'),
  date: eventDate.toISOString(),
  capacity: clampCapacity(formData.get('capacity')),
  duration: parseInt(formData.get('duration'), 10) || 60,
  hostingProjects: formData.get('hostingProjects')?.trim() || '',
  eventLink: formData.get('eventLink')?.trim() || '',
  ...getVenuePayload(formData, linkAmenity)
})

// An imported draft (see importEventFromUrl) as form input values. `date` is
// the hub-time string a datetime-local input takes; `duration` stays null when
// the source page had no end time.
export const getImportedFormValues = (draft) => ({
  title: draft.title || '',
  description: draft.description || '',
  date: toDatetimeLocalHub(draft.date),
  duration: draft.duration ?? null,
  eventLink: draft.eventLink || ''
})

export const getEventSpaces = (amenities) =>
  amenities.filter(amenity => amenity.isAvailable !== false && isEventSpaceAmenity(amenity))

export const getDefaultEventSpace = (eventSpaces) =>
  eventSpaces.find(amenity => /event hall|event space|main hall/i.test(amenity.name)) || eventSpaces[0]
