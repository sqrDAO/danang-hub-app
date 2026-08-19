import { useTranslation } from 'react-i18next'
import { getUpcomingHubClosures } from '../utils/hubClosures'
import { formatDateDDMMYYYY } from '../utils/timezone'
import './HubClosureNotice.css'

// Upcoming full-day Hub closures. Renders nothing once every closure has
// passed, so it can sit unconditionally at the top of a page.
const HubClosureNotice = ({ hintKey = 'closures.noticeHint', className = '' }) => {
  const { t } = useTranslation()
  const closures = getUpcomingHubClosures()

  if (closures.length === 0) return null

  return (
    <aside className={`hub-closure-notice ${className}`.trim()} role="note">
      <span className="hub-closure-notice-icon" aria-hidden="true">🏖️</span>
      <div className="hub-closure-notice-body">
        <h3 className="hub-closure-notice-title">{t('closures.noticeTitle')}</h3>
        <ul className="hub-closure-notice-list">
          {closures.map(closure => (
            <li key={closure.id}>
              <strong>{t(closure.labelKey)}</strong>
              {' — '}
              {t('closures.dateRange', {
                start: formatDateDDMMYYYY(closure.start),
                end: formatDateDDMMYYYY(closure.end),
              })}
            </li>
          ))}
        </ul>
        <p className="hub-closure-notice-hint">{t(hintKey)}</p>
      </div>
    </aside>
  )
}

export default HubClosureNotice
