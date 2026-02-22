import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { ThemeProvider } from './contexts/ThemeContext'
import ProtectedRoute from './components/ProtectedRoute'
import Chatbot from './components/Chatbot'
import ToastContainer from './components/Toast'
import Home from './pages/Home'
import Login from './pages/auth/Login'
import AdminDashboard from './pages/admin/Dashboard'
import MemberDashboard from './pages/member/Dashboard'
import AdminMembers from './pages/admin/Members'
import AdminAmenities from './pages/admin/Amenities'
import AdminBookings from './pages/admin/Bookings'
import AdminEvents from './pages/admin/Events'
import MemberBookings from './pages/member/Bookings'
import MemberEvents from './pages/member/Events'
import MemberProfile from './pages/member/Profile'

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
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
        <Chatbot />
        <ToastContainer />
      </AuthProvider>
    </ThemeProvider>
  )
}

export default App
