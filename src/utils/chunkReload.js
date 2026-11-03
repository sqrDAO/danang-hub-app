// Lazy chunks whose failure the importer absorbs itself, so they must never
// trigger a reload. Matched against the import error message, which carries the
// chunk URL in Chrome ("Failed to fetch dynamically imported module: …/assets/
// HeroCanvas3D-<hash>.js") and Firefox. Safari's message has no URL, so there
// only the offline check applies.
export const OPTIONAL_CHUNK_PATTERN = /HeroCanvas3D/

/**
 * @param {unknown} error the `vite:preloadError` event payload
 * @returns {boolean} true when the failing chunk is optional (see above)
 */
export function isOptionalChunkError(error) {
  const message = typeof error?.message === 'string' ? error.message : String(error ?? '')
  return OPTIONAL_CHUNK_PATTERN.test(message)
}

/**
 * After a deploy, an open tab can ask for a lazy chunk the new build removed.
 * Reload into the new build, at most once per build: the build that reloaded is
 * remembered, so a chunk that is broken in the new build too cannot loop the
 * page, while a later deploy (a new build id) can still recover.
 * Never reload while offline (the reload cannot reach the new build) or for an
 * optional chunk the importer already handles.
 * @param {object} input
 * @param {unknown} input.error the `vite:preloadError` event payload
 * @param {boolean} [input.online] `navigator.onLine`
 * @param {string|null} input.reloadedBuild build id that last auto-reloaded, or null
 * @param {string} input.currentBuild build id of the running tab
 * @returns {boolean}
 */
export function shouldReloadForStaleChunk({ error, online, reloadedBuild, currentBuild }) {
  if (online === false) return false
  if (isOptionalChunkError(error)) return false
  return reloadedBuild !== currentBuild
}
