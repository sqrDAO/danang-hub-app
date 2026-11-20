import { useState, useEffect, useLayoutEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { subscribeToToasts } from '../utils/toast'
import './Toast.css'

const useToastHost = () => {
  const [host, setHost] = useState(document.body)
  useLayoutEffect(() => {
    const update = () => {
      const dialogs = [...document.querySelectorAll('dialog:modal')]
      setHost(document.activeElement?.closest('dialog:modal') || dialogs.at(-1) || document.body)
    }
    const observer = new MutationObserver(update)
    observer.observe(document.body, { attributes: true, attributeFilter: ['open'], childList: true, subtree: true })
    document.addEventListener('focusin', update)
    update()
    return () => {
      observer.disconnect()
      document.removeEventListener('focusin', update)
    }
  }, [])
  return host
}

export const ToastContainer = () => {
  const [toasts, setToasts] = useState([])
  const host = useToastHost()
  const containerRef = useRef(null)

  useLayoutEffect(() => {
    const container = containerRef.current
    if (!container.showPopover) return
    container.hidePopover()
    if (toasts.length) container.showPopover()
  }, [toasts, host])

  useEffect(() => {
    const listener = (toast) => {
      setToasts(prev => [...prev, toast])
      
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== toast.id))
      }, toast.duration)
    }

    return subscribeToToasts(listener)
  }, [])

  const removeToast = (id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }

  return createPortal(
    <div className="toast-container" ref={containerRef} popover="manual" aria-live="polite">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={`toast toast-${toast.type}`}
          onClick={() => removeToast(toast.id)}
        >
          <div className="toast-content">
            <span className="toast-message">{toast.message}</span>
          </div>
          <button className="toast-close" onClick={() => removeToast(toast.id)}>
            ×
          </button>
        </div>
      ))}
    </div>,
    host
  )
}

export default ToastContainer
