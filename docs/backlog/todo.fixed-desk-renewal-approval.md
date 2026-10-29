# Fixed Desk renewal with admin approval
**Phase**: — · **Deps**: partner-desk-auto-assign

## Goal
Members renew a Fixed Desk plan instead of registering a new one, and every renewal waits for an admin (issue #114). A renewal does not hold the desk while it waits. Admins approve or reject it as one unit, and members get a reminder 3 days before their plan ends.

## Files
- `functions/renewals.js` (new) — pure: `holdsSeat`, pending-renewal checks, ending-soon detection
- `functions/index.js` (edited) — occupancy ignores pending renewals; renewal review copy; sweep cancels unapproved renewal days; reminder step in the hourly run
- `functions/bookingNotifications.js` (edited) — rejection notice carries `rejectionReason`
- `functions/partnerDesks.js` (edited) — pending renewals do not take a partner seat
- `firestore.rules` (edited) — `renewalOf` format on create; owners cannot change `renewalOf` or `rejectionReason`
- `src/utils/renewals.js` (new) — renew window, renewal start date, renewal state of a plan
- `src/utils/deskPlans.js` (edited) — shared `summarizePlan` and `buildDeskPlans` (the one member plan list)
- `src/services/bookings.js` (edited) — `renewFixedDeskPlan`, `approveFixedDeskRenewal`, `rejectFixedDeskRenewal`
- `src/services/localDevStore.js` (edited) — pending renewals do not occupy
- `src/pages/member/Bookings.jsx` (edited) — Renew button and renewal state on the plan card; ended plans stay listed 7 days
- `src/pages/admin/RenewalsPanel.jsx` (new) — pending renewals, approve all / reject with optional reason
- `src/pages/admin/Bookings.jsx` (edited) — renders the panel; renewal days skip the global Approve all and the per-row Approve
- `src/pages/admin/Bookings.css`, `src/pages/member/Bookings.css` (edited) — panel and Renew styles
- `src/components/NotificationBell.jsx` (edited) — renewal review, rejection and ending-soon copy
- `src/locales/en.json`, `src/locales/vi.json` (edited) — renewal strings
- `test/renewals.test.js` (new) — client and server helpers
- `test/firestore-booking-renewal.rules.test.js` (new) — `renewalOf` rules (emulator)
- `README.md` (edited) — renewal feature line, scheduler row

## Acceptance
- [ ] A member sees "Renew" on a Fixed Desk plan from 7 days before its last day until 7 days after it
- [ ] Renewing creates the same desk and period, starting the next working day after the plan (or tomorrow, if it has lapsed)
- [ ] Renewal days are `pending` with `renewalOf: <planGroupId>`
- [ ] A plan with a non-cancelled renewal shows its renewal state instead of "Renew"
- [ ] A plan ended early (days cancelled after its last live day, Hub closures aside) offers no Renew
- [ ] Each plan appears once in the member's plan list
- [ ] Pending renewal days do not block other bookings (conflict check, calendar ranges, partner sync, local dev mode)
- [ ] Admins see pending renewals grouped one per plan on `/admin/bookings`
- [ ] Approving a renewal approves each day that still has a free seat
- [ ] Approving a renewal cancels days that can no longer be had (seat taken, Hub closure, desk no longer open that day), with reason `renewal-day-unavailable`
- [ ] A day the desk no longer takes does not block the rest of the approval
- [ ] Renew cannot be submitted twice for the same plan
- [ ] Rejecting cancels every pending day with reason `renewal-rejected`, and an optional `rejectionReason`
- [ ] The member gets one notification per decision, showing the rejection reason if one was given
- [ ] Days dropped on approval or lapsed unreviewed send no notification
- [ ] An approval that drops every day tells the member once (`renewal-unavailable`)
- [ ] `renewalOf` is accepted only on a `fixed-desk` day with a `planGroupId` (rules)
- [ ] A booking naming another member's plan in `renewalOf` does not stop that member's reminder
- [ ] Renewal days skip the global "Approve all" and have no per-row Approve button
- [ ] A renewal day still pending when it ends is cancelled with reason `renewal-expired`, not completed
- [ ] Members get one in-app + push reminder 3 days before an approved plan's last day, unless they have already renewed
- [ ] Owners cannot add, change or remove `renewalOf` or `rejectionReason` after creation (rules)
- [ ] NOT: first-time Fixed Desk plans and admin-assigned plans unchanged
- [ ] NOT: no change of desk or period on renewal
- [ ] NOT: no new Cloud Function exports, no composite index

## Verify
- `npm run lint && npm run build` → green; `cd functions && npm run lint` → green
- `npm test` → green, including `test/renewals.test.js`
- `firebase emulators:exec --only firestore "node --test test/firestore-booking-renewal.rules.test.js"` → all pass
- regression: register a first-time Fixed Desk plan (still pending), single desk booking auto-approval, partner desk sync

## Notes
- Releasing the desk means a renewal can lose days to other bookings while it waits; approval re-checks each day with `checkBookingConflictsStrict`.
- The reminder rides the hourly run (no new scheduled function), shares the Partner Desk sync's single read of future bookings, and dedupes on `fixed_desk_ending_<uid>_<planGroupId>`.
- `buildDeskPlans` groups all of a member's plan days once and filters per plan; `summarizePlan` is the one summary of a plan's days, shared with the Renewals panel.
