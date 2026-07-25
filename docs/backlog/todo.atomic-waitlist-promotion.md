# Make waitlist promotion transactional
**Phase**: — · **Deps**: —

## Goal
`promoteFromWaitlist` (`src/services/events.js:343`) and `autoPromoteWaitlist`
(`functions/index.js:1541`) both read the event, compute `remaining`, then write
`waitlist: remaining` as a whole array — so anyone who joins the waitlist between the
read and the write is silently erased, and the two paths racing can promote past
`capacity`. Re-read inside a transaction in both.

## Files
- `src/services/events.js` (edited) — rewrite `promoteFromWaitlist` with
  `runTransaction`: read the event inside the transaction, recompute
  `availableSpots`/`toPromote` from the transaction snapshot, write in the same
  transaction.
- `functions/index.js` (edited) — rewrite the `autoPromoteWaitlist` body with
  `db.runTransaction`, using the trigger snapshot only to decide *whether* attendees
  shrank; recompute promotion counts from the transactional read.

## Acceptance
- [ ] `promoteFromWaitlist` reads and writes the event inside one transaction.
- [ ] `autoPromoteWaitlist` recomputes `attendees`/`waitlist`/`capacity` from a read inside its transaction, not from `event.data.after`.
- [ ] A waitlist join concurrent with a promotion is preserved in `waitlist`.
- [ ] Promotion never pushes `attendees.length` above `capacity`.
- [ ] `promoteFromWaitlist` still returns `{ promoted, remaining }` with the same shape.
- [ ] Events with no `capacity` still treat spots as unlimited.
- [ ] NOT: no change to `addToWaitlist` / `removeFromWaitlist`.
- [ ] NOT: no waitlist-promotion notification added here (still the `// TODO` at `functions/index.js:1575`).

## Verify
- `npm run lint && npm run build` → green
- `cd functions && npm run lint` → exit 0
- `firebase emulators:start` → event at capacity with 2 waitlisted; unregister one
  attendee; exactly 1 promotes, the other stays on the waitlist in position 1
- emulator: admin "promote" while a second attendee unregisters → `attendees.length`
  never exceeds `capacity`
- regression: admin Events promote button (`src/pages/admin/Events.jsx:292`) still
  shows the promoted count toast

## Notes
`arrayUnion` already dedupes `attendees`; the unsafe part is only the wholesale
`waitlist` overwrite. Keep the outer `beforeAttendees > afterAttendees` guard in the
trigger so the function's own write does not re-enter — the transaction protects
correctness, not invocation count.
