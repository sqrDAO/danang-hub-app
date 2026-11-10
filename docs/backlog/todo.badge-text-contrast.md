# Readable green and amber badge text in light theme
**Phase**: — · **Deps**: —

## Goal
In light theme, green and amber status text measures 1.6–3.3:1 against its tinted badge, below
the WCAG AA 4.5:1 for small text (#167). Darken the light-theme tokens once, so every badge
that uses them passes on white cards and on the admin glass panels.

## Files
- `src/styles/globals.css` (edited) — light `--color-success`, `--color-warning`, `--color-info`; light checked-in badge text
- `src/components/BookingCard.css` (edited) — drop the light `.btn-pass` override (lighter than the new token)
- `src/pages/admin/Amenities.css` (edited) — light text color for `.availability-badge.available`
- `src/components/NotificationBell.css` (edited) — light pending dot color

## Acceptance
- [ ] Light `--color-success` is `#166534` (Completed, event Approved, Entry pass, sign-in success).
- [ ] Light `--color-warning` is `#92400e` (Pending badges, admin pending banner).
- [ ] Light `--color-info` is `#8f5200` (booking Approved badge).
- [ ] Light `--color-info-bg` is a 25% orange tint, so Approved and Pending badges differ by background.
- [ ] The light pending notification dot is `#ea580c`, at least 3:1 on the white panel.
- [ ] The light pending and approved dots differ by at least 2:1.
- [ ] The light Checked-in badge uses `--text-primary` text.
- [ ] The light admin Amenities "Available" badge uses `#8f5200` text.
- [ ] Each changed text color measures ≥ 4.5:1 on its tint over white.
- [ ] Each changed text color measures ≥ 4.5:1 on its tint over the admin panel.
- [ ] NOT: any dark-theme value changes.
- [ ] NOT: badge tints or borders change, other than the Approved one.
- [ ] NOT: red badges or `--color-error` (separate issue).
- [ ] NOT: the Events pages' duplicate `.status-badge.approved` rules (separate issue).

## Verify
- `npm run lint && npm run build` → green
- `npm test` → all pass
- `npm run dev`, light theme → My Bookings, admin Bookings, member/admin Events, Amenities, sign-in: badges darker, still green/amber
- dark theme → badges unchanged
- regression: toasts (use `--color-*-dark`) unchanged

## Notes
Ratios (text on tint over white / over admin panel, 3% black on cream): today green 2.90/2.50,
amber 2.94/2.55, brand-orange Approved 1.85/1.59, Checked-in 3.12/2.69. New: `#166534`
6.27/5.40, `#92400e` 6.55/5.68, `#8f5200` 5.80/4.99, `#231F20` ~15. The issue's `#15803d`
still fails (4.41/3.80) once the tint is counted.

`--color-info` in light also colors the pending-notification dot (`NotificationBell.css`);
it turns dark amber. `--color-success-dark`/`--color-warning-dark` stay: toasts use them and pass.

**Review follow-up:** darker text made Pending (`#92400e`) and Approved (`#8f5200`) converge. At 4.5:1
a more orange text only moves closer to Pending's rust, so the tint carries the difference:
Approved tint 10% → 25% (ΔE vs Pending's tint 3.8 → 10.8), text 5.21 on white / 4.59 on panel.
