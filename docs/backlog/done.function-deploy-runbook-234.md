# Document new callable deployment recovery
**Phase**: — · **Deps**: —

## Goal
Resolve [#234](https://github.com/sqrDAO/danang-hub-app/issues/234) using the documented manual-owner option.
Make the first-deploy invoker step visible before merge and explain how to unblock Hosting.

## Files
- `README.md` (edited) — callable invoker failure, owner recovery and verification.
- `.github/pull_request_template.md` (new) — new-function checklist and owner coordination.

## Acceptance
- [ ] README explains why a failed Functions deploy skips Hosting.
- [ ] Recovery targets the affected service in danang-hub-app / us-central1.
- [ ] Public invocation guidance applies only to intended public HTTP/callable endpoints.
- [ ] Recovery requires rerunning the failed merge workflow.
- [ ] Recovery includes production deployment and application verification.
- [ ] PR template flags added Cloud Functions before merge.
- [ ] NOT: modify IAM policies, deploy services or expand CI permissions.
- [ ] NOT: make event-driven or intentionally private functions public.

## Verify
- `git diff --check` → passes.
- `npm run lint` → passes.
- `npm test` → passes.
- `npm run build` → passes.
- `npm --prefix functions run lint` → passes.
- Review README against `.github/workflows/firebase-hosting-merge.yml` deployment order.
- Check invoker role and permission against linked Google Cloud documentation.

## Notes
This is the issue's manual-recovery option; first deployment still needs an owner.
No IAM or deployment command in the runbook is executed as part of this documentation change.
