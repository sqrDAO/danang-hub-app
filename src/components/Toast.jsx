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
  return host.isConnected ? host : document.body
}

export const ToastContainer = () => {
  const [toasts, setToasts] = useState([])
  const host = useToastHost()
  const containerRef = useRef(null)
  const previousFocus = useRef(null)
  const displayedToastIds = useRef(new Set())

  useLayoutEffect(() => {
    const container = containerRef.current
    // Closing a modal and queuing/expiring a toast can share a commit.
    // The host observer will move us to the remaining dialog or body next.
    if (!container?.isConnected || !container.showPopover) return
    if (container.matches(':popover-open')) container.hidePopover()
    if (toasts.length) container.showPopover()
    displayedToastIds.current = new Set(toasts.map(toast => toast.id))
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

  const removeToast = (id, event) => {
    if (event.currentTarget.contains(document.activeElement) && previousFocus.current?.isConnected) {
      previousFocus.current.focus()
    }
    setToasts(prev => prev.filter(t => t.id !== id))
  }

  return createPortal(
    <div className="toast-container" ref={containerRef} popover="manual" aria-live="polite"
      onFocusCapture={event => {
        if (!event.currentTarget.contains(event.relatedTarget)) previousFocus.current = event.relatedTarget
      }}
      onPointerDown={event => event.preventDefault()}
    >
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={`toast toast-${toast.type}`}
          // A new portal host must not replay entry for an existing notification.
          style={displayedToastIds.current.has(toast.id) ? { animation: 'none' } : undefined}
          onClick={event => removeToast(toast.id, event)}
        >
          <div className="toast-content">
            <span className="toast-message">{toast.message}</span>
          </div>
          <button type="button" className="toast-close" onClick={event => removeToast(toast.id, event)}>
            ×
          </button>
        </div>
      ))}
    </div>,
    host
  )
}

export default ToastContainer
