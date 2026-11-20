# Reuse the event email transport

## Goal
Resolve [#183](https://github.com/sqrDAO/danang-hub-app/issues/183) by sharing a lazily initialized SMTP connection pool across warm invocations.

## Files
- `functions/index.js` — cache the SMTP transporter and enable pooling.

## Acceptance
- [ ] Repeated calls reuse a single transporter per process.
- [ ] SMTP connections are pooled with Nodemailer defaults.
- [ ] Runtime secrets are read on first email use.
- [ ] sendMail is still awaited and failures follow existing handling.

## Verify
- Check lazy construction and repeated reuse with a stub transport factory.
- App lint, Functions lint, build and unit tests pass.

## Notes
- Each Function instance owns its own pool. New instances initialize from their runtime environment.
- Nodemailer manages bounded connections and idle cleanup using its defaults.

## Results
- Stub-factory verification confirmed lazy runtime-secret initialization and one transporter across 20 calls.
- App lint, Functions lint, production build and 298 unit tests pass; 8 emulator-dependent tests skipped.
- Live SMTP delivery and provider limits remain unverified.
- Reference https://nodemailer.com/smtp/pooled
