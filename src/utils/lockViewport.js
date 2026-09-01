export const readBox = (el) => ({
  w: Math.max(1, el?.clientWidth || window.innerWidth),
  h: Math.max(1, el?.clientHeight || window.innerHeight)
})

// Mobile browser chrome (URL bar / bottom bar) toggles the height on scroll, so
// a height-only change there is noise. On a pointer device the same change is a
// deliberate window resize and must be honoured, or the canvas goes stale.
export const lockViewport = (prev, next, ignoreHeightOnly = true) => {
  if (!prev.w || next.w !== prev.w) return next
  return ignoreHeightOnly ? prev : next
}

export const sameBox = (a, b) => a.w === b.w && a.h === b.h
