import { useTranslation } from 'react-i18next'
import './WhatsAppFloat.css'

// Same contact link and icon as the danang-hub-landing site's .wa-float.
const WHATSAPP_URL = 'https://wa.me/84865311291'

// `solo` puts it in the Telegram button's base slot on pages without one (/login).
const WhatsAppFloat = ({ solo = false }) => {
  const { t } = useTranslation()
  return (
    <a
      href={WHATSAPP_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={t('common.whatsappChat')}
      className={`wa-float${solo ? ' wa-float--solo' : ''}`}
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
        <path d="M8 7h2l1 3-1.5 1.5a9 9 0 0 0 3 3L14 13l3 1v2a1 1 0 0 1-1 1A9 9 0 0 1 7 8a1 1 0 0 1 1-1z"></path>
      </svg>
    </a>
  )
}

export default WhatsAppFloat
