import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const ProtectedRoute = ({ children, requireAdmin = false, requireProfileComplete = false }) => {
  const { currentUser, userProfile, loading, isAdmin, isProfileComplete } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh'
      }}>
        <div className="spinner"></div>
      </div>
    )
  }

  if (!currentUser) {
    return <Navigate to="/login" replace />
  }

  if (requireAdmin && !isAdmin()) {
    return <Navigate to="/member" replace />
  }

  if (requireProfileComplete && !isProfileComplete()) {
    const profilePath = isAdmin() ? '/admin/profile' : '/member/profile'
    if (location.pathname !== profilePath) {
      return <Navigate to={profilePath} replace state={{ requireProfileComplete: true }} />
    }
  }

  return children
}

export default ProtectedRoute
