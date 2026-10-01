# Configure the Auth emulator so emulator-routed sign-in works
**Phase**: — · **Deps**: —

## Goal
`firebase.json` has no `emulators` block, so the Firebase CLI never starts the Auth
emulator: `--only auth` exits with "No emulators to start", and a plain
`firebase emulators:start` silently skips Auth. With `VITE_USE_EMULATORS=true`,
`src/services/firebase.js` still points Auth at `:9099`, so nobody can sign in. That breaks
the emulator flow in README and `docs/knowledge/organizer-event-edit-verification.md` §2.

## Files
- `firebase.json` (edited) — add an `emulators` block that pins the ports
  `src/services/firebase.js` connects to: `auth` 9099, `firestore` 8080, `functions`
  5001, `storage` 9199, plus `ui` enabled on 4000.
- `src/services/firebase.js` (edited) — one comment above the `connect*Emulator` calls
  saying the ports must match `firebase.json` `emulators`.

## Acceptance
- [ ] `firebase emulators:exec --only auth` starts the Authentication emulator on 9099.
- [ ] `firebase emulators:start` with no `--only` starts Auth along with Firestore,
      Functions and Storage.
- [ ] Each emulator port in `firebase.json` equals the port its `connect*Emulator` call
      uses in `src/services/firebase.js`.
- [ ] The verification doc's §2 command (`--only auth,firestore,functions,storage`)
      starts all four emulators with no edit to that doc.
- [ ] NOT: changing any deploy target (`firestore`, `storage`, `functions`, `hosting`
      blocks), CI workflows, or the rules tests' `emulators:exec --only firestore` runs.
- [ ] NOT: running the organizer-event-edit browser matrix (M1–M10); that is separate work
      this unblocks.

## Verify
- `firebase emulators:exec --project demo-auth-check --only auth "curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:9099/"`
  → prints `200` (on `main`: "Error: No emulators to start").
- `firebase emulators:exec --project demo-auth-check --only auth,firestore,functions,storage "echo ok"`
  → all four emulators listed as started, prints `ok`.
- `firebase emulators:exec --project demo-danang-hub-event-edit --only firestore "node --test test/firestore-event-edit.rules.test.js"`
  → still passes (regression).
- `npm run lint && npm run build && npm test` → green.
- Manual: follow verification doc §2 through creating `admin@example.test` with
  email/password → sign-up succeeds and the user appears in the Emulator UI Auth tab.

## Notes
These are the CLI's default ports. Pinning them doesn't change behavior; it records the
coupling with `src/services/firebase.js`, so changing a port in one place and not the
other shows up in review.
