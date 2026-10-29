# Give partner members their desk automatically
**Phase**: — · **Deps**: partner-desks

## Goal
A partner member should have a Partner Desk for as long as they belong to the partner org, without registering plans. Admins pick one desk per org, the hourly scheduler keeps attached members booked on every working day four weeks ahead, and detaching a member ends their desk.

## Files
- `firestore.rules` (edited) — members cannot create `partner-desk` bookings
- `test/firestore-booking-cancel.rules.test.js` (edited) — that rule
- `functions/bookingNotifications.js` (edited) — no notice for `partner-desk-moved`
- `functions/partnerDesks.js` (new) — pure planner: working days ahead, desired bookings, what to create/reactivate/cancel, desk capacity
- `functions/index.js` (edited) — `autoCheckoutExpiredBookings` runs the partner desk sync as its own step; partner-desk bookings are never auto-approved by `autoApproveDeskBooking` (server writes them approved)
- `src/services/partners.js` (edited) — `updatePartner`
- `src/services/localDevStore.js` (edited) — `updateLocalPartner`
- `src/pages/admin/PartnersPanel.jsx` (edited) — desk picker per partner
- `src/pages/admin/Members.css` (edited) — desk picker layout, wraps on mobile
- `src/utils/deskPlans.js` (edited) — comments updated for the automatic model
- `src/pages/member/Bookings.jsx` (edited) — no register button for partner members; ongoing Partner Desk card; members can cancel single approved partner-desk days
- `src/services/bookings.js` (edited) — drop the `planType` option added in partner-desks
- `src/locales/en.json`, `src/locales/vi.json` (edited) — desk picker and ongoing-desk copy; remove unused manual-plan keys
- `test/partnerDesks.test.js` (new) — planner cases
- `README.md` (edited) — scheduler row and Partner Desk feature line

## Acceptance
- [ ] An admin can set or clear the desk for each partner org on `/admin/members`
- [ ] Within an hour of being attached to a partner with a desk, a member has an approved booking on that desk for every Mon–Fri, 09:00–18:00 hub time, over the next 28 days
- [ ] Hub closure days are skipped
- [ ] Days the desk is switched off (`isAvailable: false`) or outside its `availableDays` are skipped
- [ ] A member who already holds a desk that day (Fixed Desk day, single desk booking) gets no second seat
- [ ] A day with no free seat on the desk is skipped, and retried on the next run
- [ ] Bookings use doc id `pd_<uid>_<amenityId>_<YYYYMMDD>` and `planGroupId` `partner_<uid>`, so re-runs create nothing twice
- [ ] Detaching a member cancels their not-yet-started pending/approved synced days with `cancelledReason: 'partner-removed'`
- [ ] Partner-desk bookings the sync did not create (manual #115 plans) are never cancelled or reactivated by it
- [ ] Changing a partner's desk cancels the old desk's future days (`partner-desk-moved`, no notification) and books the new desk
- [ ] A sync write never overwrites a booking changed after the sync read it (update-time precondition)
- [ ] Members cannot create `partner-desk` bookings (rules)
- [ ] A partner whose desk is missing, not a desk, or switched off leaves its members on the Fixed Desk flow, and the admin dropdown flags the missing desk
- [ ] Re-attaching a member reactivates days the sync cancelled
- [ ] A day the member cancelled themselves (no `cancelledReason`) is never recreated or reactivated
- [ ] A day cancelled for a hub closure is never reactivated
- [ ] A checked-in day is never cancelled
- [ ] A failing sync step fails the scheduler run but does not stop the checkout sweep
- [ ] Members of a partner with a desk see no register button
- [ ] Members of a partner without a desk keep the Fixed Desk register button
- [ ] Partner members see one "Partner Desk" card, with no Cancel Plan button, and cancelled days are not counted on it
- [ ] Manual #115 partner-desk plans keep their Cancel Plan button
- [ ] Synced days send no approval notification; a detach sends one cancellation notification
- [ ] Partner members can cancel a single approved partner-desk day from their upcoming bookings
- [ ] A client-created `partner-desk` booking is never auto-approved
- [ ] NOT: no new Cloud Function exports
- [ ] NOT: no new Firestore composite index (CI does not deploy indexes)
- [ ] NOT: non-partner Fixed Desk flow unchanged

## Verify
- `npm run lint && npm run build` → green
- `cd functions && npm run lint` → green
- `npm test` → green, including `test/partnerDesks.test.js`
- after deploy, set a desk for 9AM Games and DiiD, wait for the next hourly run → `firebase functions:log --only autoCheckoutExpiredBookings` shows a "Partner desk sync" line with created counts
- a partner member's `/member/bookings` shows the Partner Desk card and approved days; cancelling one day keeps it cancelled after the next run
- regression: auto checkout still completes expired bookings (same log line as before)

## Notes
- The sync reads one query: bookings with `startTime >= start of today` (single-field range, auto-indexed). Every decision about existing docs and seat counts comes from that snapshot plus `members` where `partnerId != null` and all `partners`.
- Seats are counted against `capacity` the same way `computeBookingAvailability` does: overlapping active bookings, own partner doc excluded.
- Synced days are created one `create()` at a time and an existing id is skipped, so a retried or overlapping run cannot abort the rest. `autoApproveDeskBooking` and `notifyBookingApproval` skip approval notices for synced days (`isSyncedPartnerDay`), otherwise the rolling window would re-push after the 90-day push marker expires.
- The scheduler timeout goes to 300s to make room for the first run.
