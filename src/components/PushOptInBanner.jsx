import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../hooks/useAuth'
import {
  closePushOptInBanner,
  subscribePushOptIn
} from '../utils/pushOptInPrompt'
import { showToast } from '../utils/toast'
import './PushOptInBanner.css'

const BellGlyph = () => (
  <svg className="push-opt-in-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
)

const PushOptInBanner = () => {
  const { t } = useTranslation()
  const { refreshUserProfile } = useAuth()
  const [state, setState] = useState(null)
  const [enabling, setEnabling] = useState(false)
  const [progressKey, setProgressKey] = useState(0)

  useEffect(() => subscribePushOptIn((next) => {
    setState(next)
    if (next) {
      setEnabling(false)
      setProgressKey((key) => key + 1)
    }
  }), [])

  if (!state) return null

  const handleEnable = async () => {
    if (enabling) return
    setEnabling(true)
    try {
      // Loaded on tap: this component is mounted app-wide, and a static import
      // would pull firebase/messaging into the eager entry chunk for every
      // visitor, logged in or not.
      const { enablePushNotifications } = await import('../services/pushNotifications')
      await enablePushNotifications(state.uid)
      // Keep AuthContext in sync so later successes pass pushOptedIn=true
      if (typeof refreshUserProfile === 'function') {
        await refreshUserProfile()
      }
      showToast(t('notifications.pushOptInEnabled'), 'success')
      closePushOptInBanner()
    } catch (error) {
      showToast(error.message || t('notifications.pushOptInFailed'), 'error')
      setEnabling(false)
    }
  }

  const handleDismiss = (event) => {
    event.stopPropagation()
    if (enabling) return
    closePushOptInBanner({ countDismiss: true })
  }

  const handleTimeout = () => {
    if (enabling) return
    closePushOptInBanner({ countDismiss: false })
  }

  return (
    <div
      className={`push-opt-in${enabling ? ' push-opt-in--paused' : ''}`}
      role="region"
      aria-label={t('notifications.pushOptInTitle')}
    >
      <button
        type="button"
        className="push-opt-in-body"
        onClick={handleEnable}
        disabled={enabling}
      >
        <BellGlyph />
        <span className="push-opt-in-copy">
          <strong>{t('notifications.pushOptInTitle')}</strong>
          <span>{t('notifications.pushOptInBody')}</span>
        </span>
      </button>
      <button
        type="button"
        className="push-opt-in-close"
        onClick={handleDismiss}
        disabled={enabling}
        aria-label={t('notifications.pushOptInDismiss')}
      >
        ×
      </button>
      <div className="push-opt-in-progress" aria-hidden>
        <div
          key={progressKey}
          className="push-opt-in-progress-bar"
          onAnimationEnd={handleTimeout}
        />
      </div>
    </div>
  )
}

export default PushOptInBanner
