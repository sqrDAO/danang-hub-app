# Restrict organizer event delete to pending status
**Phase**: — · **Deps**: —

## Goal
`firestore.rules`'s organizer-delete rule on `events/{eventId}` has no status check, so an
organizer can delete their own **approved** event — with live registrations and a
waitlist — via a direct client write, even though the UI only ever exposes delete for
`pending` events. Mirror the `bookings` collection's existing pattern (owner delete
restricted to `pending`) so the rule itself, not just the UI, prevents the data loss.

## Files
- `firestore.rules` (edited) — `events/{eventId}` organizer delete rule (~line 122-123):
  add `resource.data.status == 'pending'` to the condition.
- `docs/knowledge/data-flow.md` (edited) — rules table row for `events` (~line 188):
  change "organizer delete own" to "organizer delete own **only while `pending`**".

## Acceptance
- [ ] An organizer can delete their own event while its `status` is `pending`.
- [ ] An organizer cannot delete their own event while its `status` is `approved`.
- [ ] An organizer cannot delete their own event while its `status` is `rejected`.
- [ ] An admin can still delete any event regardless of status (separate `allow delete: if isAdmin()` rule, unchanged).
- [ ] NOT: no change to the member-facing delete button's existing `status === 'pending'` gating in `src/pages/member/Events.jsx`.
- [ ] NOT: no change to `deleteEvent` in `src/services/events.js` (the rule is the enforcement layer, not the client).

## Verify
- `firebase emulators:start` → in the emulator UI, signed in as the organizer, attempt to
  delete a `pending` event you created → succeeds
- same session: approve the event (or create one directly with `status: 'approved'` as
  admin, then re-auth as the organizer) → attempt delete → `PERMISSION_DENIED`
- same session: as admin, delete the approved event → succeeds
- regression: `npm run lint && npm run build` → green
- regression: member "Cancel Request" button on a pending event request still works end to end in `npm run dev`

## Notes
Found during the 2026-07-27 weekly review sweeping `firestore.rules` invariants — not a
regression from this week's diff (the rule line predates this week), just previously
unnoticed. Rejected events could arguably also be deletable by the organizer (there's no
`bookings`-style "delete only while pending" ambiguity for rejected — a rejected event has
no attendees to lose), but Acceptance is written to match the bookings precedent exactly
(pending-only) since that's the proven, already-audited pattern; loosen it in a follow-up
spec if the product wants organizers to clear rejected requests themselves.
