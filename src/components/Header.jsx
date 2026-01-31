import { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import Avatar from './Avatar'
import './Header.css'

const Header = ({ isAdmin = false, public: isPublic = false }) => {
  const { currentUser, userProfile, logout, isAdmin: checkAdmin } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [activeSection, setActiveSection] = useState('')

  const handleLogout = async () => {
    try {
      await logout()
      navigate(isPublic ? '/' : '/login')
      setIsMobileMenuOpen(false)
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  const basePath = isPublic ? '/' : isAdmin ? '/admin' : '/member'

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen)
  }

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false)
  }

  // Track active section based on scroll position
  useEffect(() => {
    if (!isPublic || location.pathname !== '/') {
      setActiveSection('')
      return
    }

    // Update active section from hash on mount or hash change
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
        const scrollPosition = window.scrollY + 150 // Header height + margin
        let currentSection = ''
        
        // Check sections from bottom to top to find the first one we've scrolled past
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
        
        // If we're at the very top, set to hero/home
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

    // Intersection Observer for more accurate detection
    const observerOptions = {
      root: null,
      rootMargin: '-120px 0px -60% 0px', // Trigger when section is in view near top
      threshold: [0, 0.1, 0.5, 1]
    }

    const observerCallback = (entries) => {
      // Find the section with the highest intersection ratio that's intersecting
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

    // Observe all sections
    sections.forEach(sectionId => {
      const element = document.getElementById(sectionId)
      if (element) {
        observer.observe(element)
      }
    })

    window.addEventListener('scroll', checkActiveSection, { passive: true })
    
    // Initial check
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
    
    // If we have an activeSection from scroll tracking, use it
    if (activeSection !== undefined && activeSection !== null) {
      return activeSection === hash
    }
    
    // Fallback to location.hash
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
        <Link to={basePath} className="logo" onClick={closeMobileMenu}>
          <img src="/assets/logo.svg" alt="Hub Portal" className="logo-image" />
          <h2 className="gradient-text">Hub Portal</h2>
        </Link>
        
        <nav className="nav">
          <ul className="nav-list">
            {isPublic ? (
              <>
                <li><Link to="/" onClick={(e) => { closeMobileMenu(); if (location.pathname === '/') { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); } }} className={isSectionActive('') ? 'active' : ''}>Home</Link></li>
                <li><a href="#amenities" onClick={closeMobileMenu} className={isSectionActive('#amenities') ? 'active' : ''}>Amenities</a></li>
                <li><a href="#events" onClick={closeMobileMenu} className={isSectionActive('#events') ? 'active' : ''}>Events</a></li>
              </>
            ) : isAdmin ? (
              <>
                <NavLink to="/admin">Dashboard</NavLink>
                <NavLink to="/admin/members">Members</NavLink>
                <NavLink to="/admin/amenities">Amenities</NavLink>
                <NavLink to="/admin/bookings">Bookings</NavLink>
                <NavLink to="/admin/events">Events</NavLink>
              </>
            ) : (
              <>
                <NavLink to="/member">Dashboard</NavLink>
                <NavLink to="/member/bookings">My Bookings</NavLink>
                <NavLink to="/member/events">Events</NavLink>
                <NavLink to="/member/profile">Profile</NavLink>
              </>
            )}
          </ul>
        </nav>

        <div className="header-user">
          {isPublic ? (
            !currentUser ? (
              <Link to="/login" className="btn btn-primary">
                Log In
              </Link>
            ) : (
              <>
                {userProfile && (
                  <div className="user-info">
                    <Avatar 
                      src={userProfile.photoURL} 
                      name={userProfile.displayName}
                      size="md"
                    />
                    <span className="user-name">{userProfile.displayName}</span>
                  </div>
                )}
                <button className="btn btn-secondary" onClick={handleLogout}>
                  Logout
                </button>
              </>
            )
          ) : (
            <>
              {userProfile && (
                <div className="user-info">
                  <Avatar 
                    src={userProfile.photoURL} 
                    name={userProfile.displayName}
                    size="md"
                  />
                  <span className="user-name">{userProfile.displayName}</span>
                </div>
              )}
              <button className="btn btn-secondary" onClick={handleLogout}>
                Logout
              </button>
            </>
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
          {!isPublic && userProfile && (
            <div className="mobile-user-info">
              <Avatar 
                src={userProfile.photoURL} 
                name={userProfile.displayName}
                size="lg"
              />
              <div className="mobile-user-details">
                <div className="mobile-user-name">{userProfile.displayName}</div>
                <div className="mobile-user-email">{userProfile.email}</div>
              </div>
            </div>
          )}
        </div>
        <ul className="mobile-nav-list">
          {isPublic ? (
            <>
              <li><Link to="/" onClick={(e) => { closeMobileMenu(); if (location.pathname === '/') { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); } }} className={isSectionActive('') ? 'active' : ''}>Home</Link></li>
              <li><a href="#amenities" onClick={closeMobileMenu} className={isSectionActive('#amenities') ? 'active' : ''}>Amenities</a></li>
              <li><a href="#events" onClick={closeMobileMenu} className={isSectionActive('#events') ? 'active' : ''}>Events</a></li>
            </>
          ) : isAdmin ? (
            <>
              <NavLink to="/admin">Dashboard</NavLink>
              <NavLink to="/admin/members">Members</NavLink>
              <NavLink to="/admin/amenities">Amenities</NavLink>
              <NavLink to="/admin/bookings">Bookings</NavLink>
              <NavLink to="/admin/events">Events</NavLink>
            </>
          ) : (
            <>
              <NavLink to="/member">Dashboard</NavLink>
              <NavLink to="/member/bookings">My Bookings</NavLink>
              <NavLink to="/member/events">Events</NavLink>
              <NavLink to="/member/profile">Profile</NavLink>
            </>
          )}
        </ul>
        <div className="mobile-nav-footer">
          {isPublic ? (
            !currentUser ? (
              <Link to="/login" className="btn btn-primary btn-full-width" onClick={closeMobileMenu}>
                Log In
              </Link>
            ) : (
              <button className="btn btn-secondary btn-full-width" onClick={handleLogout}>
                Logout
              </button>
            )
          ) : (
            <button className="btn btn-secondary btn-full-width" onClick={handleLogout}>
              Logout
            </button>
          )}
        </div>
      </nav>
    </header>
  )
}

export default Header
