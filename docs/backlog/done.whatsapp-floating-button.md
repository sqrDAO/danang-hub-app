# WhatsApp floating button
**Phase**: — · **Deps**: — · **Issue**: [#280](https://github.com/sqrDAO/danang-hub-app/issues/280)

## Goal
Show the landing site's WhatsApp floating button (`https://wa.me/84865311291`) in the portal, stacked above the existing Telegram button, so members and people signing in can reach the Hub team in one tap. Look and behavior match `danang-hub-landing` (`src/style.css` `.wa-float`, `src/template.html`).

## Files
- `src/components/WhatsAppFloat.jsx` (new) — plain `<a>` link with the landing site's icon and a translated aria-label
- `src/components/WhatsAppFloat.css` (new) — position, size, colors, hover, focus ring, mobile offset
- `src/components/Layout.jsx` (edited) — render it next to the Telegram button, under the same `hideChatbot` flag
- `src/components/Layout.css` (edited) — hide both floating buttons while the mobile drawer is open
- `src/App.jsx` (edited) — render it on `/login` (no Telegram button there, so it takes the base slot)
- `src/styles/globals.css` (edited) — `--wa-float-bg` / `--wa-float-icon` tokens
- `src/locales/en.json`, `src/locales/vi.json` (edited) — `common.whatsappChat`

## Acceptance
- [ ] The link points to `https://wa.me/84865311291` with no prefilled text.
- [ ] The link opens in a new tab with `rel="noopener noreferrer"`.
- [ ] The button is a 56px circle, background `#25D366`, white icon, `z-index: 9999`.
- [ ] On desktop it sits 68px above the Telegram button, both 1.75rem from the right.
- [ ] At ≤ 768px it is 48px and sits 60px above the Telegram button, which stays above the bottom nav.
- [ ] Its bottom offset includes `env(safe-area-inset-bottom)`.
- [ ] Hover scales it to 1.08 with a deeper shadow; the scale is skipped under `prefers-reduced-motion: reduce`.
- [ ] Keyboard focus shows a visible ring (`:focus-visible`).
- [ ] The aria-label reads "Chat with us on WhatsApp" in EN and its Vietnamese translation in VI.
- [ ] It is hidden whenever the Telegram button is hidden (`hideChatbot`: member booking modal, booking pass).
- [ ] Both floating buttons hide while the mobile nav drawer is open (they covered its Dark mode / Admin View buttons).
- [ ] On `/login` it shows in the Telegram button's base slot.
- [ ] Colors come from tokens in `src/styles/globals.css`, the same in both themes.
- [ ] NOT: JavaScript click handlers or prefilled message text.
- [ ] NOT: changes to the Telegram button's look or position.

## Verify
- `npm run lint` → no errors or warnings.
- `npm run build` → production build succeeds.
- `npm test` → no new failures (`test/mcp.test.js` and the stalled-SMTP test also fail on `main` with symlinked functions deps).
- `VITE_FIREBASE_API_KEY=fixture-key VITE_FIREBASE_AUTH_DOMAIN=demo-danang.firebaseapp.com VITE_FIREBASE_PROJECT_ID=demo-danang VITE_FIREBASE_STORAGE_BUCKET=demo-danang.appspot.com VITE_FIREBASE_MESSAGING_SENDER_ID=123456789 VITE_FIREBASE_APP_ID=fixture-app npm run dev:skipauth -- --host 127.0.0.1 --port 3019` → fixture app runs.
- Manual: `/`, `/member`, `/login` at desktop and 390px, light and dark: button visible above Telegram, not over the bottom nav.
- Manual: open the member booking modal → both floating buttons hide.
- Manual: at 390px open the hamburger drawer → both floating buttons hide; close it → they return.
- Manual: Tab to the button → focus ring; Enter opens WhatsApp in a new tab.
- regression: Telegram button position and hide behavior unchanged.
