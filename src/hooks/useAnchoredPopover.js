import { useEffect, useState } from 'react'

// A top-layer popover ignores its DOM containing block, so it is placed from
// the anchor's viewport rect. CSS reads these properties and keeps its own
// offsets and breakpoints (the notification panel pins itself on phones).
const placeFromAnchor = (anchor, popover) => {
  if (!anchor?.isConnected) return
  const rect = anchor.getBoundingClientRect()
  popover.style.setProperty('--popover-top', `${rect.bottom}px`)
  popover.style.setProperty('--popover-left', `${rect.left}px`)
  // an x coordinate, not a `right` inset: the root's scrollbar gutter makes
  // the viewport width ambiguous, so right-aligned panels use translate
  popover.style.setProperty('--popover-anchor-right', `${rect.right}px`)
  popover.style.setProperty('--popover-width', `${rect.width}px`)
}

const followAnchor = (place) => {
  const targets = [[window, 'resize'], [document, 'scroll', true], [window.visualViewport, 'resize']]
  targets.forEach(([target, name, capture]) => target?.addEventListener(name, place, capture))
  return () => targets.forEach(([target, name, capture]) => target?.removeEventListener(name, place, capture))
}

export const hidePopover = (popover) => {
  if (popover?.isConnected && popover.matches(':popover-open')) popover.hidePopover()
}

// Mirrors a `popover` element's native open state into React (light dismiss
// and Esc close it without React) and keeps it under its anchor while open.
const useAnchoredPopover = (anchorRef, popoverRef) => {
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    const popover = popoverRef.current
    if (!popover) return undefined
    // beforetoggle runs before the first open frame, so it never paints misplaced
    const handleBeforeToggle = (event) => {
      if (event.newState === 'open') placeFromAnchor(anchorRef.current, popover)
    }
    const handleToggle = (event) => setIsOpen(event.newState === 'open')
    popover.addEventListener('beforetoggle', handleBeforeToggle)
    popover.addEventListener('toggle', handleToggle)
    return () => {
      popover.removeEventListener('beforetoggle', handleBeforeToggle)
      popover.removeEventListener('toggle', handleToggle)
    }
  }, [anchorRef, popoverRef])

  useEffect(() => {
    const popover = popoverRef.current
    if (!isOpen || !popover) return undefined
    const place = () => placeFromAnchor(anchorRef.current, popover)
    place()
    return followAnchor(place)
  }, [isOpen, anchorRef, popoverRef])

  return isOpen
}

export default useAnchoredPopover
