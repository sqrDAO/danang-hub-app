# Add missing common.saving i18n key
**Phase**: — · **Deps**: —

## Goal
Three Save buttons call `t('common.saving')`, but that key doesn't exist in either
`en.json` or `vi.json` (only `profile.saving` exists), so i18next renders the literal
string `common.saving` while a mutation is in flight. Add the key in both locales.

## Files
- `src/locales/en.json` (edited) — add `"saving": "Saving…"` under the `common` object,
  next to the existing `"save": "Save"` key.
- `src/locales/vi.json` (edited) — add `"saving": "Đang lưu…"` under the `common` object,
  matching `profile.saving`'s existing Vietnamese translation.

## Acceptance
- [ ] `common.saving` resolves to "Saving…" in English.
- [ ] `common.saving` resolves to "Đang lưu…" in Vietnamese.
- [ ] `src/pages/admin/Amenities.jsx:402`'s save button shows "Saving…"/"Đang lưu…" while its mutation is pending, not the literal string `common.saving`.
- [ ] `src/pages/admin/Members.jsx:67`'s save button shows the same while pending.
- [ ] `src/pages/admin/Events.jsx:726`'s save button shows the same while pending.
- [ ] NOT: no change to `profile.saving` or any other existing key.
- [ ] NOT: no change to the three call sites themselves — they already call `t('common.saving')` correctly; only the key is missing.

## Verify
- `node -e "const en=require('./src/locales/en.json'),vi=require('./src/locales/vi.json');const f=(o,p='')=>Object.entries(o).flatMap(([k,v])=>v&&typeof v==='object'&&!Array.isArray(v)?f(v,p+k+'.'):[p+k]);const e=new Set(f(en)),v=new Set(f(vi));console.log('missing in vi',[...e].filter(k=>!v.has(k)));console.log('missing in en',[...v].filter(k=>!e.has(k)))"` → both empty
- `npm run dev` → `/admin/members`, edit a member, click Save → button reads "Saving…" during the request, in both languages (toggle via the header language switcher)
- same check on `/admin/amenities` (edit an amenity) and `/admin/events` (edit an event)
- `npm run lint && npm run build` → green

## Notes
Found during the 2026-07-27 weekly review. Two of the three call sites are new this week
(PRs #42, #31); the third (`admin/Events.jsx:726`) predates this window but shares the
exact same missing key, so it's fixed in the same spec rather than split — same file
class, same one-line root cause.
