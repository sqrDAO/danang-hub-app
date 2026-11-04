# Purge the Storage image cache on quota errors
**Phase**: — · **Deps**: —

## Goal
`firebase-storage-cache` holds Storage images fetched without CORS, so they are opaque,
and Chrome counts each as about 7 MB of quota padding (~350 MB at 50 entries) (issue #144).
On a device with a small origin quota, cache writes then fail; purge this runtime cache
instead, so the precache and the rest of the origin's storage keep working.

## Files
- `public/sw.js` (edited) — `purgeOnQuotaError: true` on the Storage route's `ExpirationPlugin`.

## Acceptance
- [ ] A `QuotaExceededError` during a Workbox cache write deletes `firebase-storage-cache`.
- [ ] Storage images still load and are cached under normal quota.
- [ ] NOT: no `CacheableResponsePlugin({ statuses: [200] })`; opaque images stay cacheable.
- [ ] NOT: no change to `maxEntries`, `maxAgeSeconds`, or the other routes.
- [ ] NOT: no change to the Storage bucket's CORS config.

## Verify
- `npm run lint && npm run build && npm test` → all green
- `npm run build && npm run preview`, sign in, open pages with event/amenity images →
  DevTools Application → Cache storage → `firebase-storage-cache` has entries
- DevTools Application → Storage → "Simulate custom storage quota" = 20 MB, reload and
  open more image pages → `firebase-storage-cache` is gone (purged), app keeps working,
  `workbox-precache-*` is still present
- regression: fonts and HeroCanvas3D caches unaffected

## Notes
Eviction under device storage pressure is least-recently-used by site, not by size,
so the risk here is the per-site quota, not eviction. `purgeOnQuotaError` runs on a
quota error from any Workbox cache write, then this route refills on later visits.
