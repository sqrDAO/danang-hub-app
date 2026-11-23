// Navigations the service worker must never answer with the app shell (public/sw.js).
// Firebase-reserved /__/ paths (Auth popup) need the network. OAuth endpoints and
// discovery docs are served by Cloud Functions through Hosting rewrites, so a cold
// function past the page timeout must not get the shell either. /oauth/consent is a
// real SPA route, so it keeps the fallback.
export const NAVIGATION_DENYLIST = [/^\/__\//, /^\/\.well-known\//, /^\/oauth\/(?!consent(?:[/?#]|$))/]

// Workbox matches the denylist against pathname + search.
export const isDenylistedNavigation = (pathAndSearch) =>
  NAVIGATION_DENYLIST.some((pattern) => pattern.test(pathAndSearch))
