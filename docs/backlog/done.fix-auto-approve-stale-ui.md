# Fix stale pending UI after desk auto-approve
**Phase**: — · **Deps**: —

## Goal
After a member creates an ad-hoc desk booking, auto-approve flips `pending` → `approved` server-side. The list currently refetches too early and keeps cancel/delete buttons as if still pending. Resync after create so the UI shows the final status.

## Files
- `src/services/bookings.js` (edited) — `waitForBookingsSettled(ids)`: bounded backoff poll that resolves once no watched booking is `pending`, reporting whether anything flipped
- `src/pages/member/Bookings.jsx` (edited) — after desk create / recurring create success, refetch bookings once auto-approve (or timeout) settles

## Acceptance
- [ ] Creating a capacity-available desk booking (non fixed-desk) shows status `approved` in upcoming bookings without a full page reload
- [ ] That approved booking does not show cancel/delete buttons
- [ ] Creating a desk booking that stays pending (capacity full) still shows cancel/delete after create
- [ ] A recurring desk create waits on its occurrences, not only the first one
- [ ] When nothing flips out of `pending`, no second refetch is issued
- [ ] Meeting-room / podcast / fixed-desk create behavior unchanged (still pending when applicable)
- [ ] NOT: no change to Cloud Functions auto-approve rules or firestore.rules

## Verify
- `npm run lint` → green
- `npm run build` → green
- Manual: book a free desk → modal closes → upcoming card shows `approved`, no action buttons
- Manual: book a full desk (or non-desk) → still `pending` with cancel/delete
- Manual: recurring desk create over free days → every occurrence shows `approved`
- regression: cancel/delete still work for true pending bookings

## Notes
Deliberately bounded and best-effort: a recurring create can produce up to 52 bookings (`max="52"` on the occurrences field), so the helper watches at most 10 and backs off 300ms → 1200ms rather than re-reading every occurrence on a fixed interval. The final refetch covers the whole list, so occurrences past the cap are still refreshed — they just don't drive the timing.

Polls via individual `getBooking` gets, not a `documentId() in [...]` query: the bookings read rule is `isOwner(resource.data.memberId)`, which a get satisfies per document, whereas a list query would have to prove ownership through its own constraints.
