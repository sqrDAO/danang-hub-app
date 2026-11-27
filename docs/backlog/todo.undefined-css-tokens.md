# Fix undefined CSS tokens
**Phase**: — · **Deps**: — · **Issue**: [#310](https://github.com/sqrDAO/danang-hub-app/issues/310)

## Goal
Three CSS custom properties are used in `src/` but never defined, so every declaration using them is dropped and the property falls back to its initial value. Most visibly, the amenity photo lightbox stacks Previous and Next in the middle of the photo on phones; define or replace each token so the rules apply again.

## Files
- `src/styles/globals.css` (edited) — add `--spacing-xs: 0.25rem` to the spacing scale in `:root`
- `src/pages/Home.css` (edited) — `var(--radius-lg)` → `var(--border-radius)` on the amenity preview card and CTA box
- `src/components/Footer.css` (edited) — drop the `background: var(--bg-tertiary)` line from `.footer-social-link:hover`

## Acceptance
- [ ] `--spacing-xs` is defined as `0.25rem` in `:root`, next to `--spacing-sm`.
- [ ] At 390×844, the lightbox Previous button sits `0.25rem` from the left edge of the overlay content and Next sits `0.25rem` from the right.
- [ ] Lightbox thumbnails have a `0.25rem` gap.
- [ ] Home amenity preview cards and the CTA box have a 12px border radius.
- [ ] A footer social link keeps its `--bg-secondary` background on hover.
- [ ] Every `var(--name)` in `src/**/*.css` resolves to a token declared in CSS or set inline from JSX.
- [ ] NOT: new `--radius-*` or `--bg-tertiary` tokens.
- [ ] NOT: the desktop Previous/Next button positions change.

## Verify
- `npm run lint && npm run build && npm test` → all green
- Compare every `var(--…)` name in `src/` with every `--…:` declaration plus the inline `style={{ '--…' }}` names in JSX → no names left over
- `npm run dev:skipauth`, open an amenity's photos at 390×844 → Previous and Next sit at the edges and the thumbnails are spaced; at 1280 they are unchanged
- regression: Home page cards and the footer in both themes; the 0.25rem spacing that now applies in the calendar (`src/components/UnifiedCalendar.css`), Profile (`src/pages/member/Profile.css`) and Admin Amenities (`src/pages/admin/Amenities.css`) at 390 and 1280

## Notes
`--radius-lg` and `--bg-tertiary` are each used in at most two rules, so they point at existing tokens instead of adding new ones. The hover background was effectively transparent before this change, because an undefined `var()` makes the declaration act as `unset`. The orange icon and border already signal hover.
