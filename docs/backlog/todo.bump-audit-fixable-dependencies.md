# Apply the non-breaking npm audit fixes for react-router-dom and nodemailer
**Phase**: — · **Deps**: —

## Goal
Two direct dependencies have known vulnerabilities with a fix available inside their
existing semver range (no major bump, no `--force`): root's `react-router-dom`
(open-redirect, SSR-hydration constructor injection) and functions' `nodemailer`
(IDN/punycode allow-list bypass, recipient-domain validation bypass) — the latter now
carries real member-facing cancellation-notice email traffic since PR #73, not just the
pre-existing approval email.

## Files
- `package-lock.json` (edited) — `react-router-dom` / `react-router` 6.30.4 → 6.30.6,
  `@remix-run/router` 1.23.3 → 1.23.4. `package.json` range unchanged (`^6.20.0`).
- `functions/package-lock.json` (edited) — `nodemailer` 9.0.1 → 9.1.1. `functions/package.json`
  range unchanged (`^9.0.1`).

## Acceptance
- [ ] `npm audit` at repo root no longer lists `react-router` or `react-router-dom`.
      Residual: remaining advisories only patch in `react-router-dom@7.18.4` (`isSemVerMajor`).
      Staying on v6 is required; a v7 bump is out of scope.
- [x] `npm audit` in `functions/` no longer lists `nodemailer`.
- [x] `react-router-dom` in `package.json` stays within its declared `^6.20.0` range (no
      major-version bump to v7).
- [x] `nodemailer` in `functions/package.json` stays within its declared `^9.0.1` range.
- [ ] NOT: this does not run `npm audit fix --force` or touch any transitive-only
      advisory (`protobufjs`, `postcss`, `brace-expansion`, `js-yaml`, `body-parser`,
      `qs`, `fast-uri`, `fast-xml-parser`, `baseline-browser-mapping`, `browserslist`,
      `nanoid`) — those have no non-major fix available per this review's baseline audit.

## Verify
- [x] `npm run lint && npm run build` → both clean after the root bump.
- [x] `cd functions && npm run lint` → clean after the functions bump.
- [x] `npm test` → 108 pass, 2 skipped (Firestore emulator rules tests).
- [x] `npm audit` in `functions/` no longer lists `nodemailer` (8 → 7).
- [ ] `npm audit` at repo root no longer lists `react-router` / `react-router-dom`.
      Still listed; only patch is `react-router-dom@7.18.4` (`isSemVerMajor`).
- [x] Emulator: `firebase emulators:exec --project demo-hub-audit --only firestore,functions`
      flipped `events/verify-event-1` `pending` → `approved`. Log:
      `Event status email sent: { to: 'verify-organizer@example.test', eventId:
      'verify-event-1', status: 'approved' }`. Local SMTP sink captured 3135-byte
      message To/Subject/HTML. Notification
      `event_status_verify-organizer-1_verify-event-1_1_approved` written.
- [x] Production preview `:3010` — `/`, `/login`, `/events`, `/amenities`, `/member`,
      `/admin` all HTTP 200 SPA shell; `react-vendor-DcHI3GtM.js` 162246 bytes.

## Notes

Targeted `npm update` of the two named packages rather than blanket `npm audit fix`, so
transitive advisories were left alone. Nodemailer 9.1.1 `createTransport`/`sendMail` path
works in the emulator against a local SMTP sink. Remaining root `react-router` advisories
have no v6 patch; a v7 bump is out of this spec. Awaiting human approval to rename
`todo.*` → `done.*`.
