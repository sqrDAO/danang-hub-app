import { useTranslation } from 'react-i18next'
import { useAuth } from '../hooks/useAuth'
import Header from './Header'
import Footer from './Footer'
import BottomNav from './BottomNav'
import './Layout.css'

const Layout = ({ children, isAdmin = false, public: isPublic = false, hideChatbot = false, flush = false }) => {
  const { currentUser } = useAuth()
  const { t } = useTranslation()
  const isApp = !isPublic || Boolean(currentUser)
  return (
    <div className={`layout${isPublic ? ' layout--public' : ''}${isApp ? ' layout--app' : ''}${flush ? ' layout--flush' : ''}`}>
      <Header isAdmin={isAdmin} public={isPublic} />
      <main className="main-content">
        {children}
      </main>
      <Footer />
      {!hideChatbot && (
        <a
          href="https://t.me/danangblockchainhub"
          target="_blank"
          rel="noopener noreferrer"
          aria-label={t('common.telegramChatbot')}
          className="tg-float"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="10" rx="2"></rect>
            <circle cx="12" cy="5" r="2"></circle>
            <path d="M12 7v4"></path>
            <line x1="8" y1="16" x2="8" y2="16"></line>
            <line x1="16" y1="16" x2="16" y2="16"></line>
          </svg>
        </a>
      )}
      <BottomNav />
    </div>
  )
}

export default Layout
