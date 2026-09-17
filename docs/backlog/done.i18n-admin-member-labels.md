# Localize hardcoded Admin/Member role labels on four authenticated pages
**Phase**: — · **Deps**: —

## Goal
Four authenticated pages render the literal English strings `'Admin'`/`'Member'` instead
of the existing `adminMembers.adminOption`/`adminMembers.memberOption` i18n keys the
public Events page already uses for the identical label.

## Files
- `src/pages/member/Dashboard.jsx` (edited) — line 256.
- `src/pages/member/Events.jsx` (edited) — line 783.
- `src/pages/admin/Dashboard.jsx` (edited) — line 135.
- `src/pages/admin/Events.jsx` (edited) — line 725.

Each: replace `member.membershipType === 'admin' ? 'Admin' : 'Member'` with
`member.membershipType === 'admin' ? t('adminMembers.adminOption') : t('adminMembers.memberOption')`.

## Acceptance
- [ ] All four call sites use `t('adminMembers.adminOption')`/`t('adminMembers.memberOption')`
      instead of literal strings.
- [ ] The role label renders in Vietnamese ("Quản trị"/"Thành viên") when the app locale
      is `vi`, on all four pages.
- [ ] NOT: this does not add new i18n keys — `adminOption`/`memberOption` already exist in
      both `en.json` and `vi.json`.

## Verify
- `npm run lint && npm run build` → both clean.
- `grep -rn "'Admin' : 'Member'" src/` → no remaining matches.
- Manual (dev server): switch to `vi`, view Member Dashboard, Member Events, Admin
  Dashboard, and Admin Events → role label shows the Vietnamese text on all four.

## Notes
Implementation landed on `main` directly (commit `20900d8`, later reverted as `be7f2cf`
and reapplied as `8120571`) instead of through a PR — a branch-tracking mistake (new
branch's upstream defaulted to `origin/main`) caused pushes to go straight to `main`.
Content was verified safe (lint/build/test clean, manual `vi` check passed) before being
left in place; flagging here since the git history doesn't show a merged PR for this spec.
