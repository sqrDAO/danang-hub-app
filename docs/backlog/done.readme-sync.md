# Sync README and CLAUDE.md with current codebase
**Phase**: — · **Deps**: —

## Goal
README has drifted behind the code: functions run Node 22 (not 20), and the `notifications` collection plus several source files are missing from its authoritative tables. Bring README (and CLAUDE.md's runtime mention) back in line.

## Files
- `README.md` (edited) — Node 20→22 in Tech Stack; add `notifications` row to Firestore Collections; add `NotificationBell.jsx`, `hooks/`, `utils/toast.js` to Project Structure; add emulator opt-in vars to Environment Variables
- `CLAUDE.md` (edited) — Node.js 20 → 22 in the intro line

## Acceptance
- [ ] Tech Stack row says Cloud Functions Node.js 22, matching `functions/package.json` engines
- [ ] Firestore Collections table includes `notifications` with function-written / read-own semantics
- [ ] Project Structure lists `NotificationBell.jsx`, `hooks/useAuth.js`, `hooks/useTheme.js`, `utils/toast.js`
- [ ] Environment Variables section shows `VITE_USE_EMULATORS` and `VITE_EMULATOR_HOST` as optional
- [ ] NOT: no feature descriptions, Cloud Functions rows, or setup steps changed beyond the items above

## Verify
- `grep -c "Node.js 22" README.md CLAUDE.md` → 1 each; `grep -c "Node.js 20" README.md CLAUDE.md` → 0 each
- `grep -n "notifications\`" README.md` → collections-table row present
- `npm run lint && npm run build` → green (docs-only change)
