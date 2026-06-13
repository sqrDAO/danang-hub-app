import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import './AmenityPhotoLightbox.css'

const AmenityPhotoLightbox = ({ isOpen, onClose, photos = [], startIndex = 0, alt = '' }) => {
  const { t } = useTranslation()
  const [index, setIndex] = useState(startIndex)
  const touchStartX = useRef(null)

  useEffect(() => {
    if (isOpen) {
      setIndex(startIndex)
    }
  }, [isOpen, startIndex])

  useEffect(() => {
    if (!isOpen) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleKey = (e) => {
      if (e.key === 'Escape') {
        onClose()
      } else if (e.key === 'ArrowLeft') {
        setIndex((i) => (i === 0 ? photos.length - 1 : i - 1))
      } else if (e.key === 'ArrowRight') {
        setIndex((i) => (i + 1) % photos.length)
      }
    }
    window.addEventListener('keydown', handleKey)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKey)
    }
  }, [isOpen, onClose, photos.length])

  if (!isOpen || photos.length === 0) return null

  const goPrev = () => setIndex((i) => (i === 0 ? photos.length - 1 : i - 1))
  const goNext = () => setIndex((i) => (i + 1) % photos.length)

  const handleTouchStart = (e) => { touchStartX.current = e.touches[0].clientX }
  const handleTouchEnd = (e) => {
    if (touchStartX.current === null) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    if (Math.abs(dx) > 50) dx < 0 ? goNext() : goPrev()
    touchStartX.current = null
  }

  return (
    <div className="lightbox-overlay" onClick={onClose} role="dialog" aria-modal="true">
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
        onClick={(e) => e.stopPropagation()}
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
        <div className="lightbox-thumbnails" onClick={(e) => e.stopPropagation()}>
          {photos.map((photo, i) => (
            <button
              key={i}
              type="button"
              className={`lightbox-thumbnail ${i === index ? 'active' : ''}`}
              onClick={() => setIndex(i)}
              aria-label={`Photo ${i + 1}`}
            >
              <img src={photo} alt="" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default AmenityPhotoLightbox
