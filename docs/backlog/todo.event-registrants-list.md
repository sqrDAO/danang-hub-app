# Event registrants list (admin)
**Phase**: — · **Deps**: event-detail-modal, event-card-views · **Issue**: #201

## Goal
On `/admin/events` the attendee count ("3 / 50") becomes a link that opens a modal listing who registered for the event and who is on its waitlist. Admins could only see the numbers before, never the people.

## Files
- `src/components/event/AttendeeCount.jsx` (new) — "3 / 50" via `<Trans>`; the count is a button when `onShowRegistrants` is passed, plain text otherwise
- `src/components/event/EventCard.jsx` (edited) — threads `onShowRegistrants` to the attendees line
- `src/components/event/EventDetailModal.jsx` (edited) — threads `onShowRegistrants` to the attendees fact
- `src/components/event/registrants.js` (new) — pure helpers: resolve uids to rows, search, collect emails
- `src/components/event/EventRegistrantsModal.jsx` (new) — the modal: search, registered list, waitlist
- `src/components/event/EventRegistrantsModal.css` (new) — modal styles, theme variables only
- `src/pages/admin/Events.jsx` (edited) — holds `registrantsEvent`, renders the modal from the loaded `members` roster
- `src/services/members.js` (edited) — `getMembers` sorts newest-first in JS instead of `orderBy`, so members without `createdAt` still load
- `src/locales/en.json` (edited) — `<count>` tag in `eventCard.attending` / `eventDetails.attendeesValue`; `eventRegistrants` keys
- `src/locales/vi.json` (edited) — same keys as `en.json`
- `test/registrants.test.js` (new) — covers the pure helpers

## Acceptance
- [ ] On `/admin/events` the attendee count on an event card is a link
- [ ] The attendee count in the admin event details modal is a link
- [ ] Clicking either link opens the registrants modal for that event
- [ ] Opened from the details modal, the registrants modal stacks on top of it
- [ ] Clicking the count on a card does not open the event details modal
- [ ] Registered members are listed in registration order, numbered from 1
- [ ] The waitlist is a separate section in queue order, numbered from 1
- [ ] The waitlist section is absent when the waitlist is empty
- [ ] Each row shows avatar, name, job title · company, email (`mailto:`) and phone (`tel:`) when present
- [ ] Clicking a name opens that member's profile modal on top
- [ ] A uid with no member doc is listed as "Deleted account" with its uid
- [ ] A member doc without `createdAt` still resolves to that member, not "Deleted account"
- [ ] An event with no attendees and no waitlist shows an empty state
- [ ] A search box appears when the event has 8 or more people in total
- [ ] Search filters both sections by name, email, company, job title or phone
- [ ] Filtered rows keep their original position number
- [ ] A search with no results shows a "no one matches" message
- [ ] "Copy emails" on a section copies that section's unique emails, comma-separated, and toasts the count
- [ ] "Copy emails" is absent on a section where nobody has an email
- [ ] A spinner replaces the lists while the members roster is still loading
- [ ] An error message replaces the lists when the members roster fails to load
- [ ] NOT: listing everyone as "Deleted account" when the roster fails to load
- [ ] The modal makes no Firestore read or write of its own
- [ ] Every new string exists in both `en.json` and `vi.json`
- [ ] NOT: the count is a link on member, organizer or public pages
- [ ] NOT: removing, adding or promoting people from inside the modal
- [ ] NOT: CSV export
- [ ] NOT: changes to `firestore.rules` or Cloud Functions

## Verify
- `npm run lint` → 0 errors, 0 warnings
- `npm run build` → succeeds
- `npm test` → all pass, including `test/registrants.test.js`
- `npm run dev` → `/admin/events` as admin: click the count on a card with attendees; modal lists them; click a name; profile modal stacks; close both
- `npm run dev` → open an event's details modal, click the count there; registrants modal stacks on top
- `npm run dev` → open an event with 0 attendees → empty state; an event with a waitlist → second section
- `npm run dev` → "Copy emails", paste into a text field → comma-separated addresses
- `npm run dev` → `/member/events` as the organizer of an event: the count is plain text
- regression: toggle VI locale, dark/light theme, phone width (<560px: contact wraps under the name, no sideways scroll)

## Notes
- Admin-only by construction: only `src/pages/admin/Events.jsx` passes `onShowRegistrants`. Member docs are admin-readable only, so other pages could not resolve names anyway.
- `Modal` stacks by DOM order: keep `EventRegistrantsModal` after `EventDetailModal` and before `HostProfileModal`.
- The modal shows the event as it was when opened; it does not follow a background refetch (same as the details modal).
