import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import './Header.css'

const Header = ({ isAdmin = false }) => {
  const { userProfile, logout, isAdmin: checkAdmin } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    try {
      await logout()
      navigate('/login')
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  const basePath = isAdmin ? '/admin' : '/member'

  return (
    <header className="header">
      <div className="header-container container">
        <Link to={basePath} className="logo">
          <img src="/assets/logo.svg" alt="Danang Hub" className="logo-image" />
          <h2 className="gradient-text">Danang Hub</h2>
        </Link>
        
        <nav className="nav">
          <ul className="nav-list">
            {isAdmin ? (
              <>
                <li><Link to="/admin">Dashboard</Link></li>
                <li><Link to="/admin/members">Members</Link></li>
                <li><Link to="/admin/amenities">Amenities</Link></li>
                <li><Link to="/admin/bookings">Bookings</Link></li>
                <li><Link to="/admin/events">Events</Link></li>
              </>
            ) : (
              <>
                <li><Link to="/member">Dashboard</Link></li>
                <li><Link to="/member/bookings">My Bookings</Link></li>
                <li><Link to="/member/events">Events</Link></li>
                <li><Link to="/member/profile">Profile</Link></li>
              </>
            )}
          </ul>
        </nav>

        <div className="header-user">
          {userProfile && (
            <div className="user-info">
              <img 
                src={userProfile.photoURL || '/default-avatar.png'} 
                alt={userProfile.displayName}
                className="user-avatar"
              />
              <span className="user-name">{userProfile.displayName}</span>
            </div>
          )}
          <button className="btn btn-secondary" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </div>
    </header>
  )
}

export default Header
