# Mobile PWA — Gallery & Touch UX Fixes
**Phase**: — · **Deps**: —

## Goal
Fix photo gallery navigation on mobile (no swipe support) and close the most impactful mobile UX gaps: iOS auto-zoom on form fields, double-tap delay on buttons, and dynamic viewport height in the lightbox.

## Files
- `src/components/AmenityPhotoLightbox.jsx` (edited) — add touch swipe (left/right) to navigate photos
- `src/components/AmenityPhotoLightbox.css` (edited) — `100dvh` for dynamic viewport, `touch-action: pan-y` on image
- `src/styles/globals.css` (edited) — `font-size: 16px` on `.form-field` (iOS zoom), `touch-action: manipulation` on `.btn`

## Acceptance
- [ ] Swipe left/right in the lightbox navigates to next/previous photo
- [ ] Tapping a form field on iOS does not zoom the page
- [ ] Buttons activate on first tap without double-tap zoom delay
- [ ] Lightbox content height adjusts when mobile browser toolbar shows/hides
- [ ] NOT: swipe on inline amenity card preview (lightbox only)
- [ ] NOT: admin pages changed

## Verify
- `npm run lint` → no new warnings
- `npm run build` → clean
- DevTools mobile emulator: My Bookings → tap photo → swipe left/right confirms navigation
- Profile page: tap a text input → page does not zoom
- Tap any `.btn` → activates immediately (no 300ms delay)
