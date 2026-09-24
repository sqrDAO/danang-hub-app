import { useEffect, useId } from 'react'
import { useTranslation } from 'react-i18next'
import './Modal.css'

const Modal = ({ isOpen, onClose, title, children, footer = null, className = '' }) => {
  const { t } = useTranslation()
  // Unique per instance: stacked modals (event detail + host profile) must not
  // share one title id.
  const titleId = useId()

  useEffect(() => {
    if (!isOpen) return undefined

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className={`modal-content glass ${className}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          {title && (
            <h3 id={titleId} className="modal-title">
              {title}
            </h3>
          )}
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            aria-label={t('common.close')}
          >
            ×
          </button>
        </div>
        <div className="modal-body">
          {children}
        </div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  )
}

export default Modal
