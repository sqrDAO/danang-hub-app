# Push tokens per phone, on/off per phone
**Phase**: — · **Deps**: —

## Goal
Each member keeps one push token per phone, so every phone that turned notifications on receives them (#141). On/off is per phone: switching off or logging out on one phone never silences the member's other phones.

## Files
- `firestore.rules` (edited) — owner-only write rule for `push_tokens/{uid}/devices/{deviceId}`; no client reads; legacy rule kept
- `test/firestore-push-tokens.rules.test.js` (new) — rules cases for the devices path and the legacy doc
- `functions/pushTokens.js` (new) — pure helpers: dedupe a member's tokens, decide per member whether any send succeeded
- `test/pushTokens.test.js` (new) — `node --test` cases for those helpers
- `functions/index.js` (edited) — read device tokens plus the legacy doc; one recipient per token; per-doc stale cleanup
- `src/utils/pushDeviceOptIn.js` (edited) — stable per-phone id; refresh and prompt drop the preference; remove `shouldOfferDevicePushEnable`
- `test/pushDeviceOptIn.test.js` (edited) — matrix updated; `shouldOfferDevicePushEnable` cases removed
- `src/services/pushNotifications.js` (edited) — save/remove this phone's device doc; logout cleans up this phone only
- `src/utils/pushOptInPrompt.js` (edited) — prompt keys on this phone's opt-in only
- `src/contexts/AuthContext.jsx` (edited) — logout cleanup on every push-eligible phone; foreground listener gated on this phone
- `src/pages/member/Profile.jsx`, `src/pages/member/Profile.css` (edited) — switch and view row show this phone; remove `DevicePushEnableControl` and its styles
- `src/pages/member/Bookings.jsx`, `src/pages/member/Events.jsx`, `src/components/PushOptInBanner.jsx` (edited) — drop the account-level `pushOptedIn` input
- `src/locales/en.json`, `src/locales/vi.json` (edited) — desktop note; remove `pushNotificationsRegisteredPhone*`, `pushNotificationsDeviceUnregistered`, `pushNotificationsEnableThisDevice`
- `README.md`, `docs/knowledge/data-flow.md` (edited) — `push_tokens` shape and push routing

## Acceptance
- [ ] A member who turned notifications on for two phones gets each push on both
- [ ] A token stored in two entries is sent once
- [ ] Turning notifications off in Profile on phone A stops push on phone A only
- [ ] Profile's switch and view row show this phone's opt-in
- [ ] Saving Profile writes back the stored `preferences.pushNotifications` unchanged
- [ ] On desktop, Profile shows a note that notifications are managed on each phone, with no switch
- [ ] Logging out on phone A removes only phone A's device doc
- [ ] Logout cleanup runs on every push-eligible phone, whatever its opt-in marker says
- [ ] Logging out deletes this phone's FCM browser token
- [ ] Logging out keeps phone A's opt-in, so logging back in re-registers it without a permission prompt
- [ ] Turning a phone off or logging out also deletes the legacy `push_tokens/{uid}` doc
- [ ] A refused cleanup step (device doc, legacy doc, browser token) does not skip the others
- [ ] A member whose token sits only in the legacy doc keeps receiving push after the deploy
- [ ] A dead token deletes every entry whose stored token equals it
- [ ] A dead token leaves entries holding a different token
- [ ] The dedupe marker is kept when any of a member's phones succeeded, across all send batches
- [ ] The dedupe marker is released when every one of a member's phones failed
- [ ] The after-success opt-in prompt shows on any phone that isn't opted in, even if another phone is
- [ ] An adopted phone starts the foreground listener in the same session it is adopted
- [ ] Enabling fails with an error when this phone can't store its device id
- [ ] An owner can create their own device doc
- [ ] An owner can update their own device doc
- [ ] An owner can delete their own device doc
- [ ] An owner can delete their own legacy `push_tokens/{uid}` doc
- [ ] An owner cannot write another member's device docs
- [ ] No client can read any device doc, including their own
- [ ] A device doc with keys other than `token`, `platform`, `updatedAt` is refused
- [ ] A device doc with an empty `token` is refused
- [ ] A device doc with a non-string `token` is refused
- [ ] NOT: the app writes `push_tokens/{uid}` (delete only)
- [ ] NOT: the account preference gates sending to device docs
- [ ] NOT: turning a phone off or logging out writes `preferences.pushNotifications`
- [ ] NOT: a migration script, server-side legacy deletes, or a cap on phones per member

## Verify
- `npm run lint && npm run build` → green
- `cd functions && npm run lint` → green
- `npm test` → green, including `test/pushTokens.test.js` and `test/pushDeviceOptIn.test.js`
- `npm run test:rules` → green, including `test/firestore-push-tokens.rules.test.js`
- `npm run dev`, Profile, mobile viewport → no "registered phone" box, no "Enable on this phone" button; desktop → the note
- post-deploy (human): enable on two phones, approve a booking → both buzz; log out on one, approve another → only the other buzzes; log back in → both buzz again
- post-deploy (human): `firebase functions:log` → "Push batch sent" `attempted` counts tokens, not members
- regression: stale-token cleanup, launch refresh, fixed-desk grouped push (one push per plan)

## Notes
- Device id: random, in localStorage `pushDeviceId` (per phone, not per uid), kept across logouts, so a token refresh overwrites the same doc. If it can't be stored, enable throws `PUSH_DISABLED_MESSAGE`.
- Legacy read: the server reads `push_tokens/{uid}` only while `preferences.pushNotifications === true`, as today. A follow-up issue removes it once phones have re-registered.
- The app no longer changes `preferences.pushNotifications`. It is read only by the legacy read and `shouldAdoptLegacyOptIn`.
- Deploy order is Hosting → rules → Functions. For a few minutes the old rules refuse device-doc writes and deletes. Run cleanup steps independently (`Promise.allSettled`), so the legacy delete and `deleteToken` still land. A refused register retries on next launch.
- Dedupe keeps, per token, every doc that held it, so stale cleanup can delete each one (own transaction, delete only if the stored token still matches).
- Markers stay per member (one push per fixed-desk plan). Decide mark/release once after all 500-token batches; a thrown batch counts as failed for its tokens.
- Overrides earlier specs on purpose: `done.push-stale-token-keeps-preference.md` (refresh needed the preference) and `done.mobile-only-browser-push.md` (desktop opt-out control). Consequence: a phone whose marker says opted in, but whose account preference was turned off elsewhere, resumes push on its next launch.
- `shouldAdoptLegacyOptIn` is unchanged. On a phone shared between accounts, account Y may be adopted where account X granted permission. This already happens today; accepted.
