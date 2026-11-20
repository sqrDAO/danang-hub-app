import { useLayoutEffect, useId, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import './Modal.css'

const Modal = ({ isOpen, onClose, title, children, footer = null, className = '' }) => {
  const { t } = useTranslation()
  // Unique per instance: stacked modals (event detail + host profile) must not
  // share one title id.
  const titleId = useId()

  const dialogRef = useRef(null)
  const pressedOutside = useRef(false)

  useLayoutEffect(() => {
    if (!isOpen) return undefined
    const dialog = dialogRef.current
    const opener = document.activeElement
    dialog.setAttribute('closedby', 'any')
    dialog.showModal()
    return () => {
      dialog.close()
      // React removes closed modal content; restore the invoker before removal.
      if (opener?.isConnected) opener.focus()
    }
  }, [isOpen])

  const isOutside = (event) => {
    const rect = event.currentTarget.getBoundingClientRect()
    return event.clientX < rect.left || event.clientX > rect.right ||
      event.clientY < rect.top || event.clientY > rect.bottom
  }

  const handlePointerDown = (event) => {
    pressedOutside.current = isOutside(event)
  }

  const handlePointerUp = (event) => {
    if (!('closedBy' in event.currentTarget) && pressedOutside.current && isOutside(event)) {
      onClose()
    }
    pressedOutside.current = false
  }

  const handleCancel = (event) => {
    event.preventDefault()
    onClose()
  }

  if (!isOpen) return null

  return (
    <dialog
      className={`modal-content glass ${className}`.trim()}
      ref={dialogRef}
      onCancel={handleCancel}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      aria-labelledby={title ? titleId : undefined}
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
    </dialog>
  )
}

export default Modal
