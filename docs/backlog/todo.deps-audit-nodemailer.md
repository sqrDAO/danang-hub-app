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
- `cd functions && npm install nodemailer@^10.3.1 && npm audit 2>&1 | grep -c nodemailer` → `0`
- `cd functions && npm run lint` → exits 0
- `npm test` → 0 failures
- `node -e "const n=require('./functions/node_modules/nodemailer');n.createTransport({jsonTransport:true}).sendMail({from:'a@example.com',to:'b@example.com',subject:'s',text:'t'}).then(r=>console.log(r.messageId?'ok':'fail'))"` → `ok`
- regression: send one event status change on the emulator and confirm the email is delivered

## Notes
This is a semver-major bump. The `createTransport` and `sendMail` call sites should be
unchanged; the smoke test above covers that.
