export const STALE_CHUNK_RELOAD_WINDOW_MS = 10 * 1000

/**
 * After a deploy, an open tab can ask for a lazy chunk the new build removed.
 * Reload into the new build, but not again within the window, so a chunk that
 * is broken in the new build too cannot loop the page.
 * @param {number|null} lastReloadAt ms timestamp of the previous reload, or null
 * @param {number} now ms timestamp
 * @returns {boolean}
 */
export function shouldReloadForStaleChunk(lastReloadAt, now) {
  if (!Number.isFinite(lastReloadAt)) return true
  return now - lastReloadAt > STALE_CHUNK_RELOAD_WINDOW_MS
}
