# Escape member text in the event status email
**Phase**: — · **Deps**: —

## Goal
`notifyEventStatusChange` pastes the event title, rejection reason and display name
straight into the email HTML, so a member can inject a link into a hub-branded email
(#159). HTML-escape those values, send only to the organizer's verified login email (the
profile email is member-editable), and tidy the From header and send-failure log next to it.

## Files
- `functions/emailHtml.js` (new) — pure `escapeHtml(value)` helper, testable without firebase-admin
- `functions/index.js` (edited) — escape `eventTitle`, `reasonText`, `displayName` in the
  email HTML; recipient from `getAuth().getUser(uid)` when `emailVerified`;
  `from: {name, address}`; tagged error log when `sendMail` fails
- `test/emailHtml.test.js` (new) — unit tests for `escapeHtml`

## Acceptance
- [ ] `escapeHtml` replaces `&`, `<`, `>`, `"`, `'` with HTML entities.
- [ ] `escapeHtml` returns `""` for `null` or `undefined`.
- [ ] The event title in the email HTML is escaped.
- [ ] The rejection reason in the email HTML is escaped.
- [ ] The display name in the email HTML is escaped.
- [ ] A title containing HTML shows as literal text in the email, not as markup.
- [ ] The email is sent to the organizer's Firebase Auth email.
- [ ] No email is sent when that Auth email is not verified (wallet and unverified password accounts).
- [ ] The From header is passed as `{name, address}`, not a hand-quoted string.
- [ ] A `sendMail` failure logs at error level with the tag `[event-status-email]`.
- [ ] That failure log includes the full error object (stack and cause).
- [ ] NOT: no email to `members/{uid}.email` (member-editable, so it can point at anyone).
- [ ] NOT: no change to the in-app notification or push, which still reach every organizer.
- [ ] NOT: no escaping of the email subject (plain text, not HTML).
- [ ] NOT: no escaping of push notification bodies.
- [ ] NOT: no escaping of in-app notification text.
- [ ] NOT: no escaping when data is written to Firestore.
- [ ] NOT: no change to `getTransporter` (transport reuse stays a separate issue).

## Verify
- `npm test` → all pass, including `test/emailHtml.test.js`
- `cd functions && npm run lint` → exit 0
- `npm run lint && npm run build` → green
- manual (after deploy): approve an event titled `<a href="https://example.com">x</a> & co`
  → email shows that text literally, angle brackets included, with no link labelled `x`
  (a bare URL may still be auto-linked by the mail client; escaping cannot stop that)
- manual (after deploy): change a Google organizer's profile email to another address, approve
  their event → email arrives at the Google address, not the profile one
- manual (after deploy): approve a wallet organizer's event → no email; bell and push still arrive
- regression: approve and reject a normally titled event → both emails arrive and render as before

## Notes
Escape at output, not at storage: the React app already escapes via JSX, so stored
values must stay raw. `appUrl` comes from env, not members, so it is left as is.
A failed send still does not throw: the in-app notification and push were already
written, and retrying the whole trigger would duplicate the push.

Recipient: firestore.rules lets owners edit `members/{uid}.email` freely, so sending there let
a member aim hub-branded mail at any inbox. Only a verified Auth email proves inbox ownership;
Google sets it, email/password sign-up never verifies (no `sendEmailVerification` in the app).
Wallet and password organizers lose this email only; they keep the bell and push.
