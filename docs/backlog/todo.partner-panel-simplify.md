# Partner panel: desk on create, remove detaches
**Phase**: — · **Deps**: partner-desk-reservation

## Goal
Each partner gets its desk when it is added, and the rows show it as text with an explicit Change desk action. Removing a partner detaches its members in the same step, instead of refusing until every member was detached by hand.

## Files
- `src/services/partners.js` (edited) — `createPartner({ name, deskAmenityId })` reserves the desk in one transaction; `deletePartner` also detaches the partner's members
- `src/services/localDevStore.js` (edited) — local mirrors of both
- `src/pages/admin/PartnersPanel.jsx` (edited) — add form with desk picker; rows show desk as text; Change desk editor; Remove always available
- `src/pages/admin/Members.css` (edited) — row layout, fixed-width desk picker
- `src/locales/en.json`, `src/locales/vi.json` (edited) — new `adminPartners.*` copy; `removeBlocked` removed
- `test/localDevStore.test.js` (edited) — create with desk, remove detaches

## Acceptance
- [ ] A partner cannot be added without choosing a desk
- [ ] The add form offers only desks no other partner holds
- [ ] Adding a partner reserves its desk in the same write
- [ ] Each partner row shows its desk name and member count as text
- [ ] Change desk opens a picker with Save and Cancel
- [ ] Saving a new desk asks for confirmation, naming the member count and the desk
- [ ] Remove is available while members are attached
- [ ] Removing a partner with members asks for confirmation, naming the member count
- [ ] Removing a partner sets `partnerId` to null on each of its members
- [ ] Removing a partner releases its desk reservation
- [ ] NOT: no change to the hourly sync; it cancels the detached members' days and notifies them as before
- [ ] NOT: member accounts are not deleted

## Verify
- `npm run lint && npm run build && npm test` → green
- `npm run dev:skipauth`, `/admin/members` → add a partner with a desk; the row shows the desk as text; Change desk opens the picker
- regression: `/admin/amenities` shows "Reserved for" on the partner's desk; member edit form still attaches a member to a partner
