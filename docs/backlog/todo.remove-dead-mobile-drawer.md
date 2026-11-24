# Remove the unreachable mobile nav drawer
**Phase**: — · **Deps**: — · **Issue**: #287

## Goal
The hamburger that opens the mobile drawer is `display: none` for every user at every width.
ae9e034 ("Option D") stopped showing it on purpose, so the drawer can never open. Delete
the drawer instead of converting it to `<dialog>` as #287 proposed. Today its off-screen
buttons still sit in the phone tab order and accessibility tree, duplicating the header's
language, theme and Login controls.

## Files
- `src/components/Header.jsx` (edited) — remove `MobileNav`, `MobileNavFooter`, `MobileUserInfo`, `MobileAuthAction`, `GlobeIcon`, `getMobileProfilePath`, the hamburger button, the overlay div, `isMobileMenuOpen` state, `toggleMobileMenu`, `closeMobileMenu` and every call to it
- `src/components/Header.css` (edited) — remove `.mobile-menu-toggle`, `.hamburger*`, `.mobile-nav*`, `.mobile-user-*`, `.mobile-footer-*`, `.btn-full-width` (Home and member Events define their own) and their ≤768px rules
- `src/components/Layout.css` (edited) — remove the `.layout:has(.mobile-nav.open)` rule

## Acceptance
- [ ] `grep -rnE "mobile-nav|mobile-menu|hamburger|mobile-user|mobile-footer|MobileMenu" src` returns nothing
- [ ] At 390px logged out on `/`, Tab from the logo reaches only visible header controls (no off-screen drawer buttons)
- [ ] At every width in the verify matrix, the header looks the same as on `origin/main`
- [ ] The desktop nav links (Home, Amenities, Events; member and admin links) still work and highlight the active item
- [ ] Tapping the logo still goes to `/`
- [ ] Logout from the user menu still works
- [ ] NOT: no change to the logged-out phone header (language, theme, round Login icon)
- [ ] NOT: no new navigation for logged-out phone visitors (separate product question)
- [ ] NOT: `<dialog>` conversion from #287 is not implemented

## Verify
- `npm run lint` → exit 0
- `npm run build` → exit 0
- `npm test` → only the 2 failures already on `origin/main` (SMTP stall retry, `mcp.test.js`)
- `npm run dev`, then at 360/390/768/769/1024/1440 widths, logged out on `/` and `/login`, logged in on `/`, `/member`, `/admin` → header identical to `origin/main` screenshots
- regression: at 390px, Home's "Book" buttons and member Events' full-width buttons still span the card width (`.btn-full-width`)

## Notes
- Closing #287: the PR closes it as "obsolete — drawer was unreachable; removed instead".
