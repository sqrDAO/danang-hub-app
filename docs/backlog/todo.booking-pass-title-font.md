# Booking pass: "Booking confirmation" title, app font
**Phase**: — · **Deps**: —

## Goal
The pass panel's title reads "Entry pass" / "Thẻ vào cửa", but the panel is the member's booking confirmation; rename it. The pass forces `--font-main` (Helvetica Neue), which Windows lacks, so it falls back to Arial and stacked Vietnamese diacritics (ặ, ễ) render cramped; the pass should use the app's font like everything around it.

## Files
- `src/locales/en.json` (edited) — `bookingPass.title` → "Booking confirmation"
- `src/locales/vi.json` (edited) — `bookingPass.title` → "Xác nhận đặt chỗ"
- `src/components/BookingPass.jsx` (edited) — comment recording the title as a product decision
- `src/components/BookingPass.css` (edited) — title and card inherit the app font; header comment

## Acceptance
- [ ] The pass panel title reads "Xác nhận đặt chỗ" with the app in Vietnamese
- [ ] The pass panel title reads "Booking confirmation" with the app in English
- [ ] With the app in Vietnamese, the title, card text and hint render in Be Vietnam Pro (`--font-main-vi`)
- [ ] With the app in English, the title and card text render in the `--font-main` stack
- [ ] The pass title does not render in Wolgen
- [ ] The card date still renders in Wolgen
- [ ] NOT: changes to `bookingPass.show` (the "Entry pass" / "Thẻ vào" pill)
- [ ] NOT: changes to the Wolgen heading rule for other modals

## Verify
- `npm run lint && npm run build && npm test` → green
- `npm run dev`, app in Vietnamese, open the pass from today's approved booking → title "Xác nhận đặt chỗ"; DevTools → Computed → Rendered Fonts on the title, guest name and hint shows Be Vietnam Pro
- same with the app in English → title "Booking confirmation"; title and guest name show Helvetica Neue (macOS/iOS) or Arial (Windows)
- regression: the date `DD/MM/YYYY` on the card still renders in Wolgen

## Notes
- Product decision: the hub has no authority to issue entry tickets to the building, only to confirm a booking, hence the title. The opening button keeps "Entry pass" / "Thẻ vào" for convenience.
- The title is the Modal's `<h3>`, which `globals.css` sets to Wolgen (`h1…h6`), and Wolgen lacks đ ư ơ ă and stacked marks. So the title needs `font-family: inherit`, not just removing the override.
- `font-family` inherits by default, so `.booking-pass` only drops its own declaration.
