# App version
**Phase**: — · **Deps**: —

## Goal
Give the app a real version so a deployed build can be identified. Show it in the footer and tag each released version in git.

## Files
- `package.json`, `package-lock.json` (edited) — `version` 0.0.0 → 1.0.0
- `vite.config.js` (edited) — `define` `__APP_VERSION__`, `__APP_COMMIT__`, `__APP_BUILT_AT__`
- `src/utils/appVersion.js` (new) — build info with node-safe fallbacks; `appVersionLabel`
- `src/components/Footer.jsx`, `src/components/Footer.css` (edited) — version line under the copyright
- `src/locales/en.json`, `src/locales/vi.json` (edited) — `footer.version`, `footer.builtAt`
- `.github/workflows/firebase-hosting-merge.yml` (edited) — `tag_release` job after deploy
- `test/appVersion.test.js` (new) — fallback and label
- `CHANGELOG.md` (new) — v1.0.0 release notes (#115–#123 and this change)
- `README.md`, `CLAUDE.md` (edited) — release steps

## Acceptance
- [ ] The footer shows `v1.0.0 (<7-char commit>)` on every page
- [ ] Hovering the version shows the build time
- [ ] CI builds take the commit from `GITHUB_SHA`
- [ ] Local builds take the commit from git, or `dev` without git
- [ ] After deploy, `tag_release` pushes `v<version>` on the merge commit when that tag is new
- [ ] A merge that does not bump the version adds no tag and does not fail
- [ ] A new tag is published as a GitHub release with the version's `CHANGELOG.md` section as notes
- [ ] NOT: no version bump automation; bumps are a deliberate edit in a PR
- [ ] NOT: Cloud Functions are not versioned

## Verify
- `npm run lint && npm run build && npm test` → green
- `grep -c '"1.0.0"' dist/assets/index-*.js` → 1 (version inlined with the commit next to it)
- `npm run preview` → footer shows `v1.0.0 (<commit>)`
- After merge: `git ls-remote --tags origin v1.0.0` → points at the merge commit
- After merge: `gh release view v1.0.0` → notes match the v1.0.0 section of `CHANGELOG.md`
