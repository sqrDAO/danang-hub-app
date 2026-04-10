import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import Avatar from './Avatar'
import './Header.css'

const Header = ({ isAdmin = false, public: isPublic = false }) => {
  const { currentUser, userProfile, logout, isAdmin: checkAdmin } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const location = useLocation()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [activeSection, setActiveSection] = useState('')
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  const userMenuRef = useRef(null)
  const { t, i18n } = useTranslation()

  const currentLanguage = i18n.language && i18n.language.startsWith('vi') ? 'vi' : 'en'

  const toggleLanguage = () => {
    i18n.changeLanguage(currentLanguage === 'en' ? 'vi' : 'en')
  }

  const handleLogout = async () => {
    try {
      setIsUserMenuOpen(false)
      await logout()
      navigate(isPublic ? '/' : '/login')
      setIsMobileMenuOpen(false)
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  const basePath = isPublic ? '/' : isAdmin ? '/admin' : '/member'
  const profilePath = isAdmin ? '/admin/profile' : '/member/profile'

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen)
  }

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false)
  }

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

  const NavLink = ({ to, children }) => {
    const active = isActive(to)
    return (
      <li>
        <Link 
          to={to} 
          onClick={closeMobileMenu}
          className={active ? 'active' : ''}
        >
          {children}
        </Link>
      </li>
    )
  }

  return (
    <header className="header">
      <div className="header-container container">
        <Link to="/" className="logo" onClick={closeMobileMenu}>
          <img src={theme === 'light' ? '/assets/logo-dark.svg' : '/assets/logo.svg'} alt={t('common.appNameShort')} className="logo-image" />
          <h2 className="gradient-text">{t('common.appNameShort')}</h2>
        </Link>
        
        <nav className="nav">
          <ul className="nav-list">
            {isPublic ? (
              <>
                <li>
                  <Link
                    to="/"
                    onClick={(e) => {
                      closeMobileMenu()
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
                    onClick={closeMobileMenu}
                    className={isSectionActive('#amenities') ? 'active' : ''}
                  >
                    {t('nav.amenities')}
                  </a>
                </li>
                <li>
                  <a
                    href="#events"
                    onClick={closeMobileMenu}
                    className={isSectionActive('#events') ? 'active' : ''}
                  >
                    {t('nav.events')}
                  </a>
                </li>
                {currentUser && checkAdmin() && (
                  <li>
                    <Link
                      to="/admin"
                      onClick={closeMobileMenu}
                      className={location.pathname.startsWith('/admin') ? 'active' : ''}
                    >
                      {t('nav.admin')}
                    </Link>
                  </li>
                )}
              </>
            ) : isAdmin ? (
              <>
                <NavLink to="/admin">{t('nav.dashboard')}</NavLink>
                <NavLink to="/admin/members">{t('nav.members')}</NavLink>
                <NavLink to="/admin/amenities">{t('nav.amenities')}</NavLink>
                <NavLink to="/admin/bookings">{t('nav.bookings')}</NavLink>
                <NavLink to="/admin/events">{t('nav.events')}</NavLink>
              </>
            ) : (
              <>
                <NavLink to="/member">{t('nav.dashboard')}</NavLink>
                <NavLink to="/member/bookings">{t('nav.myBookings')}</NavLink>
                <NavLink to="/member/events">{t('nav.events')}</NavLink>
              </>
            )}
          </ul>
        </nav>

        <div className="header-actions">
          {/* View switcher for admins */}
          {!isPublic && checkAdmin() && (
            <Link
              to={isAdmin ? '/member' : '/admin'}
              className="view-switch-btn"
              title={isAdmin ? t('nav.memberView') : t('nav.adminView')}
            >
              {isAdmin ? (
                <svg className="header-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
              ) : (
                <svg className="header-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
              )}
              <span className="view-switch-label">{isAdmin ? t('nav.memberView') : t('nav.adminView')}</span>
            </Link>
          )}

          {/* Language toggle - single button that cycles */}
          <button
            type="button"
            className="header-icon-btn"
            onClick={toggleLanguage}
            aria-label={currentLanguage === 'en' ? 'Switch to Vietnamese' : 'Switch to English'}
            title={currentLanguage === 'en' ? 'Tiếng Việt' : 'English'}
          >
            <span className="lang-label">{currentLanguage === 'en' ? 'EN' : 'VI'}</span>
          </button>

          {/* Theme toggle */}
          <button
            type="button"
            className="header-icon-btn"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? t('common.lightMode') : t('common.darkMode')}
          >
            {theme === 'dark' ? (
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
            ) : (
              <svg className="header-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
          </button>

          {/* User area */}
          {isPublic ? (
            !currentUser ? (
              <Link to="/login" className="btn btn-primary btn-header">
                {t('common.login')}
              </Link>
            ) : (
              <div className="user-menu-wrap" ref={userMenuRef}>
                <button
                  type="button"
                  className="user-menu-trigger"
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  aria-label={t('nav.profile')}
                >
                  <Avatar 
                    src={userProfile?.photoURL} 
                    name={userProfile?.displayName}
                    size="md"
                  />
                </button>
                {isUserMenuOpen && (
                  <div className="user-dropdown">
                    {userProfile && (
                      <div className="user-dropdown-header">
                        <span className="user-dropdown-name">{userProfile.displayName}</span>
                        <span className="user-dropdown-email">{userProfile.email}</span>
                      </div>
                    )}
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
          ) : (
            <div className="user-menu-wrap" ref={userMenuRef}>
              <button
                type="button"
                className="user-menu-trigger"
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                aria-label={t('nav.profile')}
              >
                <Avatar 
                  src={userProfile?.photoURL} 
                  name={userProfile?.displayName}
                  size="md"
                />
              </button>
              {isUserMenuOpen && (
                <div className="user-dropdown">
                  {userProfile && (
                    <div className="user-dropdown-header">
                      <span className="user-dropdown-name">{userProfile.displayName}</span>
                      <span className="user-dropdown-email">{userProfile.email}</span>
                    </div>
                  )}
                  <Link
                    to={profilePath}
                    className="user-dropdown-item"
                    onClick={() => setIsUserMenuOpen(false)}
                  >
                    {t('nav.profile')}
                  </Link>
                  <button className="user-dropdown-item user-dropdown-logout" onClick={handleLogout}>
                    {t('common.logout')}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <button 
          className="mobile-menu-toggle"
          onClick={toggleMobileMenu}
          aria-label="Toggle menu"
        >
          <span className={`hamburger ${isMobileMenuOpen ? 'open' : ''}`}>
            <span></span>
            <span></span>
            <span></span>
          </span>
        </button>
      </div>

      <div className={`mobile-nav-overlay ${isMobileMenuOpen ? 'open' : ''}`} onClick={closeMobileMenu}></div>
      
      <nav className={`mobile-nav ${isMobileMenuOpen ? 'open' : ''}`}>
        <div className="mobile-nav-header">
          {userProfile && (
            <Link
              to={isPublic ? (checkAdmin() ? '/admin/profile' : '/member/profile') : profilePath}
              className="mobile-user-info mobile-user-info-link"
              onClick={closeMobileMenu}
              aria-label={t('nav.profile')}
            >
              <Avatar 
                src={userProfile.photoURL} 
                name={userProfile.displayName}
                size="lg"
              />
              <div className="mobile-user-details">
                <div className="mobile-user-name">{userProfile.displayName}</div>
                <div className="mobile-user-email">{userProfile.email}</div>
              </div>
            </Link>
          )}
        </div>
        <ul className="mobile-nav-list">
          {isPublic ? (
            <>
              <li><Link to="/" onClick={(e) => { closeMobileMenu(); if (location.pathname === '/') { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); } }} className={isSectionActive('') && location.pathname === '/' ? 'active' : ''}>{t('nav.home')}</Link></li>
              <li><a href="#amenities" onClick={closeMobileMenu} className={isSectionActive('#amenities') ? 'active' : ''}>{t('nav.amenities')}</a></li>
              <li><a href="#events" onClick={closeMobileMenu} className={isSectionActive('#events') ? 'active' : ''}>{t('nav.events')}</a></li>
              {currentUser && checkAdmin() && (
                <li><Link to="/admin" onClick={closeMobileMenu} className={location.pathname.startsWith('/admin') ? 'active' : ''}>{t('nav.admin')}</Link></li>
              )}
            </>
          ) : isAdmin ? (
            <>
              <NavLink to="/admin">{t('nav.dashboard')}</NavLink>
              <NavLink to="/admin/members">{t('nav.members')}</NavLink>
              <NavLink to="/admin/amenities">{t('nav.amenities')}</NavLink>
              <NavLink to="/admin/bookings">{t('nav.bookings')}</NavLink>
              <NavLink to="/admin/events">{t('nav.events')}</NavLink>
            </>
          ) : (
            <>
              <NavLink to="/member">{t('nav.dashboard')}</NavLink>
              <NavLink to="/member/bookings">{t('nav.myBookings')}</NavLink>
              <NavLink to="/member/events">{t('nav.events')}</NavLink>
            </>
          )}
        </ul>
        <div className="mobile-nav-footer">
          <div className="mobile-footer-row">
            <button
              type="button"
              className="mobile-footer-btn"
              onClick={() => { toggleLanguage(); closeMobileMenu() }}
            >
              <svg className="header-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
                <circle cx="12" cy="12" r="10"/>
                <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
              </svg>
              <span>{currentLanguage === 'en' ? 'English' : 'Tiếng Việt'}</span>
            </button>
            <button
              type="button"
              className="mobile-footer-btn"
              onClick={() => { toggleTheme(); closeMobileMenu() }}
            >
              {theme === 'dark' ? (
                <svg className="header-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
              ) : (
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
              )}
              <span>{theme === 'dark' ? t('common.darkMode') : t('common.lightMode')}</span>
            </button>
          </div>
          {!isPublic && checkAdmin() && (
            <Link
              to={isAdmin ? '/member' : '/admin'}
              className="mobile-footer-btn"
              onClick={closeMobileMenu}
            >
              {isAdmin ? (
                <svg className="header-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
              ) : (
                <svg className="header-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
              )}
              <span>{isAdmin ? t('nav.memberView') : t('nav.adminView')}</span>
            </Link>
          )}
          {isPublic ? (
            !currentUser ? (
              <Link to="/login" className="btn btn-primary btn-full-width" onClick={closeMobileMenu}>
                {t('common.login')}
              </Link>
            ) : (
              <button className="btn btn-secondary btn-full-width" onClick={handleLogout}>
                {t('common.logout')}
              </button>
            )
          ) : (
            <button className="btn btn-secondary btn-full-width" onClick={handleLogout}>
              {t('common.logout')}
            </button>
          )}
        </div>
      </nav>
    </header>
  )
}

export default Header
