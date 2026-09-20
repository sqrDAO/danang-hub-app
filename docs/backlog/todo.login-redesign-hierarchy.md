# Redesign login page: fit without scroll, clear auth hierarchy
**Phase**: — · **Deps**: —

## Goal
The login page stacked Google, a divider, two full-width wallet buttons, another
divider, and the full email/password form, forcing a scroll on typical viewports.
Condense it to fit without scrolling and make Google sign-in the clear primary
action, email/password secondary, and wallet login tertiary.

## Files
- `src/pages/auth/Login.jsx` (edited) — merged EVM + Solana wallet buttons into
  one compact icon-chip row; moved the sign-up/sign-in mode toggle next to
  "Forgot password?" above the submit button; dropped the separate `AuthFooter`.
- `src/pages/auth/Login.css` (edited) — Google button uses the filled brand
  gradient (primary); email submit uses an outline/secondary treatment; new
  `.wallet-row`/`.wallet-chip` compact styles (44×44 chips); tightened spacing
  (logo, headings, form gaps, input padding) card-wide; `100vh` → `100dvh`;
  `.form-group { margin-bottom: 0 }` to undo double-spacing from `globals.css`;
  height-based tiers (`max-height: 760px`, `640px`, and a narrow+short block
  declared last) that trim ornament on short viewports.
  The card is NOT height-capped — no `max-height`/`overflow-y` (see Notes).

## Acceptance
- [x] Google sign-in button is visually largest/most prominent (filled gradient).
- [x] Email/password submit is visually secondary (outline style).
- [x] EVM + Solana wallet buttons are a single compact icon-chip row, smallest.
- [x] Sign-in and sign-up modes both fit on a 1280×800 viewport without page scroll.
- [x] Mobile viewport (390×750) fits without scroll, with no nested scrollbar
      inside the card.
- [x] Wallet picker and `.auth-error` are both visible on screen when they appear
      at a 1280×640 viewport.
- [x] Wallet chips and inputs meet the project's 44px touch-target floor.
- [x] Sign-up/sign-in mode toggle sits next to "Forgot password?", not in a
      separate footer section.
- [x] Wallet picker dropdowns (multiple EVM/Solana wallets) still render and work.
- [x] Dark and light themes both keep correct contrast and hierarchy.
- [x] NOT: no new color palette — reuses existing `globals.css` tokens only.
- [x] NOT: no change to auth logic, Firebase calls, or validation behavior.

## Verify
- `npm run lint` → zero warnings.
- `npm run build` → succeeds.
- `npm run dev` → `/login`: Google button is largest/filled; email form is
  outline-style; wallet icons are a small two-chip row; sign-up toggle sits
  above the submit button and reads "Already have an account? Sign In" /
  "Don't have an account? Sign Up".
- In DevTools console at 390×750 and 1280×640, in BOTH sign-in and sign-up modes:
  `document.documentElement.scrollHeight <= document.documentElement.clientHeight`
  → `true`. Assert this rather than eyeballing a screenshot.
- At 1280×640 with 2+ injected wallets, click the ETH chip → picker is visible
  without scrolling. Trigger an auth error → `.auth-error` is visible.
- regression: forgot-password flow, wallet connect (single + multi-wallet
  picker), Google sign-in, and email sign-in/sign-up all unchanged in behavior.

## Notes
- An earlier revision capped `.login-card` with `max-height` + `overflow-y: auto`
  as a fallback for the long sign-up form. That caused two bugs: the ≤480px
  breakpoint capped the card but not `.login-container`'s `padding`, so mobile
  kept a page scroll *plus* a nested one; and the wallet picker / `.auth-error`
  could land outside the card's scroll viewport, so clicks appeared to do nothing.
  Both were removed rather than patched. If a very short viewport ever needs
  attention, reduce spacing — do not reintroduce a height cap.
- Screenshots cannot distinguish a page scroll from a nested card scroll, and
  cannot capture post-click state. Verify with the console assertion above.
- Measured headless at 1280×800 / 1280×640 / 390×750 / 360×640 × light+dark ×
  signin+signup: 16/16 zero page overflow, zero nested card overflow. Picker
  measured in-viewport at all three short widths with two injected EIP-6963
  wallets. Hierarchy check: Google area > email > wallet chip at every size.
