# Notification bell panel stays in viewport on narrow screens
**Phase**: — · **Deps**: —

## Goal
Keep the header notification dropdown fully visible on smartphone viewports.
Prevent the panel from overflowing horizontally or being clipped off-screen.

## Files
- `src/components/NotificationBell.css` (edited) — clamp panel to viewport on narrow screens.
- `src/components/NotificationBell.jsx` (edited) — only if a small markup hook is required for safe layout.

## Acceptance
- [ ] On viewports ≤480px, the open notification panel stays fully within the horizontal viewport with side margins.
- [ ] The panel has a max height within the visible viewport and scrolls its list when content overflows.
- [ ] Desktop / wider layouts keep the existing dropdown-under-bell placement.
- [ ] NOT: No change to notification data, mark-read behavior, navigation, or push.

## Verify
- `npm run lint` → exits successfully with zero warnings.
- `npm run build` → production build completes successfully.
- regression: open the bell on a ~375px-wide viewport (dev tools device mode); panel does not extend past left/right edges; long lists scroll inside the panel.
- regression: open the bell on desktop width; panel still anchors under the bell (right-aligned).

## Notes
Current panel uses `position: absolute; right: 0` with `width: min(360px, 100vw - 2rem)`, so when the bell is inset from the viewport edge the left side can still breach the screen.
