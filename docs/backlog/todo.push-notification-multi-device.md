# Multi-device Push Notifications with 2-Tier Architecture
**Phase**: — · **Deps**: —

## Goal
Decouple account intent (`preferences.pushNotifications`) from per-device FCM
tokens so one stale token or one device opt-out cannot silence the others.

## Files
- `firestore.rules` — owner CRUD on `members/{uid}/push_tokens/{tokenId}`; legacy `push_tokens/{uid}` write-only.
- `functions/pushTokens.js` (new) — `selectPushTokens` / `readPushTokenRecord` (newest-first, cap 5, always-merge legacy).
- `functions/index.js` — multi-token `getPushTokens`, surgical `deleteStalePushToken`, fan-out + anySuccess markers.
- `src/utils/pushDeviceToken.js` (new) — hash, account predicate, rotation/prune helpers.
- `src/utils/pushDeviceOptIn.js` — local token cache next to the tri-state opt-in marker.
- `src/services/pushNotifications.js` — subcollection writes, rotation delete, post-write prune, local-state-first disable.
- `src/pages/member/Profile.jsx` + `Profile.css` — account checkbox vs This Device.
- `src/locales/en.json` & `vi.json` — account-wide copy vs device-section keys.
- `src/contexts/AuthContext.jsx` — logout always clears this device's token.
- `README.md` & `docs/knowledge/data-flow.md` — collection paths.
- `test/pushNotificationsMultiDevice.test.js` (new) — hash, selection, prune, rotation.

## Acceptance
- [x] Cloud Functions never write `preferences.pushNotifications`.
- [x] Multiple devices can register concurrent token docs for the same uid.
- [x] Fan-out sends to every selected token for an opted-in member.
- [x] `deleteStalePushToken` deletes only the failing token doc.
- [x] Device disable / logout deletes only this device's token.
- [x] Local opt-out is committed before any async Firestore work.
- [x] Account checkbox off stops dispatch without deleting tokens.
- [x] Account copy describes account-wide delivery, not this-browser permission.
- [x] `getPushTokens` merges the legacy flat-doc token even when the subcollection is non-empty.
- [x] Saving a rotated FCM token deletes this browser's previous doc before prune.
- [x] `hashPushToken` throws on falsy input.
- [x] NOT: change notification types or email.

## Verify
- `npm run lint` → exit 0
- `npm run build` → exit 0
- `cd functions && npm run lint` → exit 0
- `npm test` → exit 0
- manual: two phones both receive a booking approval; stale token A is pruned and token B still receives; desktop account-off stops dispatch.

## Notes
- Doc id: `SHA-256(token).slice(0, 32)`.
- Logout always attempts this-device cleanup; `disablePushNotificationsOnLogout` no-ops on non-phones.
- Prune runs after the write so overflow from concurrent registrations self-heals; incoming id is never evicted.
