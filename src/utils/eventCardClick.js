// Mouse convenience: clicking anywhere on an event card opens its detail
// modal. Keyboard and screen-reader users open it through the card's title
// button (EventTitleButton) instead, so the card itself carries no role or
// tabIndex — that would hide the card's own buttons from assistive tech.
// Clicks on the card's own buttons/links and text-selection drags are ignored.
export const getCardOpenProps = (onOpen) => ({
  onClick: (e) => {
    if (e.target.closest('button, a')) return
    if (window.getSelection()?.toString()) return
    onOpen()
  }
})
