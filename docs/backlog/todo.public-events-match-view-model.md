# Public /events page: match the event view model
**Phase**: — · **Deps**: —

## Goal
The public `/events` page still hand-renders cards and diverges from the shared view model in `eventFields.js`: it shows attendee counts that model hides from non-organizers, defaults a missing capacity to 50 (cards show `∞`), and falls back to the raw `organizerId` as a display name. Align it so anonymous visitors see what the member view shows, without leaking uids.

## Files
- `src/pages/Events.jsx` (edited) — drop the attendee-count line, drop the `|| 50` capacity default in the full-check, never render `organizerId` as a name
- `src/components/event/OrganizerName.jsx` (edited) — no `organizerId` fallback; render nothing when no display name

## Acceptance
- [ ] The public `/events` upcoming card shows no "attendees / capacity" line
- [ ] `OrganizerName` renders nothing when `organizerDisplayName` is empty
- [ ] The organizer line on `/events` renders nothing when `organizerDisplayName` is empty
- [ ] Register/waitlist button logic on `/events` still treats a missing capacity as unlimited, matching `EventCard`
- [ ] NOT: changing `EVENT_VIEWS` or `firestore.rules`
- [ ] NOT: changing member or admin event pages

## Verify
- `npm run lint && npm run build` → both succeed
- `npm test` → all pass
- `npm run dev:skipauth` → open `/events` signed out: no attendee count, no `eth_`/`sol_` string anywhere on the page for an event whose `organizerDisplayName` is null

## Notes
Capacity: confirm the `|| 50` at `src/pages/Events.jsx:229` against the booking function's capacity rule before changing; keep the change to what `EventCard` already does (`capacity || '∞'`).
