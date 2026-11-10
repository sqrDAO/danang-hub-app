import { useTranslation } from 'react-i18next'
import './PushInstallHelp.css'

const INSTALL_STEP_KEYS = [
  'notifications.pushInstallStepShare',
  'notifications.pushInstallStepAdd',
  'notifications.pushInstallStepOpen',
  'notifications.pushInstallStepEnable'
]

/** Help for an iPhone without push. hint: 'install' (steps) or 'safari'. */
const PushInstallHelp = ({ hint, id, className = '' }) => {
  const { t } = useTranslation()
  if (hint === 'safari') {
    return <p id={id} className={className}>{t('notifications.pushOpenInSafari')}</p>
  }
  return (
    <div id={id} className={`push-install-help ${className}`}>
      <ol>
        {INSTALL_STEP_KEYS.map((key) => <li key={key}>{t(key)}</li>)}
      </ol>
      <p>{t('notifications.pushInstallAlreadyAdded')}</p>
    </div>
  )
}

export default PushInstallHelp
