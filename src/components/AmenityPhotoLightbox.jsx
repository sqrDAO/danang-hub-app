import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import './AmenityPhotoLightbox.css'

// Native modal lifecycle, mirroring `Modal`: showModal() gives focus
// containment, an inert background and Escape/back-gesture close requests;
// the root scroll lock is the global `html:has(dialog:modal)` rule.
const useModalDialog = (isOpen, onClose) => {
  const dialogRef = useRef(null)

  useLayoutEffect(() => {
    if (!isOpen) return undefined
    const dialog = dialogRef.current
    const opener = document.activeElement
    dialog.setAttribute('closedby', 'any')
    dialog.showModal()
    return () => {
      dialog.close()
      // React removes the dialog before this cleanup, so native focus return
      // cannot run; restore the opening thumbnail ourselves.
      if (opener?.isConnected) opener.focus()
    }
  }, [isOpen])

  const handleCancel = (event) => {
    event.stopPropagation()
    event.preventDefault()
    onClose()
  }

  // A non-cancelable close request can still close the dialog natively;
  // keep the controlled prop in sync instead of leaving a closed dialog mounted.
  const handleNativeClose = (event) => {
    event.stopPropagation()
    if (dialogRef.current?.isConnected && !dialogRef.current.open) onClose()
  }

  return { dialogRef, handleCancel, handleNativeClose }
}

const LightboxThumbnails = ({ photos, index, onSelect }) => (
  <div className="lightbox-thumbnails">
    {photos.map((photo, i) => (
      <button
        key={i}
        type="button"
        className={`lightbox-thumbnail ${i === index ? 'active' : ''}`}
        onClick={() => onSelect(i)}
        aria-label={`Photo ${i + 1}`}
      >
        <img src={photo} alt="" />
      </button>
    ))}
  </div>
)

const AmenityPhotoLightbox = ({ isOpen, onClose, photos = [], startIndex = 0, alt = '' }) => {
  const { t } = useTranslation()
  const [index, setIndex] = useState(startIndex)
  const touchStartX = useRef(null)
  const visible = isOpen && photos.length > 0
  const { dialogRef, handleCancel, handleNativeClose } = useModalDialog(visible, onClose)

  useEffect(() => {
    if (isOpen) {
      setIndex(startIndex)
    }
  }, [isOpen, startIndex])

  if (!visible) return null

  const goPrev = () => setIndex((i) => (i === 0 ? photos.length - 1 : i - 1))
  const goNext = () => setIndex((i) => (i + 1) % photos.length)

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowLeft') goPrev()
    else if (e.key === 'ArrowRight') goNext()
  }

  // The dialog fills the viewport, so its own dark area is the "backdrop".
  const handleClick = (e) => {
    if (e.target === e.currentTarget) onClose()
  }

  const handleTouchStart = (e) => { touchStartX.current = e.touches[0].clientX }
  const handleTouchEnd = (e) => {
    if (touchStartX.current === null) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    if (Math.abs(dx) > 50) dx < 0 ? goNext() : goPrev()
    touchStartX.current = null
  }

  return (
    <dialog
      ref={dialogRef}
      className="lightbox-overlay"
      aria-label={alt || undefined}
      onCancel={handleCancel}
      onClose={handleNativeClose}
      onKeyDown={handleKeyDown}
      onClick={handleClick}
    >
      <button
        type="button"
        className="lightbox-close"
        onClick={onClose}
        aria-label={t('common.close')}
      >
        ×
      </button>

      <div
        className="lightbox-content"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <img
          className="lightbox-image"
          src={photos[index]}
          alt={alt ? `${alt} ${index + 1}` : `Photo ${index + 1}`}
        />

        {photos.length > 1 && (
          <>
            <button
              type="button"
              className="lightbox-nav lightbox-nav-prev"
              onClick={goPrev}
              aria-label="Previous photo"
            >
              ‹
            </button>
            <button
              type="button"
              className="lightbox-nav lightbox-nav-next"
              onClick={goNext}
              aria-label="Next photo"
            >
              ›
            </button>
            <div className="lightbox-counter">
              {index + 1} / {photos.length}
            </div>
          </>
        )}
      </div>

      {photos.length > 1 && (
        <LightboxThumbnails photos={photos} index={index} onSelect={setIndex} />
      )}
    </dialog>
  )
}

export default AmenityPhotoLightbox
