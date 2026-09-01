# Tighten page-title gap
**Phase**: — · **Deps**: —

## Goal
Cut the large empty band under page titles so Members, Welcome Back, and the
other app pages start their content sooner.

## Files
- `docs/backlog/todo.page-header-spacing.md` (new) — this spec.
- `src/styles/globals.css` (edited) — `.page-header` gap uses `--spacing-lg`.
- `src/pages/member/Dashboard.css` (edited) — Welcome Back title gap matches.
- `src/pages/Events.css` (edited) — drop the duplicate xl header margin.
- `src/pages/Amenities.css` (edited) — drop stacked xl header + grid gaps.
- `docs/backlog/todo.hub-closure-notice-placement.md` (edited) — match the new gap.

## Acceptance
- [x] `.page-header` `margin-bottom` is `var(--spacing-lg)`, not `--spacing-xl`.
- [x] `.member-dashboard .page-title` `margin-bottom` is `var(--spacing-lg)`.
- [x] Public Events/Amenities do not re-set `.page-header` to `--spacing-xl`.
- [x] `.amenities-grid` has no extra `--spacing-xl` top margin on the public page.
- [x] `/admin/members` and `/member` show a tighter title-to-content gap than 4rem.
- [x] NOT: do not change `--spacing-xl` itself or Home/Login spacing.
- [x] NOT: do not add top padding to `.main-content` or `.container`.

## Verify
- `npm run lint` → zero warnings.
- `npm run build` → succeeds.
- `npm run dev:skipauth` → `/member` and `/admin/members`: title, then content with ~2rem gap, not a 4rem hole. Same on Bookings/Events.
- regression: hub-closure banner still sits under the Bookings title; calendar and stats row unchanged.

## Notes
- `--spacing-xl` is 4rem desktop / 3rem tablet / 2rem phone; `--spacing-lg` is 2rem / 1.5rem / 1rem.
