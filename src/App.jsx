import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { ThemeProvider } from './contexts/ThemeContext'
import ProtectedRoute from './components/ProtectedRoute'
import ToastContainer from './components/Toast'
import Home from './pages/Home'

// Lazy-loaded routes — these are not the landing path and benefit from code splitting
const Login = lazy(() => import('./pages/auth/Login'))
const AdminDashboard = lazy(() => import('./pages/admin/Dashboard'))
const MemberDashboard = lazy(() => import('./pages/member/Dashboard'))
const AdminMembers = lazy(() => import('./pages/admin/Members'))
const AdminAmenities = lazy(() => import('./pages/admin/Amenities'))
const AdminBookings = lazy(() => import('./pages/admin/Bookings'))
const AdminEvents = lazy(() => import('./pages/admin/Events'))
const MemberBookings = lazy(() => import('./pages/member/Bookings'))
const MemberEvents = lazy(() => import('./pages/member/Events'))
const MemberProfile = lazy(() => import('./pages/member/Profile'))

const RouteFallback = () => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
    <div className="spinner"></div>
  </div>
)

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Suspense fallback={<RouteFallback />}>
        <Routes>
        {/* Public Routes */}
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        
        {/* Admin Routes (require Company + Role for profile completion) */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute requireAdmin requireProfileComplete>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/members"
          element={
            <ProtectedRoute requireAdmin requireProfileComplete>
              <AdminMembers />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/amenities"
          element={
            <ProtectedRoute requireAdmin requireProfileComplete>
              <AdminAmenities />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/bookings"
          element={
            <ProtectedRoute requireAdmin requireProfileComplete>
              <AdminBookings />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/events"
          element={
            <ProtectedRoute requireAdmin requireProfileComplete>
              <AdminEvents />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/profile"
          element={
            <ProtectedRoute requireAdmin>
              <MemberProfile />
            </ProtectedRoute>
          }
        />
        
        {/* Member Routes (require Company + Role for first-time users) */}
        <Route
          path="/member"
          element={
            <ProtectedRoute requireProfileComplete>
              <MemberDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/member/bookings"
          element={
            <ProtectedRoute requireProfileComplete>
              <MemberBookings />
            </ProtectedRoute>
          }
        />
        <Route
          path="/member/events"
          element={
            <ProtectedRoute requireProfileComplete>
              <MemberEvents />
            </ProtectedRoute>
          }
        />
        <Route
          path="/member/profile"
          element={
            <ProtectedRoute>
              <MemberProfile />
            </ProtectedRoute>
          }
        />
        
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
        </Suspense>
        <ToastContainer />
      </AuthProvider>
    </ThemeProvider>
  )
}

export default App
