# Native shared modal

## Goal
Resolve [#195](https://github.com/sqrDAO/danang-hub-app/issues/195) with native modal focus, inert background and Escape dismissal while preserving callers and form unmounting.

## Files
- `src/components/Modal.jsx` — native dialog lifecycle and dismissal.
- `src/components/Modal.css` — backdrop, sizing and reduced motion.

## Acceptance
- [ ] Keyboard focus stays in the topmost modal and returns to the opener.
- [ ] Escape, close button and backdrop dismiss through onClose.
- [ ] Forms unmount on close and stacked dialogs remain independent.
- [ ] Desktop/mobile layouts and light/dark themes render correctly.

## Verify
- Run app lint, build, unit tests and Functions lint.
- Browser-check open, Tab, Escape, backdrop, form submission and stacked modals.
- Check mobile dimensions and reduced-motion behavior.

## Results
- Chrome harness using the actual Modal under React StrictMode passed stacking, Tab containment, Escape, opener focus restoration, backdrop dismissal and Enter submission.
- Mobile light/dark sizing and reduced-motion checks passed.
- Repeated checks with closedBy removed exercised the pointer fallback.
- Shared-component checks cover the lifecycle; authenticated application callers and Safari remain unverified.
- Existing suite reports 298 passes and 8 emulator-dependent skips.
