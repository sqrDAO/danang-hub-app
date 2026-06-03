import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../contexts/AuthContext'
import './BottomNav.css'

const IconHome = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
    <polyline points="9 22 9 12 15 12 15 22"/>
  </svg>
)

const IconCalendar = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2"/>
    <line x1="16" y1="2" x2="16" y2="6"/>
    <line x1="8" y1="2" x2="8" y2="6"/>
    <line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
)

const IconTicket = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v2z"/>
  </svg>
)

const IconUser = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
    <circle cx="12" cy="7" r="4"/>
  </svg>
)

const IconUsers = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
)

const IconBuilding = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="2" width="16" height="20" rx="2"/>
    <path d="M9 22v-4h6v4"/>
    <path d="M8 6h.01M16 6h.01M8 10h.01M16 10h.01M8 14h.01M16 14h.01"/>
  </svg>
)

const BottomNav = () => {
  const { currentUser, isAdmin: checkAdmin } = useAuth()
  const location = useLocation()
  const { t } = useTranslation()

  if (!currentUser) return null

  const isOnMemberRoute = location.pathname.startsWith('/member')
  const isOnAdminRoute = location.pathname.startsWith('/admin')

  const isActive = (path) => {
    if (path === '/admin' || path === '/member') {
      return location.pathname === path
    }
    return location.pathname.startsWith(path)
  }

  const memberTabs = [
    { to: '/member',          label: t('nav.dashboard'),  Icon: IconHome },
    { to: '/member/bookings', label: t('nav.myBookings'), Icon: IconCalendar },
    { to: '/member/events',   label: t('nav.events'),     Icon: IconTicket },
    { to: '/member/profile',  label: t('nav.profile'),    Icon: IconUser },
  ]

  const adminTabs = [
    { to: '/admin',           label: t('nav.dashboard'),  Icon: IconHome },
    { to: '/admin/members',   label: t('nav.members'),    Icon: IconUsers },
    { to: '/admin/amenities', label: t('nav.amenities'),  Icon: IconBuilding },
    { to: '/admin/bookings',  label: t('nav.bookings'),   Icon: IconCalendar },
    { to: '/admin/events',    label: t('nav.events'),     Icon: IconTicket },
  ]

  const tabs = (isOnAdminRoute || (!isOnMemberRoute && checkAdmin())) ? adminTabs : memberTabs

  return (
    <nav className="bottom-nav" aria-label="Main navigation">
      {tabs.map(({ to, label, Icon }) => {
        const active = isActive(to)
        return (
          <Link
            key={to}
            to={to}
            className={`bottom-nav-item${active ? ' active' : ''}`}
            aria-label={label}
            aria-current={active ? 'page' : undefined}
          >
            {active && <span className="bottom-nav-indicator" aria-hidden="true" />}
            <span className="bottom-nav-icon"><Icon /></span>
            <span className="bottom-nav-label">{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}

export default BottomNav
