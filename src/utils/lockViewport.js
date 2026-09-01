export const readBox = (el) => ({
  w: Math.max(1, el?.clientWidth || window.innerWidth),
  h: Math.max(1, el?.clientHeight || window.innerHeight)
})

export const lockViewport = (prev, next) => {
  if (!prev.w || next.w !== prev.w) return next
  return prev
}

export const sameBox = (a, b) => a.w === b.w && a.h === b.h
