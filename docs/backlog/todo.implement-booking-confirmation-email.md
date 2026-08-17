# Send the booking confirmation email instead of only logging it
**Phase**: — · **Deps**: —

## Goal
`sendBookingConfirmation` computes whether a member wants email notifications and then only
`console.log`s the booking details — no email is ever sent. Send the email using the same
nodemailer pattern `notifyEventStatusChange` already uses.

## Files
- `functions/index.js` (edited) — replace the `console.log` TODO in `sendBookingConfirmation`
  (~line 1677) with an actual `getTransporter().sendMail(...)` call, gated on `sendEmail` and
  `process.env.EMAIL_USER` exactly like `notifyEventStatusChange` does.

## Acceptance
- [ ] A newly created booking whose member has `preferences.emailNotifications !== false` and a
      valid email triggers `getTransporter().sendMail` with the member's email as recipient.
- [ ] A member with `preferences.emailNotifications === false` receives no email (function still
      logs and returns normally).
- [ ] The email includes amenity name, start time, and end time (formatted in hub timezone, see
      `formatHubTime` usage elsewhere in `functions/index.js`).
- [ ] `cd functions && npm run lint` passes.
- [ ] NOT: do not change `sendBookingConfirmation`'s trigger type or add new Firestore reads
      beyond the existing member/amenity lookups already in the function.

## Verify
- `cd functions && npm run lint` → passes.
- `firebase emulators:start` then create a booking as a member with `emailNotifications` unset →
  check `functions:log` / emulator logs for `Event status email sent`-style confirmation (or
  equivalent new log line), confirm no error is thrown when `EMAIL_USER` is unset locally
  (function should no-op gracefully, matching `notifyEventStatusChange`'s guard).
- regression: `notifyEventStatusChange` and `sendEventReminders` (which also call
  `getTransporter()`) still send successfully — no shared transporter state broken.

## Notes
`notifyEventStatusChange` (`functions/index.js:1857+`) is the reference implementation: same
`prefs.emailNotifications !== false` check, same `process.env.EMAIL_USER` guard, same
`getTransporter().sendMail(...)` call shape. Reuse its HTML template conventions (dark card,
Hub branding) for visual consistency rather than inventing a new layout.
