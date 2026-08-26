# Keep the account push preference when an FCM token goes stale
**Phase**: — · **Deps**: push-token-refresh

## Goal
A dead FCM token is a device-registration failure, not account intent. Stop
`deleteStalePushToken` from writing `preferences.pushNotifications = false`, and
stop `refreshPushToken` from healing that field back to true, so a desktop
opt-out stays off and Profile keeps showing the member's real choice.

## Files
- `functions/index.js` (edited) — delete the matching `push_tokens/{uid}` doc; do not write `members/{uid}.preferences`
- `src/services/pushNotifications.js` (edited) — re-issue the token on launch without writing the preference; banner eligibility uses the device marker
- `src/contexts/AuthContext.jsx` (edited) — drop the post-heal `refreshUserProfile` path and its `useCallback`; wait for `userProfile.uid` to match before recording the uid
- `src/pages/member/Profile.jsx` (edited) — Save only syncs push on an explicit toggle; Enable-on-this-phone remints when the marker is gone
- `src/pages/member/Profile.css` (edited) — spacing for Enable-on-this-phone
- `src/utils/pushDeviceOptIn.js` (edited) — `shouldRefreshPushToken` requires the account preference on; `shouldAttemptLaunchPushRefresh` requires a matching profile uid; banner suppress and Profile enable predicates
- `src/utils/pushOptInPrompt.js` (edited) — do not skip the banner solely because the account preference is on
- `test/pushDeviceOptIn.test.js` (edited) — preference-off is a no-refresh case; account-switch wait-then-retry; banner suppress and Enable-on-this-phone matrix
- `src/locales/en.json` (edited) · `src/locales/vi.json` (edited) — Enable-on-this-phone copy

## Acceptance
- [x] `deleteStalePushToken` deletes `push_tokens/{uid}` when the stored token matches the failed one
- [x] `deleteStalePushToken` does not write `members/{uid}`
- [x] `deleteStalePushToken` still no-ops when a newer token has already replaced the failed one
- [x] `refreshPushToken` does not write `preferences.pushNotifications`
- [x] `refreshPushToken` re-issues the token when the device is opted in, permission is granted, and the account preference is on
- [x] `refreshPushToken` returns without touching Firestore when the account preference is off
- [x] AuthContext does not call `refreshUserProfile` after a push-token refresh
- [x] `shouldRefreshPushToken` is false when `preferenceEnabled` is false
- [x] `shouldAttemptLaunchPushRefresh` is false when `profileUid` does not equal `uid`
- [x] AuthContext does not record `pushRefreshedForUid` until `userProfile.uid` matches the signed-in uid
- [x] AuthContext does not wrap `refreshUserProfile` in `useCallback`
- [x] `syncPushPreference` returns without calling enable or disable when desired === current
- [x] An explicit push toggle still runs `syncPushPreference` before `updateMember`
- [x] `shouldSuppressPushOptInPrompt` is false when the preference is on and `deviceOptedIn` is false
- [x] `promptPushOptInAfterSuccess` does not skip the banner solely because `preferences.pushNotifications` is true
- [x] `shouldOfferDevicePushEnable` is true when the preference is on, this device has no marker, and the device is mobile-eligible and push-supported
- [x] Profile Enable-on-this-phone calls `enablePushNotifications` from a non-submit control
- [x] NOT: change the single-token `push_tokens/{uid}` data model
- [x] NOT: change logout push cleanup (`disablePushNotificationsOnLogout`)
- [x] NOT: prompt for notification permission outside the Profile push controls and the opt-in banner
- [x] NOT: remint or `requestPermission` from Profile Save when the box was not toggled
- [x] NOT: auto-recover members whose preference the old server path already cleared — they re-enable in Profile once

## Verify
- `npm run lint` → exit 0
- `npm run build` → exit 0
- `cd functions && npm run lint` → exit 0
- `npm test` → exit 0, including `test/pushDeviceOptIn.test.js`
- regression: Profile toggle still enables and disables push; an opted-in phone launch still re-issues `push_tokens/{uid}` when the preference is on

## Notes
- Leftover from `done.push-token-refresh.md`: disabling is account-wide, re-enabling was device-local. A phone with an opted-in marker must not flip the preference back on.
- Until the next opted-in phone launch, a missing token with preference still on is the honest state: Profile stays ticked, `getPushToken` returns `""`, and the next launch rewrites the token.
- PWA reinstall (marker gone, permission `default`) cannot adopt at launch. Recovery is the opt-in banner after the next booking/event success, or Profile Enable-on-this-phone. Save does not remint — that hitch put `requestPermission` on an unrelated write.
