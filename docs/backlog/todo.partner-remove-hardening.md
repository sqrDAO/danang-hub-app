# Partner remove hardening
**Phase**: — · **Deps**: partner-panel-simplify

## Goal
Make Remove on the Partners panel work for partners of any size and leave alone bookings that changed meanwhile. Also stop non-desk amenities from being reserved as partner desks.

## Files
- `src/services/partners.js` (edited) — remove detaches first, then cancels days in re-read chunks; `countAttachedMembers`; `reserveDesk` refuses non-desks
- `src/services/localDevStore.js` (edited) — desk check before create; same sync-owned-day test on remove
- `src/pages/admin/PartnersPanel.jsx` (edited) — Remove reads the member count fresh
- `src/locales/en.json`, `src/locales/vi.json` (edited) — `toast.partnerRemovedDaysPending`
- `test/localDevStore.test.js` (edited) — non-desk refused; null desk refused; non-synced bookings kept

## Acceptance
- [ ] Removing a partner with more than 25 members does not exceed a transaction's write limit
- [ ] Members are detached before any of their days are cancelled
- [ ] A day checked in, cancelled or deleted after the first read is not written
- [ ] A day that has started by the time its chunk runs is not cancelled
- [ ] If cancelling days fails after the partner is removed, the admin sees a notice that the hourly run will finish, not an error
- [ ] A member moved to another partner during Remove keeps that partner and its days
- [ ] A double click on Remove opens one confirmation
- [ ] Only days the sync owns (`planType` `partner-desk`, `planGroupId` `partner_<memberId>`) are cancelled
- [ ] Members attached while Remove runs are detached, and their upcoming days cancelled
- [ ] A non-desk amenity cannot be reserved as a partner desk
- [ ] The Remove confirmation uses a member count read when Remove is clicked
- [ ] NOT: no change to the hourly sync or to `firestore.rules`

## Verify
- `npm run lint && npm run build && npm test` → green, including "only a desk can be a partner desk" and "removing a partner leaves bookings the sync does not own alone"
- `npm run dev:skipauth`, `/admin/members` → add a partner, attach a member, Remove → the confirmation names 1 member
- regression: `test/partnerDesks.test.js`, `test/firestore-partner-desk.rules.test.js`

## Notes
Server-side removal is tracked in https://github.com/sqrDAO/danang-hub-app/issues/128.
