# Upgrade nodemailer in Cloud Functions
**Phase**: — · **Deps**: —

## Goal
Upgrade the direct `nodemailer` dependency from ^9.0.1 to the 10.x line that fixes its
advisories. The email path of `notifyEventStatusChange` then no longer runs on a
vulnerable parser and SMTP client.

## Files
- `functions/package.json` (edited) — bump `nodemailer` to `^10.3.1`
- `functions/package-lock.json` (edited) — lockfile for the bump

## Acceptance
- [ ] `functions/package.json` declares `nodemailer` `^10.3.1` or newer
- [ ] `npm audit` in `functions/` lists no `nodemailer` advisory
- [ ] `cd functions && npm run lint` passes
- [ ] NOT: any change to other dependencies, including the transitive `proxy-addr`
- [ ] NOT: any change to the email-sending code unless 10.x requires it

## Verify
- `cd functions && npm ci && npm audit 2>&1 | grep -c nodemailer` → `0`
- `cd functions && npm run lint` → exits 0
- `npm test` → 0 failures
- `node -e "const n=require('./functions/node_modules/nodemailer');n.createTransport({jsonTransport:true}).sendMail({from:'a@example.com',to:'b@example.com',subject:'s',text:'t'}).then(r=>console.log(r.messageId?'ok':'fail'))"` → `ok`
- `cd functions && node -e "const e=Object.fromEntries(require('fs').readFileSync('.env.danang-hub-app','utf8').split(/\r?\n/).map(l=>l.match(/^(EMAIL_\w+)=(.*)/)).filter(Boolean).map(m=>[m[1],m[2]]));require('nodemailer').createTransport({host:e.EMAIL_SMTP_HOST,port:+(e.EMAIL_SMTP_PORT||465),secure:e.EMAIL_SMTP_SECURE!=='false',auth:{user:e.EMAIL_USER}}).verify().catch(x=>console.log(x.code,x.message))"` → `EAUTH Missing credentials for "PLAIN"`
- regression (after the functions deploy): approve one test event → the member receives the approval email, and `firebase functions:log --only notifyEventStatusChange` shows `Event status email sent`

## Notes
This is a semver-major bump. The `createTransport` and `sendMail` call sites should be
unchanged; the `jsonTransport` smoke test covers that, but it never opens a connection.
The passwordless `verify()` check covers the parts 10.x changed (SMTP client, TLS, DNS):
nodemailer only attempts login after connect, TLS and EHLO succeed, so `EAUTH Missing
credentials` means all three worked against the real host. `EMAIL_PASS` stays in Secret
Manager, so real delivery is confirmed after deploy. A failed `sendMail` is only logged
(no alert), which is why the post-deploy check reads the log on purpose.
Unescaped member text in the email HTML is a separate issue, not part of this upgrade.
