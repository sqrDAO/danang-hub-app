# Architecture & system

<!-- stub: section headings + intent only. Fill in a follow-up task. -->
<!-- Don't restate CLAUDE.md's "Architecture (non-obvious)" rules — expand them with the why,
     diagrams, and the precise call paths. Canonical feature/function/collection tables stay
     in the root README. -->

How the member portal is built and why it's shaped this way. Companion to
[`data-flow.md`](./data-flow.md) (what moves through the system) — this doc covers the
static structure.

## Service layer

<!-- TODO: src/services/* as the only Firebase touchpoint; pages own React Query state;
     why no API server exists (Firestore rules are the backend authz). Map each service
     module to its collection/callable. -->

## Route protection (two layers)

<!-- TODO: ProtectedRoute (requireAdmin / requireProfileComplete) as UX layer vs
     firestore.rules as the enforcement layer. Why client checks alone are never trusted.
     Note: src/pages/Amenities.jsx and src/pages/Events.jsx are currently unrouted
     (not referenced from App.jsx) — confirm dead or wire up. -->

## Cloud Functions region pin

<!-- TODO: REGION = us-central1 in functions/index.js + getFunctions(app, 'us-central1')
     in src/services/firebase.js. History: asia-southeast1 attempt rolled back over the
     deploying account lacking roles/cloudfunctions.admin (commit 773f8a8). What breaks
     when the two drift (callable 404 / CORS). -->

## Timezone strategy

<!-- TODO: Asia/Ho_Chi_Minh everywhere. Client: src/utils/timezone.js (parseHubDateTime
     treats datetime-local as +07:00). Functions: Intl.DateTimeFormat-based hub-day math,
     HUB_UTC_OFFSET_HOURS = 7. Why no date library on the functions side. -->

## Theming & styling

<!-- TODO: CSS custom properties in src/styles/globals.css, [data-theme="dark"] overrides,
     ThemeContext + localStorage "hub-theme". Glassmorphism conventions, Outfit font,
     12px radius. -->

## i18n

<!-- TODO: react-i18next, src/i18n/index.js, src/locales/{en,vi}.json. How keys are
     organized; rule that user-visible strings go through t(). -->

## PWA & build

<!-- TODO: vite-plugin-pwa (autoUpdate, workbox runtime caching for fonts + Firebase
     Storage), manualChunks vendor split in vite.config.js, lazy-loaded routes in App.jsx. -->

## Emulators

<!-- TODO: VITE_USE_EMULATORS flow in src/services/firebase.js (ports 9099/8080/5001/9199),
     HMR double-connect guard. firebase emulators:start. -->

## Data model reference

<!-- TODO: per-collection field reference beyond the overview table in root README —
     booking plan fields (planType/planPeriod/planGroupId), event denormalized organizer
     fields, member preferences object, amenity availability fields (top-level, not
     nested). -->
