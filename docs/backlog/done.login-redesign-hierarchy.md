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
  `.wallet-row`/`.wallet-chip` compact styles; tightened spacing (logo, headings,
  form gaps, input padding) card-wide; `.login-card` gets `max-height` + internal
  scroll as a fallback for the longest (sign-up) variant; `100vh` → `100dvh`.
- `src/locales/vi.json` (edited) — `emailPlaceholder` `"ban@email.com"` →
  `"you@email.com"` to match the English placeholder format.

## Acceptance
- [x] Google sign-in button is visually largest/most prominent (filled gradient).
- [x] Email/password submit is visually secondary (outline style).
- [x] EVM + Solana wallet buttons are a single compact icon-chip row, smallest.
- [x] Sign-in and sign-up modes both fit on a 1280×800 viewport without page scroll.
- [x] Mobile viewport (390×750) fits without scroll.
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
  above the submit button. Toggle to sign-up, confirm 4-field form still fits
  the card without page scroll (card scrolls internally at short viewports).
- regression: forgot-password flow, wallet connect (single + multi-wallet
  picker), Google sign-in, and email sign-in/sign-up all unchanged in behavior.

## Notes
- Verified visually via Playwright screenshots at desktop (1280×800), a short
  viewport (1280×640), and mobile (390×750), in both light/dark themes and
  both sign-in/sign-up modes.
