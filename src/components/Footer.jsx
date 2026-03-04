import './Footer.css'
import { useTranslation } from 'react-i18next'

const Footer = () => {
  const { t } = useTranslation()
  const currentYear = new Date().getFullYear()

  return (
    <footer className="footer">
      <div className="footer-container container">
        <p className="footeropyright">
          {t('footer.copyright', { year: currentYear })}
        </p>
      </div>
    </footer>
  )
}

export default Footer
