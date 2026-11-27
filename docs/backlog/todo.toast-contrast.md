# Readable toast text in both themes
**Phase**: — · **Deps**: — · **Issue**: [#311](https://github.com/sqrDAO/danang-hub-app/issues/311)

## Goal
Toasts are a near-white card in both themes, but their text uses theme tokens meant for the page background. That makes light-theme info text and the close button cream on white (≈1.1:1), and dark-theme success, warning and error text bright-on-white (2.1–4.4:1). Give toast text fixed dark colors that pass WCAG AA on the white card in both themes.

## Files
- `src/styles/globals.css` (edited) — `--toast-success-text`, `--toast-error-text`, `--toast-warning-text` in `:root`, identical in both themes
- `src/components/Toast.css` (edited) — info text and close button use `--text-primary-light`; success, error and warning text use the new tokens

## Acceptance
- [ ] Info toast text has contrast ≥ 4.5:1 against the toast background in the light theme.
- [ ] Info toast text has contrast ≥ 4.5:1 against the toast background in the dark theme.
- [ ] Success, error and warning toast text each have contrast ≥ 4.5:1 in the light theme.
- [ ] Success, error and warning toast text each have contrast ≥ 4.5:1 in the dark theme.
- [ ] The close button (at its 0.6 resting opacity) has contrast ≥ 3:1 in both themes.
- [ ] Light-theme success, error and warning text keep their current colors.
- [ ] NOT: changes to the toast background, borders, layout or animation.
- [ ] NOT: changes to the page-wide `--color-*` status tokens.

## Verify
- `npm run lint && npm run build && npm test` → all green (`test/mcp.test.js` already fails on `main` in this environment with a socket timeout)
- Headless Chromium page that loads `globals.css` and `Toast.css`, renders all four toast types in each theme, and computes contrast from the computed colors → every value meets the thresholds above
- `npm run dev:skipauth`, switch to light, trigger an info toast (Copy emails in an event's registrants list) → text is dark and readable
- regression: success and error toasts after a booking action, in both themes

## Notes
The new tokens take the light theme's existing values (`--color-success-dark` #15803d, `--color-error-darker` #991b1b, `--color-warning-darker` #92400e), so the light theme looks unchanged and only dark-theme status text gets deeper. `--text-primary-light` is #231F20 in `:root`, and the light theme does not override it.
