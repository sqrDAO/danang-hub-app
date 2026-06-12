# Ratchet clean-code caps to error

**Phase**: — · **Deps**: —

## Goal

Work the 45 baseline warnings — 41 clean-code cap violations (29 `complexity`,
11 `max-statements`, 1 `max-depth`) plus 4 react-refresh/exhaustive-deps warnings — down
to zero, then flip the five cap rules from `warn` to `error` and restore
`--max-warnings 0` so regressions block the build.

## Files

- `src/pages/member/Events.jsx` (edited) — 10 violations, worst offender
- `src/pages/admin/Events.jsx` (edited) — 5 violations
- `src/pages/admin/Amenities.jsx` (edited) — 4 violations
- `src/pages/admin/Bookings.jsx`, `src/pages/member/Bookings.jsx` (edited) — 3 each
- remaining files with 1–2 violations each (see `npm run lint` output)
- `.eslintrc.cjs` (edited) — flip the five cap rules from `"warn"` to `"error"`
- `package.json` (edited) — `lint` script back to `--max-warnings 0`

## Acceptance

- [ ] All five cap rules set to `["error", N]` with unchanged N values
- [ ] `lint` script uses `--max-warnings 0` again
- [ ] `npm run lint` exits 0
- [ ] CLAUDE.md "Clean-code caps" section reflects error severity (no stale ratchet language)
- [ ] NOT: no behavior changes — refactors must be extract-function/early-return only,
      verified per page in the running app

## Verify

- `npm run lint` → exit 0, zero warnings
- `npm run build` → green
- regression: booking create + event create/approve flows still work in `npm run dev`

## Notes

May be split into per-page specs if a single refactor PR gets too large. Lower the
`--max-warnings` baseline in `package.json` as violations are fixed so the count can
never climb back up (the ratchet).
