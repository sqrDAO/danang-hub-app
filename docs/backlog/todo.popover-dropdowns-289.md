# Dropdowns on popover="auto"
**Phase**: — · **Deps**: — · **Issue**: [#289](https://github.com/sqrDAO/danang-hub-app/issues/289)

## Goal
The header user menu, the notification panel and the Login wallet pickers become `popover="auto"` panels, so light dismiss, Esc and one-open-at-a-time come from the browser. Their hand-rolled `document` outside-click listeners and picker Escape handling go away.

## Files
- `src/hooks/useAnchoredPopover.js` (new) — mirrors a popover's native open state into React and places it under its anchor
- `src/components/Header.jsx` (edited) — one `UserMenu` popover, `popovertarget` trigger, outside-click effect removed
- `src/components/Header.css` (edited) — `.user-dropdown` placed in the top layer from the anchor
- `src/components/NotificationBell.jsx` (edited) — panel popover, `popovertarget` trigger, outside-click effect removed
- `src/components/NotificationBell.css` (edited) — `.notification-panel` placed in the top layer; ≤480px pin kept
- `src/pages/auth/Login.jsx` (edited) — wallet pickers as popovers opened after discovery; picker keydown/pointerdown effect removed
- `src/pages/auth/Login.css` (edited) — `.wallet-picker` placed under the wallet row in the top layer

## Acceptance
- [ ] The user menu, notification panel and both wallet pickers carry `popover="auto"`.
- [ ] Each toggle button has `popovertarget` pointing at its panel.
- [ ] A click outside an open panel closes it.
- [ ] Esc closes the user menu.
- [ ] Esc closes the notification panel.
- [ ] Esc closes an open wallet picker.
- [ ] Focus returns to the toggle button after Esc.
- [ ] Opening the bell while the user menu is open leaves only the bell panel open.
- [ ] Opening one wallet picker closes the other.
- [ ] Each toggle's `aria-expanded` follows the native open state, including light dismiss and Esc.
- [ ] The user menu and notification panel open at the same bounding box as on `main` at 1280px and 390px widths.
- [ ] A wallet picker opens 8px under the wallet row at the row's x and width, as on `main`.
- [ ] Esc still clears the wallet error.
- [ ] A second click on the same wallet button closes its picker.
- [ ] NOT: no `mousedown`/`pointerdown` outside-click listener on `document` remains in these three files.
- [ ] NOT: no `eslint-disable` added.

## Verify
- `npm run lint` → exits 0 with no warnings
- `npm test` → 0 failures
- `npm run build` → completes
- `cd functions && npm run lint` → exits 0
- `npm run dev:skipauth`, open `/member` at 1280px and 390px in light and dark → each panel opens where it does on `main`; outside click, Esc and the trigger close it; the bell closes the open user menu
- `npm run dev:skipauth` with auth stubbed signed-out, open `/login` → the pickers open under the wallet row; Esc closes them; Esc clears a wallet error
- regression: user-menu links navigate and close the menu; notification items navigate and close the panel; logout still works

## Notes
- Top-layer popovers ignore their old containing block. `useAnchoredPopover` writes the anchor's viewport rect to `--popover-*` on `beforetoggle` (so the first frame is placed) and on scroll/resize. CSS keeps the offsets. Right-aligned panels use `left` + `translate: -100%`, because the root's `scrollbar-gutter: stable` puts `right` off by the scrollbar width.
- React 18 has no `onToggle` for non-`<details>` elements, so the hook adds the `toggle` listener itself. Panels are always rendered (hidden by the UA `display: none`), so the listener exists before the first open.
- Wallet pickers open after async discovery, so the click handler calls `preventDefault()` and `showPopover({ source })` itself. `popovertarget` stays on the button so light dismiss treats the button as the invoker and a second click can close the picker.
- A picker now overlays the email form instead of pushing it down, so its background is opaque. The wallet error is not a popover, so a `keydown` listener on `document` still clears it on Esc while the error is shown.
