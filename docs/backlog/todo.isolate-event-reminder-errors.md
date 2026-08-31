# Isolate per-recipient errors in sendEventReminders
**Phase**: — · **Deps**: —

## Goal
`deliverReminderSegment`'s `Promise.all` over per-member `createNotificationIfAbsent`
calls has no error isolation: one member's write failing aborts the entire hourly
`sendEventReminders` run, silently skipping every event/segment not yet processed that
hour with no retry. Isolate failures per recipient, the same fix `autoCheckoutExpiredBookings`
(PR #81) already applied to its own per-step failures.

## Files
- `functions/index.js` (edited) — `deliverReminderSegment` (currently lines 1764-1809):
  wrap each `createNotificationIfAbsent` call so a rejection is caught and logged per
  member rather than propagating out of the `Promise.all`; keep counting successes for the
  existing `notifiedCount` total. `sendEventReminders` (currently lines 1814-1883): ensure
  one event's segment failure doesn't stop the `for` loop from processing the remaining
  approved events.

## Acceptance
- [ ] A single member's `createNotificationIfAbsent` call throwing (simulated via a malformed doc or a forced rejection in a test) does not stop reminders from being created for other members in the same segment.
- [ ] It also does not stop reminders from being created for other events later in the same `sendEventReminders` run.
- [ ] Each per-recipient failure is logged individually (`console.error` with the member/event id) rather than only surfacing as one aggregate error at the end of the run.
- [ ] NOT: does not add a retry queue or change the 24-25h reminder window.

## Verify
- `npm run lint && npm run build` → green.
- `cd functions && npm run lint` → green.
- `cd functions && npm run serve`, trigger `sendEventReminders` against the emulator with two approved events in the window, one segment doc rigged to throw (e.g. temporarily point `createNotificationIfAbsent` at a bad collection path for one member id) — confirm the other event's reminders still land.
- regression: `npm test` (functions tests, if any cover this path) and existing `sendEventReminders` happy-path behavior (dedup, opt-out respected, timezone-correct window) unchanged.

## Notes
Mirror the shape of `collectSweepStep` in `autoCheckoutExpiredBookings` (added by #81) —
catch per-unit-of-work, collect failures, keep going, surface an aggregate failure count
at the end rather than throwing mid-run.
