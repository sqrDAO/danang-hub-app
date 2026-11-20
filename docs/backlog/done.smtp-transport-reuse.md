# Reuse the event email transport
**Phase**: — · **Deps**: —

## Goal
Resolve [#183](https://github.com/sqrDAO/danang-hub-app/issues/183) by sharing a lazily initialized SMTP pool across warm invocations. Bound stale-connection recovery so an unresponsive pooled socket does not consume the function's 60-second lifetime.

## Files
- `functions/index.js` (edited) — use the shared transport getter.
- `functions/emailTransport.js` (new) — lazy factory with bounded pool options.
- `test/emailTransport.test.js` (new) — verify lazy reuse and stalled-socket recovery.

## Acceptance
- [ ] Repeated calls reuse one transporter per process.
- [ ] Runtime secrets are read on first email use.
- [ ] The pool allows at most two connections per instance.
- [ ] Connections recycle after 100 messages or 60 seconds idle.
- [ ] Socket inactivity times out after 20 seconds.
- [ ] DNS, connection establishment and SMTP greeting each have a 5-second timeout.
- [ ] A stale connection can requeue a message at most once.
- [ ] A local stalled reused socket recovers on a new connection before 45 seconds.
- [ ] sendMail is still awaited and failures follow existing handling.
- [ ] NOT: change email content, recipients or trigger retry policy.

## Verify
- `node --test test/emailTransport.test.js` → lazy reuse/options and local SMTP recovery pass.
- `npm run lint` → zero warnings/errors.
- `npm run build` → production bundle succeeds.
- `npm test` → all runnable tests pass.
- `cd functions && npm run lint` → zero errors.

## Notes
- Each Function instance owns its pool; limits are per instance, not provider-wide.
- Timeouts bound inactivity, not total queue or message duration. A sustained outage can still fail delivery; this does not add durable retries.
- The SMTP regression uses a local server; production provider delivery is not covered.
- References: https://nodemailer.com/smtp/pooled and https://nodemailer.com/smtp
