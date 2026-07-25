# Localize the public Events and Amenities pages
**Phase**: — · **Deps**: —

## Goal
`src/pages/Events.jsx` and `src/pages/Amenities.jsx` never call `useTranslation` —
titles, subtitles, loading text, empty states and buttons are hardcoded English. These
are the two anonymous-visitor pages, so a Vietnamese visitor's first impression of the
hub is untranslated while every member page is fully localized.

## Files
- `src/pages/Events.jsx` (edited) — add `useTranslation`; replace every hardcoded
  string with a `t()` key.
- `src/pages/Amenities.jsx` (edited) — same.
- `src/locales/en.json` (edited) — add `publicEvents.*` and `publicAmenities.*` keys.
- `src/locales/vi.json` (edited) — same keys, Vietnamese copy.

## Acceptance
- [ ] `src/pages/Events.jsx` contains no user-visible hardcoded string literal.
- [ ] `src/pages/Amenities.jsx` contains no user-visible hardcoded string literal.
- [ ] `en.json` and `vi.json` have identical key sets after the change.
- [ ] Switching to VI on `/events` translates the title, section headers, empty state and buttons.
- [ ] Switching to VI on `/amenities` does the same.
- [ ] NOT: no layout, styling or component-structure changes.
- [ ] NOT: no changes to Firestore-sourced content (amenity and event names stay as stored).

## Verify
- `npm run lint && npm run build` → green
- `npm run dev` → logged out, visit `/events` and `/amenities`, toggle EN↔VI; all chrome
  switches language, no raw key strings render
- key parity: `node -e "…flatten en.json/vi.json and diff key sets…"` → zero difference
- regression: `/events` register and waitlist buttons still navigate to
  `/login?...redirect=/member/events` when logged out

## Notes
Reuse existing keys where the same copy already exists under `memberEvents.*` /
`amenities.*` rather than duplicating strings; only add new keys for genuinely
public-only copy.
