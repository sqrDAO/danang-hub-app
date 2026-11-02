# removePartner: not-found for a missing partner
**Phase**: — · **Deps**: remove-partner-callable

## Goal
`removePartner` returns `{ daysPending: false }` when `partners/{partnerId}` does not exist, so an admin on a stale list sees a success for a no-op. Make the callable throw `not-found` and have the panel say the partner was already removed and refresh the list.

## Files
- `functions/index.js` (edited) — `detachAndDeletePartner` reads the partner in the transaction, throws `HttpsError('not-found')` if missing
- `src/pages/admin/PartnersPanel.jsx` (edited) — `remove` mutation maps `functions/not-found` to its own toast and refreshes the list
- `src/locales/en.json` (edited) — `toast.partnerAlreadyRemoved`
- `src/locales/vi.json` (edited) — `toast.partnerAlreadyRemoved`

## Acceptance
- [ ] Removing a partner id with no `partners` doc throws `not-found`
- [ ] A missing partner leaves members, amenities and bookings unchanged
- [ ] Removing an existing partner behaves as before
- [ ] On `functions/not-found` the panel shows `toast.partnerAlreadyRemoved` as an info toast
- [ ] On `functions/not-found` the panel refetches `partners` and `amenities`
- [ ] Other errors still show `toast.partnerRemoveFailed`
- [ ] NOT: no existence check when attaching a member to a partner (lower-priority note in #134)
- [ ] NOT: no change to `deleteLocalPartner` or `src/services/partners.js`

## Verify
- `npm run lint && npm run build && npm test` → green
- `cd functions && npm run lint` → green
- `firebase emulators:start`, as admin, call `removePartner` with a made-up id → `not-found`; nothing written
- emulator, open Partners in two tabs, remove a partner in one, then in the other → info toast "already removed" and the row disappears
- regression: remove a partner with an attached member and a synced future day → member detached, day `cancelled` with `partner-removed`

## Notes
The function already exists in prod, so CI's `deploy --only functions` updates it; no local first deploy needed. Closes https://github.com/sqrDAO/danang-hub-app/issues/134.
