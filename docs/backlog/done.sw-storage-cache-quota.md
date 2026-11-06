# Purge the Storage image cache on quota errors
**Phase**: — · **Deps**: —

## Goal
`firebase-storage-cache` holds Storage images fetched without CORS, so they are opaque,
and Chrome counts each against quota at a padded size of about 4–7 MB (issue #144). Mark
this runtime cache safe to delete on a quota error, as Workbox recommends, so a full
origin quota drops these images instead of leaving every later cache write failing.

## Files
- `public/sw.js` (edited) — `purgeOnQuotaError: true` on the Storage route's `ExpirationPlugin`.

## Acceptance
- [ ] A `QuotaExceededError` during a Workbox cache write deletes `firebase-storage-cache`.
- [ ] Storage images keep rendering after the purge.
- [ ] Storage images are cached under normal quota.
- [ ] NOT: no CORS fetch for Storage images and no bucket CORS change (see Notes).
- [ ] NOT: no change to `maxEntries` or `maxAgeSeconds`.
- [ ] NOT: no change to the other routes.

## Verify
- `npm run lint && npm run build && npm test` → all green
- `npm run build && npm run preview`, open pages with event/amenity images →
  DevTools Application → Cache storage → `firebase-storage-cache` has entries
- DevTools Application → Storage → "Simulate custom storage quota" = 30 MB, open image
  pages and refresh the `firebase-storage-cache` entry count after each → the count drops
  to 0 once usage passes 30 MB, every image still renders
- same, with `purgeOnQuotaError` removed from `dist/sw.js` → the count stops growing and
  never drops (the comparison that shows the purge ran)
- DevTools Application → Service workers → Stop, reopen an image page → Storage usage
  falls back to ~2 MB and the cache fills again
- regression: fonts and HeroCanvas3D caches unaffected

## Notes
Measured in Chromium against 12 production images: about 4.1 MB of quota per opaque
entry (real median size 600 KB). Real devices give an origin up to 60% of total disk
(Chrome; Safari 17+, Home Screen apps included), so 50 entries (~200–350 MB) rarely hit
quota; the purge is the safety net Workbox's storage-quota guide recommends for
opaque runtime caches, alongside `maxEntries`.

Chromium frees a deleted cache's space only once the SW stops (idle ~30 s). Until then
writes keep failing and the cache stays empty; images still load from the network.

Not covered: a quota error from the precache install, Firebase Auth IndexedDB or the
FCM token store does not trigger the purge (only Workbox runtime writes do). Opaque
403/404 responses can't be filtered (status reads as 0); they expire within 7 days.

Root-cause alternative, parked: fetch Storage images in CORS mode in the SW and cache
only 200s, so entries count at real size (~12× smaller). It needs a bucket CORS config
(production sends no `Access-Control-Allow-Origin` today), so it waits until quota is a
real problem.
