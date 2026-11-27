# Local dev fixtures: sample amenity photos
**Phase**: — · **Deps**: —

## Goal
In `npm run dev:skipauth` no amenity has photos, so the photo-count badge and the
lightbox can't be opened locally. Give the local Coworking Space three inline
placeholder photos.

## Files
- `docs/backlog/todo.local-fixture-photos.md` (new) — this spec.
- `src/services/localDevFixtures.js` (edited) — `samplePhoto` helper; three photos on `local-desk`.

## Acceptance
- [ ] `buildLocalDevAmenities()` gives `local-desk` three `data:image/svg+xml` photos.
- [ ] Other local amenities keep `photos: []`.
- [ ] NOT: no network or Storage request for the sample photos.
- [ ] NOT: no change outside local dev mode.

## Verify
- `npm test` → `test/localDevFixtures.test.js` passes.
- `npm run lint` → zero warnings.
- `npm run build` → succeeds.
- `npm run dev:skipauth` → `/member/bookings`: Coworking Space card shows a photo and
  a "3" badge; clicking it opens the lightbox with Photo 1–3.
