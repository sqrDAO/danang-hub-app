import { formatEventDate, formatEventTime } from '../../utils/timezone.js'
import { EVENT_VIEWS } from './eventViews.js'

export const DEFAULT_CAPACITY = 50

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

export const getHostNames = (hostingProjects, projects) => {
  if (!hostingProjects) return ''
  if (typeof hostingProjects === 'string') return hostingProjects
  return hostingProjects.map(projectId => {
    const project = projects.find(p => p.id === projectId)
    return project?.name || projectId
  }).join(', ')
}

export const getAmenityName = (amenities, amenityId) =>
  amenities.find(a => a.id === amenityId)?.name || amenityId

// Event links are member-entered; only render real web links (blocks e.g.
// `javascript:` URLs, which React 18 would still render).
export const isWebLink = (url) => /^https?:\/\//i.test(url || '')

export const isHallUnlinked = (event) =>
  Boolean(event.requestedAmenityId) && !event.linkedAmenityId
