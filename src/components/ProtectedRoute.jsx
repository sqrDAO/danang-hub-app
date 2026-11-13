import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

// Where a signed-in user must go first, or null. A new email sign-up verifies
// its email first, then completes its profile.
const firstStopPath = ({ isAdmin, isEmailVerificationPending, isProfileComplete }, requireProfileComplete) => {
  const area = isAdmin() ? '/admin' : '/member'
  if (isEmailVerificationPending()) return `${area}/verify-email`
  if (requireProfileComplete && !isProfileComplete()) return `${area}/profile`
  return null
}

const ProtectedRoute = ({ children, requireAdmin = false, requireProfileComplete = false }) => {
  const auth = useAuth()
  const { currentUser, loading, isAdmin } = auth
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

  const stop = firstStopPath(auth, requireProfileComplete)
  if (stop && location.pathname !== stop) {
    return <Navigate to={stop} replace />
  }

  return children
}

export default ProtectedRoute
