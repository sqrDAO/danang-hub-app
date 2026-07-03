# Fix functions deploy: migrate index.js to firebase-admin modular API
**Phase**: — · **Deps**: —

## Goal
firebase-admin@14 (bumped in b158cf1) removed the legacy namespaced API, so
`functions/index.js` crashes at load (`admin.firestore is not a function`) and
functions cannot deploy. Migrate index.js to the modular admin imports.

## Files
- `functions/index.js` (edited) — replace namespaced `admin.*` calls with
  modular imports from `firebase-admin/app`, `firebase-admin/firestore`,
  `firebase-admin/auth`

## Acceptance
- [ ] `functions/index.js` has no references to the removed namespaced API
      (`admin.firestore`, `admin.auth`, `admin.initializeApp`)
- [ ] `firebase emulators:start --only functions` loads all 11 function
      definitions without errors
- [ ] NOT: firebase-functions v1→v2 API changes (that is
      `todo.dep-major-migrations.md`)
- [ ] NOT: any dependency version changes

## Verify
- `cd functions && node -e "require('./index.js')"` with
  `GOOGLE_CLOUD_PROJECT` set → loads without TypeError
- `firebase emulators:start --only functions` → all functions listed, no
  "Failed to load function definition" errors
- `cd functions && npm run lint` → exits 0
- regression: `checkBookingConflicts` callable responds in emulator

## Notes
Mechanical mapping: `admin.initializeApp()` → `initializeApp()` (from
`firebase-admin/app`); `admin.firestore()` → `getFirestore()`;
`admin.firestore.Timestamp`/`FieldValue` → `Timestamp`/`FieldValue` (from
`firebase-admin/firestore`); `admin.auth()` → `getAuth()` (from
`firebase-admin/auth`). The firebase-functions v1 wrapper API is unaffected —
it only requires the admin SDK to be initialized, not the namespaced exports.
