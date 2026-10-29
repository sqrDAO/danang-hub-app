# Partner Desk plans for partner organizations
**Phase**: — · **Deps**: —

## Goal
Members of partner organizations (9AM Games, DiiD) need a Partner Desk plan instead of a Fixed Desk plan (issue #113). Admins attach members to a partner org. Partner members register a Partner Desk plan with the same per-working-day machinery, and it is auto-approved whenever the desk has capacity.

## Files
- `firestore.rules` (edited) — new admin-only-write `partners` collection; owners cannot set or change `members.partnerId`
- `src/services/partners.js` (new) — list/create/delete partner orgs (local dev mode aware)
- `src/services/localDevStore.js` (edited) — in-memory partners for `LOCAL_DEV_MODE`
- `src/services/bookings.js` (edited) — `createFixedDeskPlan` takes `planType` (`'fixed-desk'` default, or `'partner-desk'`)
- `src/utils/deskPlans.js` (new) — `DESK_PLAN_TYPES`, `isDeskPlan`, `deskPlanTypeFor(profile)`
- `src/pages/admin/PartnersPanel.jsx` (new) — add/remove partner orgs, member count per org
- `src/pages/admin/Members.jsx` (edited) — renders the Partners panel, partner select in the edit form, partner badge, search by partner name
- `src/pages/admin/Members.css` (edited) — panel and partner badge styles
- `src/pages/member/Bookings.jsx` (edited) — partner members see "Partner Desk" in place of "Fixed Desk"; plan list covers both types
- `src/pages/admin/Bookings.jsx` (edited) — "Partner Desk" badge on partner-desk bookings
- `src/components/NotificationBell.jsx` (edited) — partner-desk copy for review/approved/cancelled
- `functions/bookingNotifications.js` (edited) — `isDeskPlan`, `deskPlanLabel`; cancellation notice reports `planType`
- `functions/index.js` (edited) — `autoApproveDeskBooking` approves a partner-desk booking only if the member's `partnerId` points to an existing partner; plan-aware push copy
- `functions/partners.js` (new) — pure company → partner matching, unit-tested
- `functions/scripts/assign-partners-by-company.cjs` (new) — dry-run/apply: sets `partnerId` on members whose `company` matches a partner name
- `src/locales/en.json`, `src/locales/vi.json` (edited) — `partnerDesk.*`, `adminPartners.*`, notification keys
- `test/deskPlans.test.js` (new) — client helpers, `deskPlanLabel`, company matching
- `test/firestore-member-partner.rules.test.js` (new) — `partnerId` and `partners` rules (emulator)
- `test/bookingCancellationNotice.test.js` (edited) — notice reports `isPlan`
- `README.md` (edited) — `partners` collection, `members.partnerId`, migration script

## Acceptance
- [ ] An admin can add and remove a partner org on `/admin/members`
- [ ] Removing a partner org is blocked while any member is attached to it
- [ ] Adding a partner whose normalized name matches an existing one is rejected
- [ ] An admin can attach a member to a partner org, or detach them, from the member edit form
- [ ] Partner members show a partner badge with the org name in the admin member list, desktop and mobile
- [ ] Admin member search matches partner org names
- [ ] A member cannot set, change or clear their own `partnerId` on create or update (rules-enforced)
- [ ] Only admins can write `partners`; signed-in users can read it
- [ ] A partner member's desk cards offer "Partner Desk" and no "Fixed Desk" button
- [ ] A partner member's plan is written with `planType: 'partner-desk'`
- [ ] Partner-desk bookings are auto-approved when the desk has capacity, like single desk bookings
- [ ] A partner-desk booking from a member with no valid `partnerId` stays pending for admin review
- [ ] Member and admin booking views label partner-desk plans "Partner Desk"
- [ ] In-app and push copy for partner-desk review, approval and cancellation says "partner desk plan", in EN and VI
- [ ] Partner-desk cancellations collapse to one notification per plan, like fixed-desk ones
- [ ] The migration dry run lists every member it would tag (uid, name, company, partner) and writes nothing
- [ ] `--apply` writes only `partnerId` and `updatedAt`
- [ ] NOT: existing fixed-desk plans are left to expire; nothing converts or cancels them
- [ ] NOT: no new Cloud Function exports (CI can't deploy first-of-kind functions)
- [ ] NOT: admin "assign booking" flow unchanged (still Standard / Fixed Desk)
- [ ] NOT: `membershipType` values and `=== 'admin'` checks unchanged
- [ ] NOT: no billing, hours-cap (#112) or renewal (#114) behavior

## Verify
- `npm run lint && npm run build` → green
- `cd functions && npm run lint` → green
- `npm test` → green, including `test/deskPlans.test.js`
- `npm run dev` (local dev mode): attach the local member to a partner in `/admin/members` → member's `/member/bookings` desk card shows "Partner Desk"; registering creates plan cards badged "Partner Desk"
- `firebase emulators:exec --only firestore "node --test test/firestore-member-partner.rules.test.js"` → 6 pass
- `node functions/scripts/assign-partners-by-company.cjs` → dry-run list, no writes; review it before `--apply`
- regression: non-partner member's Fixed Desk register flow, admin Fixed Desk assign, notification bell copy for standard bookings

## Notes
- The "no removal while members are attached" guard is client-side only (rules can't count members). A member left pointing at a removed partner is treated as Fixed Desk on both client and server.
- Rules allow members to write any `planType`, so the server check of `partnerId` in `autoApproveDeskBooking` is what gates auto-approval.
- Partner seats count toward desk `capacity`, as fixed-desk days do; days with no free seat are skipped when the plan is created.
- Company matching normalizes case, spaces and punctuation ("9AM Games", "9am games" and "9AMGames" all match). It is unreliable because members type the field themselves, so review the dry-run output before running `--apply`.
- Order: deploy rules + functions, admin creates the "9AM Games" and "DiiD" partners in the UI, then run the script.
