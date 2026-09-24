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
