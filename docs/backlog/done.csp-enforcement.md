# Enforce the Hosting Content Security Policy
**Phase**: — · **Deps**: csp-report-only · **Issue**: [#196](https://github.com/sqrDAO/danang-hub-app/issues/196)

## Goal
Promote the existing report-only policy to enforcement on a review preview.
Keep production rollout gated on real authentication, upload and push verification.

## Files
- `firebase.json` (edited) — enforcing header, including import CDNs from #247
- `docs/knowledge/csp-rollout.md` (new) — verification matrix and rollback

## Acceptance
- [ ] Hosting serves an enforcing CSP on documents and the service worker.
- [ ] Inline scripts and eval remain forbidden.
- [ ] Luma, Meetup and Eventbrite cover fetches have exact allowed origins.
- [ ] Real email, Google, EVM and Solana sign-in succeed on the preview.
- [ ] Booking, event/banner, avatar, push and installed-PWA flows pass.
- [ ] NOT: production deployment before the verification matrix is complete.
- [ ] NOT: claim #196 complete before production enforcement is verified.

## Verify
- `npm run lint` → passes.
- `npm --prefix functions run lint` → passes.
- `npm test` → passes.
- `npm run build` → production assets generated.
- Follow `docs/knowledge/csp-rollout.md` on the Firebase preview, then production.

## Notes
- Keep the PR draft until authenticated flow evidence is recorded.
- No nonce, Trusted Types or reporting collector expansion in this rollout.
