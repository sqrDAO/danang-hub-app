# Share push notification content constants between foreground and service worker
**Phase**: — · **Deps**: —

## Goal
`src/services/pushNotifications.js` (`resolvePushContent`, `HUB_ICON`/`HUB_BADGE`/
`DEFAULT_PUSH_TITLE`) and `public/sw.js` (lines 17-39) derive the same push notification content
independently. They agree today; nothing enforces they stay that way, which is exactly the kind
of foreground-vs-background divergence PR #53 fixed once already.

## Files
- `src/utils/pushContent.js` (new) — the shared `HUB_ICON`, `HUB_BADGE`, `DEFAULT_PUSH_TITLE`
  constants and the `resolvePushContent`-equivalent pure function, extracted from
  `pushNotifications.js`.
- `src/services/pushNotifications.js` (edited) — import from `pushContent.js` instead of defining
  locally.
- `public/sw.js` (edited) — import from `pushContent.js` if the service worker's build step
  supports ES module imports (`vite-plugin-pwa`'s `injectManifest` mode, confirm via
  `vite.config.js`); if not, keep `sw.js`'s copy but add a comment pointing at
  `src/utils/pushContent.js` as the source of truth to update in tandem.

## Acceptance
- [ ] `HUB_ICON`, `HUB_BADGE`, `DEFAULT_PUSH_TITLE` are defined in exactly one place that both
      `pushNotifications.js` and `sw.js` reference (either by import, or by explicit
      cross-reference comment if a real import isn't feasible in the service worker build).
- [ ] Foreground and background push notifications render identical icon/badge/title/body for
      the same payload (no visual regression).
- [ ] `npm run lint && npm run build` pass, including the PWA service worker build step.
- [ ] NOT: do not change what content is shown — this is a de-duplication, not a UX change.

## Verify
- `npm run build` → passes, PWA precache step succeeds (confirms `sw.js` still builds correctly
  whichever approach is taken).
- `npm run dev`, trigger a foreground push (app open) and a background push (app closed/tab
  hidden) with the same test payload → visually identical notification content.

## Notes
Check `vite.config.js`'s `VitePWA` config (`injectManifest` strategy per CLAUDE.md's build
output) before assuming `sw.js` can `import` from `src/`. If it can't, the comment
cross-reference is an acceptable fallback — the goal is "one edit updates both, or a comment
makes divergence hard to miss," not necessarily a literal shared module.
