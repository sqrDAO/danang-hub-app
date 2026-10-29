# Reserve partner desks for their partner's members
**Phase**: — · **Deps**: partner-desks, partner-desk-auto-assign

## Goal
Partner desks ("9AM Games Desks", "DiiD Desks") are listed and bookable by every member on `/member/bookings`; the product owner wants them bookable only by that partner's members. A new amenity field `reservedForPartnerId`, kept in step with the partner's `deskAmenityId`, hides the desk from other members and is enforced in `firestore.rules`.

## Files
- `firestore.rules` (edited) — `amenityOpenToCaller`; member booking create denied on another partner's desk
- `src/services/partners.js` (edited) — `setPartnerDesk` (replaces `updatePartner`) and `deletePartner` reserve/release the desk in one transaction
- `src/services/localDevStore.js` (edited) — `setLocalPartnerDesk`; `deleteLocalPartner` releases the desk
- `src/utils/deskPlans.js` (edited) — `isAmenityOpenTo(amenity, partnerId)`
- `src/pages/admin/PartnersPanel.jsx` (edited) — uses `setPartnerDesk`; a desk held by another partner is disabled in the select
- `src/pages/member/Bookings.jsx` (edited) — lists and deep-links only amenities open to the viewer's partner
- `src/pages/Home.jsx` (edited) — public amenity preview omits reserved desks
- `src/pages/admin/Amenities.jsx`, `src/pages/admin/Amenities.css` (edited) — "Reserved for partner" line on the card
- `src/locales/en.json`, `src/locales/vi.json` (edited) — `adminAmenities.reservedFor`
- `functions/scripts/backfill-partner-desk-reservations.cjs` (new) — dry-run/apply: reserve each partner's existing desk
- `test/firestore-partner-desk.rules.test.js` (new) — reservation rules (emulator)
- `test/deskPlans.test.js`, `test/localDevStore.test.js` (edited) — helper and local store coverage
- `README.md` (edited) — `amenities.reservedForPartnerId`, backfill script
- `src/services/amenities.js` (edited) — refuse retyping or deleting a reserved desk

## Acceptance
- [ ] Picking a desk for a partner sets `reservedForPartnerId` to the partner's id on that amenity
- [ ] Changing or clearing a partner's desk sets `reservedForPartnerId` to null on every amenity reserved for it
- [ ] Deleting a partner releases its reserved desk
- [ ] A desk reserved for another partner is disabled in a partner's desk select
- [ ] A member with no partner does not see a reserved desk on `/member/bookings`
- [ ] A member of a different partner does not see the desk on `/member/bookings`
- [ ] A member of the desk's partner sees it and can book it
- [ ] A `?amenityId=` deep link to another partner's desk does not open the booking modal
- [ ] Rules deny a member booking create on a desk reserved for another partner, or for any partner when the member has none
- [ ] Rules allow a member booking create on an unreserved or missing amenity
- [ ] Rules allow an admin booking create on a reserved desk
- [ ] `/admin/amenities` shows which partner a desk is reserved for
- [ ] The backfill dry run lists each desk it would reserve and writes nothing
- [ ] The backfill `--apply` writes only `reservedForPartnerId` and `updatedAt`
- [ ] A Fixed Desk plan on a desk reserved for another partner shows `fixedDesk.renewal.deskReserved` instead of Renew
- [ ] `setPartnerDesk` refuses a desk another partner holds (`partner-desk-taken` toast, cached lists refreshed)
- [ ] Two quick desk changes for one partner leave it holding exactly one reserved desk (transaction on the partner doc)
- [ ] A reserved desk cannot be retyped away from `desk` or deleted (`toast.amenityReserved`)
- [ ] A reservation left by a partner that no longer exists is taken over when another partner picks the desk
- [ ] NOT: no Cloud Function changes (sync, `autoApproveDeskBooking`, conflict callables unchanged)
- [ ] NOT: admin "assign booking" flow and admin pages still list every amenity
- [ ] NOT: existing bookings on a reserved desk are not cancelled

## Verify
- `npm run lint && npm run build` → green
- `cd functions && npm run lint` → green
- `npm test` → green
- `firebase emulators:exec --only firestore --project demo-danang "node --test --test-concurrency=1 test/firestore-booking-cancel.rules.test.js test/firestore-booking-renewal.rules.test.js test/firestore-member-partner.rules.test.js test/firestore-event-edit.rules.test.js test/firestore-partner-desk.rules.test.js"` → 37 pass
- `npm run dev:skipauth`: add a partner on `/admin/members`, pick a desk → `/admin/amenities` card shows "Reserved for partner"; the desk is disabled in a second partner's select
- `node functions/scripts/backfill-partner-desk-reservations.cjs` → dry-run list, no writes
- regression: non-partner desk booking and Fixed Desk register; partner member's own-desk booking auto-approves

## Notes
- Order after merge: deploy rules (CI) and hosting, then run the backfill with `--apply`. Until it runs, the two production desks stay open to everyone.
- Rules read two docs (the amenity and the caller's profile, which `isAdmin` already reads); well within the per-request limit.
- A member create with no `amenityId` is now denied (the path cannot be built); no client writes one.
- The hourly sync writes with the admin SDK, so rules never gate it.
