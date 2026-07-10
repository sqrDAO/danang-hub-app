import { useAuth } from '../hooks/useAuth'
import Header from './Header'
import Footer from './Footer'
import BottomNav from './BottomNav'
import './Layout.css'

const Layout = ({ children, isAdmin = false, public: isPublic = false }) => {
  const { currentUser } = useAuth()
  return (
    <div className={`layout${(!isPublic || currentUser) ? ' layout--app' : ''}`}>
      <Header isAdmin={isAdmin} public={isPublic} />
      <main className="main-content">
        {children}
      </main>
      <Footer />
      <a
        href="https://t.me/danangblockchainhub"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Chat with our Telegram bot"
        className="tg-float"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none"
          stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="10" rx="2"></rect>
          <circle cx="12" cy="5" r="2"></circle>
          <path d="M12 7v4"></path>
          <line x1="8" y1="16" x2="8" y2="16"></line>
          <line x1="16" y1="16" x2="16" y2="16"></line>
        </svg>
      </a>
      <BottomNav />
    </div>
  )
}

export default Layout
