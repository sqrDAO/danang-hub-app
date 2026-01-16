import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import './Login.css'

// Icon components
const UserIcon = () => (
  <svg className="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
)

const MailIcon = () => (
  <svg className="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="4" width="20" height="16" rx="2" />
    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
  </svg>
)

const LockIcon = () => (
  <svg className="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
)

const BlockchainIcon = () => (
  <svg className="logo-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="7" width="6" height="6" rx="1" />
    <rect x="16" y="7" width="6" height="6" rx="1" />
    <rect x="9" y="2" width="6" height="6" rx="1" />
    <rect x="9" y="16" width="6" height="6" rx="1" />
    <path d="M5 13v2a2 2 0 0 0 2 2h3" />
    <path d="M19 13v2a2 2 0 0 1-2 2h-3" />
    <path d="M12 8v8" />
  </svg>
)

const Login = () => {
  const { 
    currentUser, 
    userProfile, 
    signInWithGoogle, 
    signUpWithEmail, 
    signInWithEmail, 
    resetPassword,
    loading, 
    isAdmin 
  } = useAuth()
  const navigate = useNavigate()
  
  const [isSignUp, setIsSignUp] = useState(false)
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    displayName: ''
  })
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (currentUser && !loading && userProfile) {
      if (isAdmin()) {
        navigate('/admin', { replace: true })
      } else {
        navigate('/member', { replace: true })
      }
    }
  }, [currentUser, userProfile, loading, navigate, isAdmin])

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    setError('')
  }

  const validateForm = () => {
    if (!formData.email || !formData.password) {
      setError('Email and password are required')
      return false
    }

    if (!formData.email.includes('@')) {
      setError('Please enter a valid email address')
      return false
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters')
      return false
    }

    if (isSignUp) {
      if (!formData.displayName.trim()) {
        setError('Full name is required')
        return false
      }
      if (formData.password !== formData.confirmPassword) {
        setError('Passwords do not match')
        return false
      }
    }

    return true
  }

  const handleEmailAuth = async (e) => {
    e.preventDefault()
    
    if (!validateForm()) return

    setSubmitting(true)
    setError('')

    try {
      if (isSignUp) {
        await signUpWithEmail(formData.email, formData.password, formData.displayName.trim())
      } else {
        await signInWithEmail(formData.email, formData.password)
      }
    } catch (error) {
      const errorMessages = {
        'auth/email-already-in-use': 'This email is already registered. Please sign in instead.',
        'auth/invalid-email': 'Invalid email address.',
        'auth/operation-not-allowed': 'Email/password sign-in is not enabled.',
        'auth/weak-password': 'Password is too weak. Please use a stronger password.',
        'auth/user-disabled': 'This account has been disabled.',
        'auth/user-not-found': 'No account found with this email. Please sign up.',
        'auth/wrong-password': 'Incorrect password. Please try again.',
        'auth/invalid-credential': 'Invalid email or password. Please try again.',
        'auth/too-many-requests': 'Too many failed attempts. Please try again later.',
      }
      setError(errorMessages[error.code] || 'An error occurred. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleGoogleSignIn = async () => {
    try {
      setError('')
      await signInWithGoogle()
    } catch (error) {
      console.error('Sign in error:', error)
      setError('Failed to sign in with Google. Please try again.')
    }
  }

  const handleForgotPassword = async (e) => {
    e.preventDefault()
    
    if (!formData.email) {
      setError('Please enter your email address')
      return
    }

    if (!formData.email.includes('@')) {
      setError('Please enter a valid email address')
      return
    }

    setSubmitting(true)
    setError('')

    try {
      await resetPassword(formData.email)
      setMessage('Password reset email sent! Check your inbox.')
    } catch (error) {
      const errorMessages = {
        'auth/user-not-found': 'No account found with this email.',
        'auth/invalid-email': 'Invalid email address.',
        'auth/too-many-requests': 'Too many requests. Please try again later.',
      }
      setError(errorMessages[error.code] || 'Failed to send reset email. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const toggleMode = () => {
    setIsSignUp(!isSignUp)
    setError('')
    setMessage('')
    setFormData({
      email: '',
      password: '',
      confirmPassword: '',
      displayName: ''
    })
  }

  if (loading) {
    return (
      <div className="login-container">
        <div className="spinner"></div>
      </div>
    )
  }

  // Forgot Password View
  if (showForgotPassword) {
    return (
      <div className="login-container">
        <div className="login-card">
          <div className="login-logo">
            <BlockchainIcon />
          </div>
          <div className="login-header">
            <h1 className="gradient-text">Reset Password</h1>
            <p className="login-subtitle">Enter your email to receive a reset link</p>
          </div>
          
          <form className="login-form" onSubmit={handleForgotPassword}>
            {error && <div className="auth-error">{error}</div>}
            {message && <div className="auth-success">{message}</div>}
            
            <div className="form-group">
              <label htmlFor="email">Email Address</label>
              <div className="input-wrapper">
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="you@example.com"
                  autoComplete="email"
                />
                <MailIcon />
              </div>
            </div>

            <button 
              type="submit"
              className="btn btn-primary login-button"
              disabled={submitting}
            >
              {submitting ? 'Sending...' : 'Send Reset Link'}
            </button>
          </form>

          <div className="auth-footer">
            <button 
              className="auth-link"
              onClick={() => {
                setShowForgotPassword(false)
                setError('')
                setMessage('')
              }}
            >
              ← Back to Sign In
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-logo">
          <BlockchainIcon />
        </div>
        <div className="login-header">
          <h1 className="gradient-text">
            {isSignUp ? 'Create Account' : 'Welcome Back'}
          </h1>
          <p className="login-subtitle">
            {isSignUp 
              ? 'Join the Danang Blockchain Hub community' 
              : 'Sign in to access your dashboard'}
          </p>
        </div>
        
        <form className="login-form" onSubmit={handleEmailAuth}>
          {error && <div className="auth-error">{error}</div>}
          {message && <div className="auth-success">{message}</div>}
          
          {isSignUp && (
            <div className="form-group">
              <label htmlFor="displayName">Full Name</label>
              <div className="input-wrapper">
                <input
                  type="text"
                  id="displayName"
                  name="displayName"
                  value={formData.displayName}
                  onChange={handleInputChange}
                  placeholder="John Doe"
                  autoComplete="name"
                />
                <UserIcon />
              </div>
            </div>
          )}

          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <div className="input-wrapper">
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="you@example.com"
                autoComplete="email"
              />
              <MailIcon />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <div className="input-wrapper">
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                placeholder="••••••••"
                autoComplete={isSignUp ? 'new-password' : 'current-password'}
              />
              <LockIcon />
            </div>
          </div>

          {isSignUp && (
            <div className="form-group">
              <label htmlFor="confirmPassword">Confirm Password</label>
              <div className="input-wrapper">
                <input
                  type="password"
                  id="confirmPassword"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  placeholder="••••••••"
                  autoComplete="new-password"
                />
                <LockIcon />
              </div>
            </div>
          )}

          {!isSignUp && (
            <div className="forgot-password-link">
              <button 
                type="button"
                className="auth-link"
                onClick={() => setShowForgotPassword(true)}
              >
                Forgot password?
              </button>
            </div>
          )}

          <button 
            type="submit"
            className="btn btn-primary login-button"
            disabled={submitting}
          >
            {submitting ? 'Please wait...' : (isSignUp ? 'Create Account' : 'Sign In')}
          </button>
        </form>

        <div className="auth-divider">
          <span>or continue with</span>
        </div>

        <button 
          className="btn login-button google-button"
          onClick={handleGoogleSignIn}
          disabled={loading || submitting}
        >
          <svg width="20" height="20" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Continue with Google
        </button>

        <div className="auth-footer">
          <p>
            {isSignUp ? 'Already have an account?' : "Don't have an account?"}
            {' '}
            <button className="auth-link" onClick={toggleMode}>
              {isSignUp ? 'Sign In' : 'Sign Up'}
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}

export default Login
