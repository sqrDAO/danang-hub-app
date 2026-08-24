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
  - **Server-side immutability**: Backend cleanup functions (e.g. stale token pruning) **NEVER** set `preferences.pushNotifications` to `false`.

### Tier 2: Device Level (Token & Hardware Registration)
- **Data Model**:
  - Multi-token collection: `push_tokens/{tokenId}` where `tokenId` is a deterministic hash of the token or `${uid}_${deviceHash}` (or indexed document containing `{ uid, token, platform, userAgent, createdAt, updatedAt }`).
  - Security rules (`firestore.rules`): Authenticated user can create, update, and delete only push token documents where `resource.data.uid == request.auth.uid` (or doc path matching uid).
- **Client Behavior (This Device)**:
  - Enabling push on a device requests browser permission, mints an FCM token, saves the device token document, and sets the local device marker (`pushDeviceOptIn:${uid}`).
  - Disabling push on a device removes its specific token document, calls FCM `deleteToken()`, and clears/updates the local device marker. It does **NOT** toggle `preferences.pushNotifications` to `false` (unless the user explicitly toggles the account-level switch).
  - On app launch, an eligible device refreshes its own FCM token and updates its specific token document.
  - On logout (`disablePushNotificationsOnLogout`), only the active device's token is deleted.
- **Server Behavior (Cloud Functions)**:
  - `getPushTokens(memberId)`: Queries all active token docs for `memberId` from `push_tokens`.
  - `sendPushToRecipients`: Sends payload via FCM multicast across all active tokens.
  - `deleteStalePushToken(recipientId, failedToken)`: Deletes only the individual failed token document from `push_tokens`. Leaves the member's account preference and any sibling device tokens completely intact.

---

## Files
- `firestore.rules` (edited) — update security rules for `push_tokens` to support subcollections at `members/{userId}/push_tokens/{tokenId}` while retaining legacy single-token rules.
- `src/utils/pushDeviceToken.js` (new) — deterministic SHA-256 token hashing and account push predicate.
- `src/services/pushNotifications.js` (edited) — update token persistence methods (`savePushToken`, `removeStoredPushToken`, `enablePushNotifications`, `disableDevicePushNotifications`, `refreshPushToken`, `disablePushNotificationsOnLogout`) to manage device-scoped tokens without mutating account preferences on launch.
- `src/pages/member/Profile.jsx` & `Profile.css` (edited) — separate UI into Account Preferences (global push toggle) and Device Settings (this device push status / enable-disable toggle).
- `src/utils/pushDeviceOptIn.js` (edited) — adjust device opt-in and refresh predicates for multi-device semantics.
- `functions/index.js` (edited) — update `getPushTokens` to resolve multiple tokens per member with deduplication; update `deleteStalePushToken` to prune only matching token docs; aggregate multicast response outcomes to safeguard dedupe markers.
- `test/pushDeviceOptIn.test.js` (edited) — tests for device-level opt-in predicates.
- `test/pushNotificationsMultiDevice.test.js` (new) — unit tests covering deterministic hashing, multi-token resolution, stale token pruning isolation, multi-device payload dispatching, mixed-outcome dedupe aggregation, and launch-refresh preference preservation.
- `src/locales/en.json` & `src/locales/vi.json` (edited) — add localized copy distinguishing account-level notification settings from device-level push status.

---

## Acceptance
- [x] `members/{uid}.preferences.pushNotifications` is treated purely as a user-controlled preference and is never modified by Cloud Functions error handling.
- [x] Multiple devices (e.g. Phone A and Phone B) logged into the same account can both register and persist their respective FCM tokens concurrently.
- [x] Cloud Functions dispatch push notifications to all valid tokens associated with an opted-in `memberId`.
- [x] When a push send fails due to an unrecoverable error (e.g. `registration-token-not-registered`), `deleteStalePushToken` deletes only the offending token document.
- [x] Pruning a stale token for Device A does not delete Device B's token nor flip `preferences.pushNotifications` to `false`.
- [x] Disabling push on the current device (or logging out) deletes only the current device's FCM token document.
- [x] Toggling Account-level push preference to `false` in Profile stops push notifications from being dispatched to all devices without deleting their registered tokens.
- [x] Launch-time token refresh re-issues and updates the token doc for the current device without touching other devices' tokens or resurrecting disabled account preferences.
- [x] Profile / Preferences UI clearly demarcates:
  - Account Preferences: Global switch for Push Notifications (accessible on all platforms).
  - This Device: Status and control for the current browser/device (permission state, registration toggle).
- [x] `firestore.rules` enforces that users can only read, create, update, and delete their own device tokens.
- [x] NOT: allow client-side listing of other members' device tokens.
- [x] NOT: require desktop browsers to support Web Push if mobile-only policy is maintained, but ensure desktop UI can manage Account-level preferences cleanly.

---

## Verify
- [x] `npm run lint` → exit 0
- [x] `npm run build` → exit 0
- [x] `cd functions && npm run lint` → exit 0
- [x] `npm test` → exit 0
- [ ] Manual test, multi-device setup:
  1. Log into Account X on Device 1 (Mobile A) → Enable push → Verify token A is created in Firestore.
  2. Log into Account X on Device 2 (Mobile B) → Enable push → Verify token B is created and token A is preserved.
  3. Trigger a push event (e.g. booking approval) → Confirm both Device 1 and Device 2 receive the notification.
  4. Force token A to become stale (or delete in FCM) → Trigger a push event → Confirm token A is pruned, token B receives the push, and `preferences.pushNotifications` remains `true`.
  5. Log out of Device 2 → Confirm token B is deleted, token A remains intact.
  6. On Desktop: Toggle Account-level push to `false` → Trigger push event → Confirm no notifications sent to any device. Toggle back to `true` → Notifications resume.

---

## Notes
- **Token Doc ID Strategy**: Using deterministic IDs such as `${uid}_${hash(token)}` or subcollections `members/{uid}/push_tokens/{tokenId}` prevents collisions while simplifying ownership checks in `firestore.rules`.
- **Migration & Backward Compatibility**: Existing single-token docs at `push_tokens/{uid}` are seamlessly queried during rollout so existing active tokens are not dropped immediately.
- **Multicast Limits**: FCM `sendEachForMulticast` accepts up to 500 tokens per batch; with multi-token per user, batch slicing in Cloud Functions accounts for the total expanded token count across recipients.
- **Opt-in Banner**: The post-booking opt-in banner continues to register the current device and ensures `preferences.pushNotifications` is set to `true`.

