# Prevent double-submit on mutation buttons
**Phase**: — · **Deps**: —

## Goal
Disable write buttons while their mutation is in flight so double-clicks cannot fire the same request twice. In list views the guard is keyed to the row being submitted, so one in-flight action does not disable that action on every other row. UI-only; no service or rules changes.

## Files
- `src/utils/mutationTarget.js` (new) — `isPendingFor(mutation, id)` / `pendingTargetId(mutation)`; reads the in-flight `mutation.variables`
- `src/pages/admin/Amenities.jsx` (edited) — create/save; toggle + delete keyed per amenity
- `src/pages/admin/Events.jsx` (edited) — approve/reject/promote waitlist/delete keyed per event
- `src/pages/admin/Bookings.jsx` (edited) — approve/reject/check-in/out/delete keyed per booking
- `src/pages/admin/Members.jsx` (edited) — save; delete keyed per member
- `src/pages/member/Events.jsx` (edited) — register/unregister/waitlist/cancel request keyed per event
- `src/pages/member/Bookings.jsx` (edited) — cancel + delete keyed per booking; fixed-desk cancel keyed per plan

## Acceptance
- [ ] Guarded buttons are disabled while their mutation is pending
- [ ] In a list, an in-flight action disables that button only on the row it was fired from
- [ ] Modal form submits (amenity create/save, member save) stay globally disabled while pending
- [ ] Confirms, toasts, and handlers are unchanged
- [ ] NOT: no Firestore/service/rules changes; no public-page navigation buttons

## Verify
- `npm run lint` → green
- `npm run build` → green
- Manual: double-click amenity create / booking approve / event register → one write
- Manual: approve booking A → Approve/Reject on other pending rows stay clickable
- Manual: delete member A → Delete on other member rows stays clickable
- regression: failed requests re-enable the button

## Notes
`mutation.variables` shapes differ per call site (bare id string, `{id}`, `{eventId}`, `{uid}`); `mutationTarget.js` normalises all four. Guards read state captured in the previous render, so they narrow the double-submit window rather than closing it absolutely — the `disabled` attribute is the primary defence.
