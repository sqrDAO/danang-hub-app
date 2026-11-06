# Use the sqrDES body font in Vietnamese
**Phase**: — · **Deps**: —

## Goal
In Vietnamese the app switches to Be Vietnam Pro at 80% size, while sqrDES
`danang-hub/DESIGN.md` v1.2.0 makes Helvetica Neue the only body font (#158). Drop the
Vietnamese override so both languages share one font and size, and stop loading the
Google Fonts stylesheet that only served it.

## Files
- `src/styles/globals.css` (edited) — delete the `html[lang="vi"] body` rule and the `--font-main-vi` variable
- `index.html` (edited) — delete the Be Vietnam Pro stylesheet link and the `fonts.googleapis.com` / `fonts.gstatic.com` preconnects

## Acceptance
- [ ] With the app in Vietnamese, body text renders in the `--font-main` stack (Helvetica Neue first).
- [ ] With the app in Vietnamese, body text is the same size as in English.
- [ ] `index.html` makes no request to `fonts.googleapis.com`.
- [ ] `index.html` makes no request to `fonts.gstatic.com`.
- [ ] `Be Vietnam Pro` appears nowhere in `src/` or `index.html`.
- [ ] NOT: no change to `--font-main` or the English font stack.
- [ ] NOT: no change to the Wolgen display font.
- [ ] NOT: no change to the Google Fonts cache rules in `public/sw.js` (unused but harmless).

## Verify
- `npm run lint && npm run build` → green
- `npm test` → all pass
- `grep -rn "Be Vietnam\|font-main-vi\|fonts.g" src index.html` → no matches
- `npm run dev`, switch to Vietnamese → DevTools Network shows no `fonts.googleapis.com` request; computed `font-family` on `body` starts with `"Helvetica Neue"`; root font size matches English
- font coverage: with `fonttools`, check every non-ASCII character in `src/locales/vi.json` against the `cmap` of Windows `arial.ttf`, `arialbd.ttf`, `ariali.ttf` → only ✅ ✓ 📅 missing (emoji font draws those in English too)
- `src/locales/vi.json` strings are all NFC (precomposed letters, no combining marks)
- optional human: glance at a Vietnamese page on an iPhone or Mac → no letter looks out of place
- regression: entry pass (`BookingPass`, pinned `lang="vi"`) still renders as before

## Notes
- Helvetica Neue is a system font, not self-hosted: Apple devices use it, others fall
  back to Arial / Roboto via the stack. Browsers pick a font per character, so a font's
  `cmap` predicts the render: Windows Arial is proven above, Roboto ships with
  Vietnamese, and a gap in Apple's Helvetica Neue would fall back to the near-identical
  system font, so it is cosmetic at worst.
- The 80% size was tuned for Be Vietnam Pro's wider letters. It goes away with the font,
  so Vietnamese screens get about 25% larger text. That is intended (decided on #158).
