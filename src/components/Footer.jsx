import './Footer.css'
import { useTranslation } from 'react-i18next'

const MARKETING_BASE = 'https://www.danangblockchainhub.com'

const Footer = () => {
  const { t } = useTranslation()
  const currentYear = new Date().getFullYear()

  return (
    <footer className="footer">
      <div className="footer-container container">
        <div className="footer-top">
          <div className="footer-brand">
            <img src="/assets/logo.svg" alt="Da Nang Blockchain Hub" className="footer-logo" />
            <p className="footer-tagline">{t('footer.tagline')}</p>
            <div className="footer-social">
              <a
                href="https://www.facebook.com/profile.php?id=61576570201707"
                target="_blank"
                rel="noopener noreferrer"
                className="footer-social-link"
                aria-label="Facebook"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
              </a>
              <a
                href="https://t.me/+7ycB8RxiZQY5MDNl"
                target="_blank"
                rel="noopener noreferrer"
                className="footer-social-link"
                aria-label="Telegram"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                </svg>
              </a>
              <a
                href="mailto:danang.hub@sqrdao.com"
                className="footer-social-link"
                aria-label="Email"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
                </svg>
              </a>
            </div>
          </div>

          <div className="footer-links">
            <div className="footer-links-group">
              <h4 className="footer-links-heading">{t('footer.resources')}</h4>
              <ul className="footer-links-list">
                <li><a href={`${MARKETING_BASE}/sops.html`} target="_blank" rel="noopener noreferrer">{t('footer.sops')}</a></li>
                <li><a href={`${MARKETING_BASE}/brand-kit.html`} target="_blank" rel="noopener noreferrer">{t('footer.brandKit')}</a></li>
                <li><a href={`${MARKETING_BASE}/event-guidelines.html`} target="_blank" rel="noopener noreferrer">{t('footer.eventGuidelines')}</a></li>
              </ul>
            </div>

            <div className="footer-links-group">
              <h4 className="footer-links-heading">{t('footer.hub')}</h4>
              <ul className="footer-links-list">
                <li><a href={`${MARKETING_BASE}/#about`} target="_blank" rel="noopener noreferrer">{t('footer.about')}</a></li>
                <li><a href={`${MARKETING_BASE}/#leadership`} target="_blank" rel="noopener noreferrer">{t('footer.leadership')}</a></li>
                <li><a href={`${MARKETING_BASE}/#events`} target="_blank" rel="noopener noreferrer">{t('footer.activities')}</a></li>
                <li><a href={`${MARKETING_BASE}/#location`} target="_blank" rel="noopener noreferrer">{t('footer.location')}</a></li>
                <li><a href={`${MARKETING_BASE}/#calendar`} target="_blank" rel="noopener noreferrer">{t('footer.calendar')}</a></li>
              </ul>
            </div>
          </div>
        </div>

        <div className="footer-bottom">
          <p className="footer-copyright">
            {t('footer.copyright', { year: currentYear })}
          </p>
        </div>
      </div>
    </footer>
  )
}

export default Footer
