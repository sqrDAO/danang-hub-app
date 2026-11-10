import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import {
  closePushOptInBanner,
  subscribePushOptIn
} from '../utils/pushOptInPrompt'
import { showToast } from '../utils/toast'
import PushInstallHelp from './PushInstallHelp'
import './PushOptInBanner.css'

const BellGlyph = () => (
  <svg className="push-opt-in-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
)

const STEPS_ID = 'push-opt-in-steps'
const BODY_KEYS = {
  enable: 'notifications.pushOptInBody',
  install: 'notifications.pushInstallBody',
  safari: 'notifications.pushOpenInSafari'
}

const PushOptInBanner = () => {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const { refreshUserProfile } = useAuth()
  const [state, setState] = useState(null)
  const [enabling, setEnabling] = useState(false)
  const [progressKey, setProgressKey] = useState(0)
  // Page the install steps were opened on; null while they're closed.
  const [stepsPath, setStepsPath] = useState(null)
  const stepsOpen = stepsPath !== null

  useEffect(() => subscribePushOptIn((next) => {
    setState(next)
    if (next) {
      setEnabling(false)
      setStepsPath(null)
      setProgressKey((key) => key + 1)
    }
  }), [])

  // Open steps have no auto-close, so moving to another page closes them
  // instead of leaving the banner over every page.
  useEffect(() => {
    if (stepsPath !== null && pathname !== stepsPath) closePushOptInBanner()
  }, [pathname, stepsPath])

  if (!state) return null

  const isInstall = state.mode === 'install'

  const handleEnable = async () => {
    if (enabling) return
    setEnabling(true)
    try {
      // Loaded on tap: this component is mounted app-wide, and a static import
      // would pull firebase/messaging into the eager entry chunk for every
      // visitor, logged in or not.
      const { enablePushNotifications } = await import('../services/pushNotifications')
      await enablePushNotifications(state.uid)
      // Enabling wrote preferences.pushNotifications=true; keep the cached
      // profile in step so a later Profile save writes it back unchanged.
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

  // Install mode: the tap toggles the steps. Swapping the progress bar for the
  // steps list also removes its onAnimationEnd, so it stays open. Safari mode
  // has nothing to expand, so the tap just closes it.
  const handleTap = {
    install: () => setStepsPath((openOn) => (openOn === null ? pathname : null)),
    safari: () => closePushOptInBanner()
  }[state.mode] ?? handleEnable

  const handleDismiss = (event) => {
    event.stopPropagation()
    if (enabling) return
    // Reading the steps is engagement, not a refusal.
    closePushOptInBanner({ countDismiss: !stepsOpen })
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
        onClick={handleTap}
        disabled={enabling}
        aria-expanded={isInstall ? stepsOpen : undefined}
        aria-controls={isInstall ? STEPS_ID : undefined}
      >
        <BellGlyph />
        <span className="push-opt-in-copy">
          <strong>{t('notifications.pushOptInTitle')}</strong>
          <span>{t(BODY_KEYS[state.mode] ?? BODY_KEYS.enable)}</span>
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
      {stepsOpen ? <PushInstallHelp hint="install" id={STEPS_ID} className="push-opt-in-steps" /> : (
        <div className="push-opt-in-progress" aria-hidden>
          <div
            key={progressKey}
            className="push-opt-in-progress-bar"
            onAnimationEnd={handleTimeout}
          />
        </div>
      )}
    </div>
  )
}

export default PushOptInBanner
