# Localize amenity-type labels on the public Home and Amenities pages
**Phase**: — · **Deps**: —

## Goal
The public Home and Amenities pages render the raw Firestore `amenity.type` slug
(`meeting-room`, `podcast-room`, etc.) instead of the localized label every other page in
the app already uses, so Vietnamese-locale visitors see English text on the app's
most-visible surface.

## Files
- `src/pages/Home.jsx` (edited) — replace `{amenity.type}` (line 179) with
  `{t(\`amenityTypes.${amenity.type}\`, { defaultValue: amenity.type })}`.
- `src/pages/Amenities.jsx` (edited) — replace `{amenity.type}` (line 133) with the same
  pattern.

## Acceptance
- [ ] Home page amenity previews render the localized type label
      (e.g. "Phòng họp" in `vi`, "Meeting Room" in `en`) instead of the raw slug.
- [ ] Public Amenities page amenity cards render the same localized label.
- [ ] An amenity `type` value with no matching `amenityTypes.*` key falls back to
      rendering the raw slug (via `defaultValue`) rather than the literal i18n key string.
- [ ] NOT: this does not add new keys to `amenityTypes` in `en.json`/`vi.json` — all four
      existing amenity types (`desk`, `meeting-room`, `podcast-room`, `event-space`)
      already have entries in both locales.

## Verify
- `npm run lint` → clean.
- `npm run build` → succeeds.
- Manual (dev server): switch the app to `vi`, load the public Home page and
  `/amenities` while logged out → amenity type labels render in Vietnamese, not as
  English slugs.
- regression: confirm `src/components/UnifiedCalendar.jsx` and
  `src/pages/admin/Bookings.jsx` (which already use this pattern) are unaffected.
