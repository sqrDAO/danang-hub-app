import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../hooks/useAuth'
import { useTheme } from '../hooks/useTheme'
import { updateMemberLocale } from '../services/members'
import Avatar from './Avatar'
import NotificationBell from './NotificationBell'
import './Header.css'

const SunIcon = () => (
  <svg className="header-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <circle cx="12" cy="12" r="5" />
    <line x1="12" y1="1" x2="12" y2="3" />
    <line x1="12" y1="21" x2="12" y2="23" />
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
    <line x1="1" y1="12" x2="3" y2="12" />
    <line x1="21" y1="12" x2="23" y2="12" />
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
  </svg>
)

const MoonIcon = () => (
  <svg className="header-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
)

const MemberViewIcon = () => (
  <svg className="header-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
    <circle cx="12" cy="7" r="4"/>
  </svg>
)

const AdminViewIcon = () => (
  <svg className="header-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  </svg>
)

const ViewSwitchIcon = ({ isAdmin }) => (isAdmin ? <MemberViewIcon /> : <AdminViewIcon />)

const getCurrentLanguage = (i18n) => (i18n.language && i18n.language.startsWith('vi') ? 'vi' : 'en')

const getBasePath = (isPublic, isAdmin) => {
  if (isPublic) return '/'
  return isAdmin ? '/admin' : '/member'
}

const getHeaderClassName = (isPublic, currentUser) =>
  `header${(!isPublic || currentUser) ? ' header--app' : ''}`

const NavLink = ({ to, isActive, children }) => {
  const active = isActive(to)
  return (
    <li>
      <Link
        to={to}
        className={active ? 'active' : ''}
      >
        {children}
      </Link>
    </li>
  )
}

const PublicNavItems = ({ location, isSectionActive, currentUser, checkAdmin, t }) => (
  <>
    <li>
      <Link
        to="/"
        onClick={(e) => {
          if (location.pathname === '/') {
            e.preventDefault()
            window.scrollTo({ top: 0, behavior: 'smooth' })
          }
        }}
        className={isSectionActive('') && location.pathname === '/' ? 'active' : ''}
      >
        {t('nav.home')}
      </Link>
    </li>
    <li>
      <a
        href="#amenities"
        className={isSectionActive('#amenities') ? 'active' : ''}
      >
        {t('nav.amenities')}
      </a>
    </li>
    <li>
      <a
        href="#events"
        className={isSectionActive('#events') ? 'active' : ''}
      >
        {t('nav.events')}
      </a>
    </li>
    {currentUser && checkAdmin() && (
      <li>
        <Link
          to="/admin"
          className={location.pathname.startsWith('/admin') ? 'active' : ''}
        >
          {t('nav.admin')}
        </Link>
      </li>
    )}
  </>
)

const AdminNavItems = ({ isActive, t }) => (
  <>
    <NavLink to="/admin" isActive={isActive}>{t('nav.dashboard')}</NavLink>
    <NavLink to="/admin/members" isActive={isActive}>{t('nav.members')}</NavLink>
    <NavLink to="/admin/amenities" isActive={isActive}>{t('nav.amenities')}</NavLink>
    <NavLink to="/admin/bookings" isActive={isActive}>{t('nav.bookings')}</NavLink>
    <NavLink to="/admin/events" isActive={isActive}>{t('nav.events')}</NavLink>
  </>
)

const MemberNavItems = ({ isActive, t }) => (
  <>
    <NavLink to="/member" isActive={isActive}>{t('nav.dashboard')}</NavLink>
    <NavLink to="/member/bookings" isActive={isActive}>{t('nav.myBookings')}</NavLink>
    <NavLink to="/member/events" isActive={isActive}>{t('nav.events')}</NavLink>
  </>
)

const NavItems = (props) => {
  if (props.isPublic) return <PublicNavItems {...props} />
  if (props.isAdmin) return <AdminNavItems {...props} />
  return <MemberNavItems {...props} />
}

const ViewSwitchLink = ({ isAdmin, t }) => (
  <Link
    to={isAdmin ? '/member' : '/admin'}
    className="view-switch-btn"
    title={isAdmin ? t('nav.memberView') : t('nav.adminView')}
  >
    <ViewSwitchIcon isAdmin={isAdmin} />
    <span className="view-switch-label">{isAdmin ? t('nav.memberView') : t('nav.adminView')}</span>
  </Link>
)

const LanguageButton = ({ currentLanguage, toggleLanguage }) => (
  <button
    type="button"
    className="header-icon-btn"
    onClick={toggleLanguage}
    aria-label={currentLanguage === 'en' ? 'Switch to Vietnamese' : 'Switch to English'}
    title={currentLanguage === 'en' ? 'Tiếng Việt' : 'English'}
  >
    <span className="lang-label">{currentLanguage === 'en' ? 'EN' : 'VI'}</span>
  </button>
)

const ThemeToggleButton = ({ theme, toggleTheme, t }) => (
  <button
    type="button"
    className="header-icon-btn"
    onClick={toggleTheme}
    aria-label={theme === 'dark' ? t('common.lightMode') : t('common.darkMode')}
  >
    {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
  </button>
)

const LoginLink = ({ t }) => (
  <Link to="/login" className="btn btn-primary btn-header">
    <svg className="btn-header-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
      <polyline points="10 17 15 12 10 7"/>
      <line x1="15" y1="12" x2="3" y2="12"/>
    </svg>
    <span className="btn-header-text">{t('common.login')}</span>
  </Link>
)

const UserMenuTrigger = ({ userProfile, onClick, t }) => (
  <button
    type="button"
    className="user-menu-trigger"
    onClick={onClick}
    aria-label={t('nav.profile')}
  >
    <Avatar
      src={userProfile?.photoURL}
      name={userProfile?.displayName}
      size="md"
    />
  </button>
)

const UserDropdownHeader = ({ userProfile }) => (
  <div className="user-dropdown-header">
    <span className="user-dropdown-name">{userProfile.displayName}</span>
    <span className="user-dropdown-email">{userProfile.email}</span>
  </div>
)

const PublicUserMenu = ({ menuRef, isUserMenuOpen, setIsUserMenuOpen, userProfile, checkAdmin, handleLogout, t }) => (
  <div className="user-menu-wrap" ref={menuRef}>
    <UserMenuTrigger userProfile={userProfile} onClick={() => setIsUserMenuOpen(!isUserMenuOpen)} t={t} />
    {isUserMenuOpen && (
      <div className="user-dropdown">
        {userProfile && <UserDropdownHeader userProfile={userProfile} />}
        <Link
          to={checkAdmin() ? '/admin/profile' : '/member/profile'}
          className="user-dropdown-item"
          onClick={() => setIsUserMenuOpen(false)}
        >
          {t('nav.profile')}
        </Link>
        <Link
          to={checkAdmin() ? '/admin' : '/member'}
          className="user-dropdown-item"
          onClick={() => setIsUserMenuOpen(false)}
        >
          {t('nav.dashboard')}
        </Link>
        <button className="user-dropdown-item user-dropdown-logout" onClick={handleLogout}>
          {t('common.logout')}
        </button>
      </div>
    )}
  </div>
)

const AppUserMenu = ({ menuRef, isUserMenuOpen, setIsUserMenuOpen, userProfile, profilePath, isAdmin, checkAdmin, handleLogout, t }) => (
  <div className="user-menu-wrap" ref={menuRef}>
    <UserMenuTrigger userProfile={userProfile} onClick={() => setIsUserMenuOpen(!isUserMenuOpen)} t={t} />
    {isUserMenuOpen && (
      <div className="user-dropdown">
        {userProfile && <UserDropdownHeader userProfile={userProfile} />}
        <Link
          to={profilePath}
          className="user-dropdown-item"
          onClick={() => setIsUserMenuOpen(false)}
        >
          {t('nav.profile')}
        </Link>
        {checkAdmin() && (
          <Link
            to={isAdmin ? '/member' : '/admin'}
            className="user-dropdown-item"
            onClick={() => setIsUserMenuOpen(false)}
          >
            {isAdmin ? t('nav.memberView') : t('nav.adminView')}
          </Link>
        )}
        <button className="user-dropdown-item user-dropdown-logout" onClick={handleLogout}>
          {t('common.logout')}
        </button>
      </div>
    )}
  </div>
)

const UserArea = (props) => {
  if (!props.isPublic) return <AppUserMenu {...props} />
  if (!props.currentUser) return <LoginLink t={props.t} />
  return <PublicUserMenu {...props} />
}

const Header = ({ isAdmin = false, public: isPublic = false }) => {
  const { currentUser, userProfile, logout, isAdmin: checkAdmin } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const location = useLocation()
  const [activeSection, setActiveSection] = useState('')
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  const userMenuRef = useRef(null)
  const { t, i18n } = useTranslation()

  const currentLanguage = getCurrentLanguage(i18n)

  const toggleLanguage = () => {
    const nextLanguage = currentLanguage === 'en' ? 'vi' : 'en'
    i18n.changeLanguage(nextLanguage)
    // Mirror onto the member doc so Cloud Functions can localize push copy;
    // updateMemberLocale swallows its own errors so the UI switch always wins.
    updateMemberLocale(currentUser?.uid, nextLanguage)
  }

  const handleLogout = async () => {
    try {
      setIsUserMenuOpen(false)
      await logout()
      navigate(isPublic ? '/' : '/login')
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  const basePath = getBasePath(isPublic, isAdmin)
  const profilePath = isAdmin ? '/admin/profile' : '/member/profile'

  // Close user menu on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setIsUserMenuOpen(false)
      }
    }
    if (isUserMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isUserMenuOpen])

  useEffect(() => {
    if (!isPublic || location.pathname !== '/') {
      setActiveSection('')
      return
    }

    if (location.hash) {
      setActiveSection(location.hash)
    } else if (window.scrollY < 100) {
      setActiveSection('')
    }

    const sections = ['hero', 'amenities', 'events', 'past-events']
    let scrollTimeout

    const checkActiveSection = () => {
      clearTimeout(scrollTimeout)
      scrollTimeout = setTimeout(() => {
        const scrollPosition = window.scrollY + 150
        let currentSection = ''

        for (let i = sections.length - 1; i >= 0; i--) {
          const element = document.getElementById(sections[i])
          if (element) {
            const offsetTop = element.offsetTop
            if (scrollPosition >= offsetTop) {
              currentSection = sections[i] === 'hero' ? '' : `#${sections[i]}`
              break
            }
          }
        }

        if (window.scrollY < 50) {
          currentSection = ''
        }

        setActiveSection(prev => {
          if (prev !== currentSection) {
            return currentSection
          }
          return prev
        })
      }, 10)
    }

    const observerOptions = {
      root: null,
      rootMargin: '-120px 0px -60% 0px',
      threshold: [0, 0.1, 0.5, 1]
    }

    const observerCallback = (entries) => {
      const intersectingEntries = entries.filter(e => e.isIntersecting)
      if (intersectingEntries.length > 0) {
        const mostVisible = intersectingEntries.reduce((prev, current) =>
          current.intersectionRatio > prev.intersectionRatio ? current : prev
        )

        const id = mostVisible.target.id
        if (id && sections.includes(id)) {
          const newSection = id === 'hero' ? '' : `#${id}`
          setActiveSection(prev => {
            if (prev !== newSection) {
              return newSection
            }
            return prev
          })
        }
      }
    }

    const observer = new IntersectionObserver(observerCallback, observerOptions)

    sections.forEach(sectionId => {
      const element = document.getElementById(sectionId)
      if (element) {
        observer.observe(element)
      }
    })

    window.addEventListener('scroll', checkActiveSection, { passive: true })
    checkActiveSection()

    return () => {
      observer.disconnect()
      window.removeEventListener('scroll', checkActiveSection)
      clearTimeout(scrollTimeout)
    }
  }, [isPublic, location.pathname, location.hash])

  const isActive = (path) => {
    if (path === basePath) {
      return location.pathname === path
    }
    return location.pathname.startsWith(path)
  }

  const isSectionActive = (hash) => {
    if (!isPublic) return false
    if (location.pathname !== '/') return false

    if (activeSection !== undefined && activeSection !== null) {
      return activeSection === hash
    }

    return location.hash === hash || (!location.hash && hash === '')
  }

  return (
    <header className={getHeaderClassName(isPublic, currentUser)}>
      <div className="header-container container">
        <Link to="/" className="logo">
          <img src={theme === 'light' ? '/assets/logo-dark.svg' : '/assets/logo.svg'} alt={t('common.appNameShort')} className="logo-image" />
        </Link>

        <nav className="nav">
          <ul className="nav-list">
            <NavItems
              isPublic={isPublic}
              isAdmin={isAdmin}
              currentUser={currentUser}
              checkAdmin={checkAdmin}
              location={location}
              isSectionActive={isSectionActive}
              isActive={isActive}
              t={t}
            />
          </ul>
        </nav>

        <div className="header-actions">
          {/* View switcher for admins */}
          {!isPublic && checkAdmin() && <ViewSwitchLink isAdmin={isAdmin} t={t} />}

          {currentUser && <NotificationBell userId={currentUser.uid} />}

          {/* Language toggle - single button that cycles */}
          <LanguageButton currentLanguage={currentLanguage} toggleLanguage={toggleLanguage} />

          {/* Theme toggle */}
          <ThemeToggleButton theme={theme} toggleTheme={toggleTheme} t={t} />

          {/* User area */}
          <UserArea
            isPublic={isPublic}
            isAdmin={isAdmin}
            currentUser={currentUser}
            userProfile={userProfile}
            profilePath={profilePath}
            checkAdmin={checkAdmin}
            menuRef={userMenuRef}
            isUserMenuOpen={isUserMenuOpen}
            setIsUserMenuOpen={setIsUserMenuOpen}
            handleLogout={handleLogout}
            t={t}
          />
        </div>
      </div>
    </header>
  )
}

export default Header
