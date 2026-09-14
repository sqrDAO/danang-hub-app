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
- `package.json`, `package-lock.json` (edited) — `npm audit fix` at repo root.
- `functions/package.json`, `functions/package-lock.json` (edited) — `npm audit fix`
  inside `functions/`.

## Acceptance
- [ ] `npm audit` at repo root no longer lists `react-router` or `react-router-dom`.
- [ ] `npm audit` in `functions/` no longer lists `nodemailer`.
- [ ] `react-router-dom` in `package.json` stays within its declared `^6.20.0` range (no
      major-version bump to v7).
- [ ] `nodemailer` in `functions/package.json` stays within its declared `^9.0.1` range.
- [ ] NOT: this does not run `npm audit fix --force` or touch any transitive-only
      advisory (`protobufjs`, `postcss`, `brace-expansion`, `js-yaml`, `body-parser`,
      `qs`, `fast-uri`, `fast-xml-parser`, `baseline-browser-mapping`, `browserslist`,
      `nanoid`) — those have no non-major fix available per this review's baseline audit.

## Verify
- `npm run lint && npm run build` → both clean after the root bump.
- `cd functions && npm run lint` → clean after the functions bump.
- `npm test` → existing tests pass (root and, if applicable, functions).
- `npm audit` (root) and `cd functions && npm audit` → neither lists `react-router`,
  `react-router-dom`, or `nodemailer` any more; vulnerability counts drop accordingly.
- Manual (emulators): `cd functions && npm run serve`, then flip a pending event's
  `status` to `approved` (or `rejected`) in the Firestore emulator UI to fire
  `notifyEventStatusChange` — the only reachable `nodemailer` path in this codebase
  (`notifyBookingApproved`/`notifyBookingCancelled` only write in-app/push notifications,
  they do not send email) — and confirm either the email arrives in the configured SMTP
  test inbox or the `Event status email sent` log line appears.
