# Login page redesign — shorter page, clearer auth hierarchy
**Phase**: — · **Deps**: —

## Goal
The `/login` page stacks to ~850px and scrolls on common laptop viewports, almost entirely from oversized spacing tokens. Tighten the spacing and re-rank the three auth methods so Google is primary, email/password secondary, and wallet tertiary.

## Files
- `src/pages/auth/Login.css` (edited) — spacing pass, button hierarchy, wallet grid, dead-CSS removal
- `src/pages/auth/Login.jsx` (edited) — reorder blocks, swap button classes, wrap wallet buttons in a grid
- `src/locales/en.json` (edited) — short wallet labels, divider rewording, new `auth.orSignUpWithEmail`
- `src/locales/vi.json` (edited) — same keys

## Acceptance
- [ ] Sign-in view fits a 1280×800 viewport with no vertical scrollbar
- [ ] Google button renders with the `.btn-primary` orange gradient
- [ ] Email submit button renders as an outline button, not the gradient
- [ ] Ethereum and Solana render side by side in a 2-column grid at 40px tall
- [ ] Wallet buttons stack to one column below 480px
- [ ] Block order top-to-bottom is Google → email form → wallet
- [ ] Wallet section is hidden in sign-up mode (wallet always auto-creates a profile)
- [ ] Divider wording: "continue" for Google/wallet (auto-create), "sign in"/"sign up" for email
- [ ] Email divider reads "sign up with email" while in sign-up mode
- [ ] Switching modes closes any open wallet picker
- [ ] Wallet picker closes via: second click on the same button, Escape, or a click outside
- [ ] Opening one wallet picker closes the other
- [ ] Sign-up mode (`/login?signup=true`) renders all 4 fields without layout break
- [ ] Forgot-password view still renders correctly
- [ ] Both light and dark themes render correctly
- [ ] `.signup-features` and `.password-strength` dead CSS blocks are removed
- [ ] NOT: no changes to sign-in/sign-up auth logic or `src/services/` (the only `useWalletLogin` change is a `closeWalletPickers` reset, required because hiding wallet in sign-up mode otherwise strands picker state)
- [ ] NOT: no edits to `src/styles/globals.css`
- [ ] NOT: no collapsible/disclosure mechanism added

## Verify
- `npm run lint` → clean, zero warnings
- `npm run build` → succeeds
- `npm test` → passes
- `npm run dev` → `http://localhost:3000/login` at 1280×800: no scrollbar; toggle theme; narrow below 480px; click Sign Up; click Forgot password
- regression: after visiting `/login`, open `/profile` and an admin page with forms — confirm field spacing is unchanged (the reset is scoped to `.login-card`, but this stylesheet outlives the page)
- open a wallet picker, toggle to sign-up and back — the picker must be closed
- with a picker open, try each dismissal: same button again, Escape, click outside (needs 2+ wallet extensions installed to trigger the picker at all)

## Notes
- `Login.css` is imported only by `Login.jsx`, which holds all three screens (sign-in, sign-up, forgot-password). There is no separate Register page.
- `Login.css` styles bare unscoped selectors (`.form-group`, `.form-group input`, `.auth-error`, `.auth-link`…). The page is lazy-loaded but its stylesheet persists after navigation, so these leak app-wide within a session. The `margin-bottom: 0` reset is therefore scoped as `.login-card .form-group` — unscoped it would collapse field spacing on the 7 other pages that use `.form-group` and rely on the global margin.
- Wording follows the auth mechanics: Google and wallet auto-create a profile on first use (`AuthContext.createUserProfile`), so they say "continue"; only email/password has a real registration step, so it says "sign in" / "sign up".
- `.form-group` is double-spaced today: `.login-form { gap: 1rem }` plus an un-reset `margin-bottom: 1rem` from `globals.css:393`.
- `--spacing-xs` is referenced at `Login.css:117` but never defined in `globals.css` — that declaration is silently invalid and gets a literal value.
