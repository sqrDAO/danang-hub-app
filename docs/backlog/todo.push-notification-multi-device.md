# Multi-device Push Notifications with 2-Tier Architecture
**Phase**: — · **Deps**: —

## Goal
Decouple push notifications into two independent tiers:
1. **Account-level Preference** (`members/{uid}.preferences.pushNotifications`): Represents the user's overarching intent to receive push notifications across their account.
2. **Device-level Token Management** (`push_tokens` multi-token data model): Manages FCM tokens per device/browser session.

A user may have multiple registered devices. Turning push on/off on one device or having a single stale token must never mutate or disable the account preference, and must never destroy other registered devices' tokens.

## Architecture & Design

### Tier 1: Account Level (User Preferences)
- **Field**: `preferences.pushNotifications` in `members/{uid}` (boolean).
- **Semantics**: "Do I want to receive push notifications for my account events?"
- **Behavior**:
  - Configurable from any platform (Mobile or Desktop).
  - Cloud Functions gate push sending on `member.preferences.pushNotifications === true`.
  - If `false`, no push notifications are dispatched to any of the user's devices.
  - **Server-side immutability**: Backend functions (e.g. stale token pruning) **NEVER** set `preferences.pushNotifications` to `false`.

### Tier 2: Device Level (Token & Hardware Registration)
- **Data Model**:
  - Multi-token subcollection: `members/{uid}/push_tokens/{tokenId}` where `tokenId` is the first 32 hex chars of `SHA-256(rawFCMToken)`.
  - Token documents: `{ token, platform, createdAt, updatedAt }`.
  - Security rules: Authenticated user can read, create, update, and delete only their own push token documents.
- **Client Behavior (This Device)**:
  - Enabling push on a device (`enableDevicePushNotifications`) requests browser permission, mints an FCM token, saves the device token document, and sets the local device marker (`pushDeviceOptIn:${uid}`).
  - Disabling push on a device (`disableDevicePushNotifications`) commits local state first (synchronously), then removes its specific token document, and calls FCM `deleteToken()`. It does **NOT** toggle `preferences.pushNotifications`.
  - On app launch, an eligible device refreshes its own FCM token via a `getDoc` existence check — new tokens are pruned for, existing tokens just update `updatedAt`.
  - On logout, only the active device's token is deleted.
- **Server Behavior (Cloud Functions)**:
  - `getPushTokens(memberId)`: Queries the `push_tokens` subcollection for all active tokens, sorts newest first by numeric timestamp, caps at 5. Falls back to legacy flat `push_tokens/{memberId}` when subcollection is empty.
  - `sendPushToMembers`: Fans out to all tokens per member. Reserves dedupe marker once per member (not per token). Aggregates outcomes across all device tokens — at least one success marks the marker as sent.
  - `deleteStalePushToken(recipientId, failedToken)`: Deletes only the offending token document from the subcollection. Never touches the member document.

---

## Files
- `firestore.rules` — security rules for `members/{userId}/push_tokens/{tokenId}` subcollection + locked-down legacy flat collection.
- `src/utils/pushDeviceToken.js` (new) — deterministic SHA-256 token hashing (throws on falsy) and account push predicate.
- `src/utils/pushDeviceOptIn.js` — adds `getStoredDeviceToken` / `setStoredDeviceToken` / `clearStoredDeviceToken` token cache alongside existing three-state opt-in machine.
- `src/services/pushNotifications.js` — full rewrite of token-management layer: subcollection writes, existence-check pruning, local-state-first disable, split `enableDevice`/`enableAccount` and `disableDevice`/`disableAccount`.
- `src/pages/member/Profile.jsx` — adds `ProfileDevicePushSection` (device-level toggle), `AccountPushPreferenceField` for the form; `handleSubmit` syncs push inline on preference change.
- `src/pages/member/Profile.css` — device push badge + row styles.
- `functions/index.js` — `getPushTokens` (multi-token, numeric sort, legacy fallback), surgical `deleteStalePushToken`, multi-device `sendPushToRecipients` with per-member outcome aggregation, fan-out `sendPushToMembers`.
- `src/locales/en.json` & `src/locales/vi.json` — new device-section i18n keys.
- `test/pushNotificationsMultiDevice.test.js` (new) — unit tests for the above.

---

## Acceptance
- [x] `members/{uid}.preferences.pushNotifications` is treated purely as a user-controlled preference and is never modified by Cloud Functions error handling.
- [x] Multiple devices logged into the same account can both register and persist their respective FCM tokens concurrently.
- [x] Cloud Functions dispatch push notifications to all valid tokens associated with an opted-in `memberId`.
- [x] When a push send fails due to an unrecoverable error (e.g. `registration-token-not-registered`), `deleteStalePushToken` deletes only the offending token document.
- [x] Pruning a stale token for Device A does not delete Device B's token nor flip `preferences.pushNotifications` to `false`.
- [x] Disabling push on the current device (or logging out) deletes only the current device's FCM token document.
- [x] Local device opt-out state is committed synchronously before any async Firestore work in the disable path.
- [x] Toggling Account-level push preference to `false` in Profile stops push notifications from being dispatched to all devices without deleting their registered tokens.
- [x] Launch-time token refresh uses a Firestore existence check (not a caller hint) to determine new-vs-existing device, so pruning is never incorrectly skipped.
- [x] Profile UI clearly demarcates Account Preferences (global push toggle) from This Device (per-browser status + toggle).
- [x] `firestore.rules` enforces that users can only read, create, update, and delete their own device tokens.
- [x] `hashPushToken` throws on falsy input — no `'default'` sentinel document ID.

---

## Verify
- [ ] `npm run lint` → exit 0
- [ ] `npm run build` → exit 0
- [ ] `cd functions && npm run lint` → exit 0
- [ ] `npm test` → exit 0
- [ ] Manual test, multi-device setup:
  1. Log into Account X on Device 1 (Mobile A) → Enable push → Verify token A is created in Firestore subcollection.
  2. Log into Account X on Device 2 (Mobile B) → Enable push → Verify token B is created and token A is preserved.
  3. Trigger a push event (e.g. booking approval) → Confirm both Device 1 and Device 2 receive the notification.
  4. Force token A to become stale → Trigger a push event → Confirm token A is pruned, token B receives the push, and `preferences.pushNotifications` remains `true`.
  5. Log out of Device 2 → Confirm token B is deleted, token A remains intact.
  6. On Desktop: Toggle Account-level push to `false` → No notifications sent. Toggle back to `true` → Notifications resume.

---

## Notes
- **Token Doc ID Strategy**: `SHA-256(token).slice(0, 32)` — deterministic, collision-free, no token value in the doc path.
- **Migration & Backward Compatibility**: `getPushTokens` falls back to the legacy `push_tokens/{uid}` flat collection when the subcollection is empty so existing active tokens are not dropped immediately.
- **Disable Ordering**: Local state (`setDeviceOptedOut`, `clearStoredDeviceToken`) is committed synchronously before any async Firestore or FCM work. A network error during cleanup cannot leave the device thinking it is still opted in.
- **Pruning Guard**: `savePushToken` calls `getDoc(tokenRef)` to check if the document already exists before pruning. If it exists, this is a same-device refresh — no slot is consumed and pruning is skipped. If it is new, pruning runs first.
