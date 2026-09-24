# Login page redesign — shorter page, clearer auth hierarchy
**Phase**: — · **Deps**: —

## Goal
The `/login` page stacks to ~850px and scrolls on common laptop viewports, almost entirely from oversized spacing tokens. Tighten the spacing, drop the subtitle and the sign-up name field, and re-rank the auth methods so Google is primary with wallet and email below it. Wallet errors render in place of the wallet buttons instead of at the top of the card.

## Files
- `src/pages/auth/Login.css` (edited) — spacing pass, button hierarchy, wallet grid, wallet error box, dead-CSS removal
- `src/pages/auth/Login.jsx` (edited) — reorder blocks, swap button classes, wrap wallet buttons in a grid, separate `walletError` state, remove subtitle and Full Name field
- `src/contexts/AuthContext.jsx` (edited) — `signUpWithEmail(email, password)` no longer takes or sets a display name
- `src/locales/en.json` (edited) — short wallet labels, divider keys renamed to match wording (`orContinueWithWallet`, `orSignInWithEmail`), new `auth.orSignUpWithEmail`, new `auth.dismissWalletError`; removes `loginSubtitle`, `signupSubtitle`, `fullName`, `fullNamePlaceholder`, `errors.displayNameRequired`
- `src/locales/vi.json` (edited) — same keys; neutral `emailPlaceholder`

## Acceptance
- [ ] Sign-in view fits a 1280×800 viewport with no vertical scrollbar
- [ ] Google button renders with the `.btn-primary` orange gradient
- [ ] Email submit button renders as an outline button, not the gradient
- [ ] Ethereum and Solana render side by side in a 2-column grid at 40px tall
- [ ] Wallet buttons stack to one column below 480px
- [ ] Block order top-to-bottom is Google → wallet → email form
- [ ] Wallet section renders in both sign-in and sign-up modes
- [ ] No subtitle under the sign-in / sign-up title
- [ ] Forgot-password view keeps its subtitle
- [ ] Sign-up form has no Full Name field
- [ ] A new email account is created with an empty `displayName` and is redirected to its profile page to complete it
- [ ] Divider wording: "continue" for Google/wallet (auto-create), "sign in"/"sign up" for email
- [ ] Email divider reads "sign up with email" while in sign-up mode
- [ ] Switching modes closes any open wallet picker
- [ ] Wallet picker closes via: second click on the same button, Escape, or a click outside
- [ ] Opening one wallet picker closes the other
- [ ] Wallet errors render in a box that replaces the wallet button row
- [ ] Wallet errors no longer render in the top-of-card `.auth-error`
- [ ] Google and email errors still render in the top-of-card `.auth-error`
- [ ] Clicking the wallet error box dismisses it and restores the wallet buttons
- [ ] Escape dismisses the wallet error box
- [ ] Switching modes clears the wallet error
- [ ] The longest wallet error (`noSolanaWallet`) wraps inside the box without overlapping the footer, in en and vi
- [ ] Wallet error box is announced by screen readers (`role="alert"`) and keyboard-dismissable (it is a `<button>`)
- [ ] Sign-up mode (`/login?signup=true`) renders its 3 fields without layout break
- [ ] Sign-up view fits a 1280×800 viewport with no vertical scrollbar
- [ ] Forgot-password view still renders correctly
- [ ] Both light and dark themes render correctly
- [ ] `.signup-features` and `.password-strength` dead CSS blocks are removed
- [ ] NOT: no changes to `src/services/` or to sign-in logic (`useWalletLogin` changes are UI state only; the only auth change is dropping the sign-up display name)
- [ ] NOT: no edits to `src/styles/globals.css`
- [ ] NOT: no collapsible/disclosure mechanism added

## Verify
- `npm run lint` → clean, zero warnings
- `npm run build` → succeeds
- `npm test` → passes
- `npm run dev` → `http://localhost:3000/login` at 1280×800: no scrollbar in sign-in or sign-up; toggle theme; narrow below 480px; click Forgot password
- sign up with a new email (emulators) → lands on `/member/profile` with Name required
- regression: after visiting `/login`, open `/profile` and an admin page with forms — confirm field spacing is unchanged (the reset is scoped to `.login-card`, but this stylesheet outlives the page)
- open a wallet picker, toggle to sign-up and back — the picker must be closed
- with a picker open, try each dismissal: same button again, Escape, click outside (needs 2+ wallet extensions installed to trigger the picker at all)
- in an incognito window (wallet extensions off), click Ethereum then Solana → error box replaces the wallet row; click it and press Escape to dismiss; repeat in vi, dark theme, and below 480px

## Notes
- `Login.css` is imported only by `Login.jsx`, which holds all three screens (sign-in, sign-up, forgot-password). There is no separate Register page.
- `Login.css` styles bare unscoped selectors (`.form-group`, `.form-group input`, `.auth-error`, `.auth-link`…). The page is lazy-loaded but its stylesheet persists after navigation, so these leak app-wide within a session. The `margin-bottom: 0` reset is therefore scoped as `.login-card .form-group` — unscoped it would collapse field spacing on the 7 other pages that use `.form-group` and rely on the global margin.
- Wording follows the auth mechanics: Google and wallet auto-create a profile on first use (`AuthContext.createUserProfile`), so they say "continue"; only email/password has a real registration step, so it says "sign in" / "sign up".
- `.form-group` is double-spaced today: `.login-form { gap: 1rem }` plus an un-reset `margin-bottom: 1rem` from `globals.css:393`.
- `--spacing-xs` is referenced at `Login.css:117` but never defined in `globals.css` — that declaration is silently invalid and gets a literal value.
- `.login-card` vertical padding is `--spacing-md`: with `--spacing-lg` all round the sign-in page measured 802px on the Deploy Preview, 2px over the 800px budget.
- Wallet shows in sign-up mode because most logged-out CTAs (Home "Get started"/"Sign up", Events register, Amenities booking, `AuthPrompt`) link to `?signup=true`; hiding it there left web3 users without a visible wallet option.
- The Full Name field is redundant: `isProfileComplete` (`AuthContext.jsx`) already requires name + company + job title, so every new email user is sent to the profile page, where Name is a required field. Google and wallet sign-ups already take this path.
