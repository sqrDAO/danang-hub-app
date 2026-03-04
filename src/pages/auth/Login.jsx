import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../contexts/AuthContext'
import { discoverEIP6963Wallets, discoverSolanaWallets } from '../../services/walletAuth'
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

const EthereumIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <path d="M10 2L4 10.2L10 13.5L16 10.2Z" fill="#627eea"/>
    <path d="M10 2L16 10.2L10 13.5Z" fill="#8ea4f1"/>
    <path d="M4 11.5L10 18L16 11.5L10 14.8Z" fill="#627eea"/>
    <path d="M10 14.8L16 11.5L10 18Z" fill="#8ea4f1"/>
  </svg>
)

const SolanaIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <path d="M3 14.5h11.5l2.5-2.5H5.5z" fill="#14f195" />
    <path d="M3 10.5h11.5l2.5-2.5H5.5z" fill="#9945ff" opacity="0.85" />
    <path d="M3 6.5h11.5l2.5-2.5H5.5z" fill="#9945ff" />
  </svg>
)

// Maximum password length constant
const MAX_PASSWORD_LENGTH = 128

const Login = () => {
  const {
    currentUser,
    userProfile,
    signInWithGoogle,
    signUpWithEmail,
    signInWithEmail,
    signInWithEVMWallet,
    signInWithSolana,
    resetPassword,
    loading,
    isAdmin
  } = useAuth()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  
  const [isSignUp, setIsSignUp] = useState(false)
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [evmWallets, setEvmWallets] = useState([])
  const [showWalletPicker, setShowWalletPicker] = useState(false)
  const [solanaWallets, setSolanaWallets] = useState([])
  const [showSolanaWalletPicker, setShowSolanaWalletPicker] = useState(false)
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    displayName: ''
  })
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Check for signup query parameter on mount
  useEffect(() => {
    const signupParam = searchParams.get('signup')
    if (signupParam === 'true') {
      setIsSignUp(true)
    }
  }, [searchParams])

  useEffect(() => {
    if (currentUser && !loading && userProfile) {
      // Check for redirect parameter first
      const redirectParam = searchParams.get('redirect')
      if (redirectParam) {
        // Preserve query parameters from redirect
        const amenityId = searchParams.get('amenityId')
        const eventId = searchParams.get('eventId')
        const action = searchParams.get('action')
        
        let redirectUrl = redirectParam
        const params = new URLSearchParams()
        if (amenityId) params.set('amenityId', amenityId)
        if (eventId) params.set('eventId', eventId)
        if (action) params.set('action', action)
        
        const queryString = params.toString()
        if (queryString) {
          redirectUrl += `?${queryString}`
        }
        
        navigate(redirectUrl, { replace: true })
      } else if (isAdmin()) {
        navigate('/admin', { replace: true })
      } else {
        navigate('/member', { replace: true })
      }
    }
  }, [currentUser, userProfile, loading, navigate, isAdmin, searchParams])

  const handleInputChange = (e) => {
    const { name, value } = e.target
    
    // Enforce maximum password length
    if ((name === 'password' || name === 'confirmPassword') && value.length > MAX_PASSWORD_LENGTH) {
      setError(t('auth.errors.passwordMaxLength', { max: MAX_PASSWORD_LENGTH }))
      return
    }
    
    setFormData(prev => ({ ...prev, [name]: value }))
    setError('')
  }

  const handleKeyDown = (e) => {
    // Submit form when Enter is pressed on password or confirmPassword fields
    if (e.key === 'Enter' && !submitting) {
      e.preventDefault()
      const form = e.target.closest('form')
      if (form) {
        form.requestSubmit()
      }
    }
  }

  const validateForm = () => {
    if (!formData.email || !formData.password) {
      setError(t('auth.errors.emailAndPasswordRequired'))
      return false
    }

    if (!formData.email.includes('@')) {
      setError(t('auth.errors.invalidEmail'))
      return false
    }

    if (formData.password.length < 6) {
      setError(t('auth.errors.passwordMinLength'))
      return false
    }

    if (formData.password.length > MAX_PASSWORD_LENGTH) {
      setError(t('auth.errors.passwordMaxLength', { max: MAX_PASSWORD_LENGTH }))
      return false
    }

    if (isSignUp) {
      if (formData.confirmPassword.length > MAX_PASSWORD_LENGTH) {
        setError(t('auth.errors.passwordMaxLength', { max: MAX_PASSWORD_LENGTH }))
        return false
      }
      if (!formData.displayName.trim()) {
        setError(t('auth.errors.displayNameRequired'))
        return false
      }
      if (formData.password !== formData.confirmPassword) {
        setError(t('auth.errors.passwordMismatch'))
        return false
      }
    }

    return true
  }

  const handleEmailAuth = async (e) => {
    e.preventDefault()
    
    // Prevent multiple simultaneous submissions
    if (submitting) return
    
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
        'auth/email-already-in-use': t('auth.errors.emailAlreadyInUse'),
        'auth/invalid-email': t('auth.errors.invalidEmailAddress'),
        'auth/operation-not-allowed': t('auth.errors.operationNotAllowed'),
        'auth/weak-password': t('auth.errors.weakPassword'),
        'auth/user-disabled': t('auth.errors.userDisabled'),
        'auth/user-not-found': t('auth.errors.userNotFound'),
        'auth/wrong-password': t('auth.errors.wrongPassword'),
        'auth/invalid-credential': t('auth.errors.invalidCredential'),
        'auth/too-many-requests': t('auth.errors.tooManyRequests'),
      }
      setError(errorMessages[error.code] || t('auth.errors.generic'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleGoogleSignIn = async () => {
    // Prevent multiple simultaneous submissions
    if (submitting || loading) return
    
    setSubmitting(true)
    setError('')

    try {
      await signInWithGoogle()
    } catch (error) {
      console.error('Sign in error:', error)
      setError(t('auth.errors.googleSignInFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleEVMWalletClick = async () => {
    if (submitting || loading) return
    setError('')
    setShowWalletPicker(false)
    setShowSolanaWalletPicker(false)

    let wallets
    try {
      wallets = await discoverEIP6963Wallets()
    } catch {
      setError(t('auth.errors.evmDetectFailed'))
      return
    }

    if (wallets.length === 0) {
      setError(t('auth.errors.noEvmWallet'))
      return
    }

    if (wallets.length === 1) {
      await handleSelectWallet(wallets[0])
      return
    }

    setEvmWallets(wallets)
    setShowWalletPicker(true)
  }

  const handleSelectWallet = async (wallet) => {
    if (submitting || loading) return
    setShowWalletPicker(false)
    setSubmitting(true)
    setError('')

    try {
      const accounts = await wallet.provider.request({ method: 'eth_requestAccounts' })
      const address = accounts[0]
      await signInWithEVMWallet(wallet.provider, address)
    } catch (error) {
      if (error.code === 4001) {
        setError(t('auth.errors.walletRejected'))
      } else {
        setError(t('auth.errors.walletConnectFailed'))
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleSolanaWalletClick = async () => {
    if (submitting || loading) return
    setError('')
    setShowSolanaWalletPicker(false)
    setShowWalletPicker(false)

    let wallets
    try {
      wallets = await discoverSolanaWallets()
    } catch {
      setError(t('auth.errors.solanaDetectFailed'))
      return
    }

    if (wallets.length === 0) {
      setError(t('auth.errors.noSolanaWallet'))
      return
    }

    if (wallets.length === 1) {
      await handleSelectSolanaWallet(wallets[0])
      return
    }

    setSolanaWallets(wallets)
    setShowSolanaWalletPicker(true)
  }

  const handleSelectSolanaWallet = async (wallet) => {
    if (submitting || loading) return
    setShowSolanaWalletPicker(false)
    setSubmitting(true)
    setError('')

    try {
      await signInWithSolana(wallet)
    } catch (error) {
      if (error.code === 4001) {
        setError(t('auth.errors.walletRejected'))
      } else {
        setError(t('auth.errors.walletConnectFailed'))
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleForgotPassword = async (e) => {
    e.preventDefault()
    
    // Prevent multiple simultaneous submissions
    if (submitting) return
    
    if (!formData.email) {
      setError(t('auth.errors.passwordResetEmailRequired'))
      return
    }

    if (!formData.email.includes('@')) {
      setError(t('auth.errors.passwordResetInvalidEmail'))
      return
    }

    setSubmitting(true)
    setError('')

    try {
      await resetPassword(formData.email)
      setMessage(t('auth.resetEmailSent'))
    } catch (error) {
      const errorMessages = {
        'auth/user-not-found': t('auth.errors.resetUserNotFound'),
        'auth/invalid-email': t('auth.errors.resetInvalidEmail'),
        'auth/too-many-requests': t('auth.errors.resetTooManyRequests'),
      }
      setError(errorMessages[error.code] || t('auth.errors.resetGeneric'))
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
          <img src="/assets/logo.svg" alt="Da Nang Blockchain Hub Portal" />
        </div>
        <div className="login-header">
          <h1 className="gradient-text">{t('auth.resetPasswordTitle')}</h1>
            <p className="login-subtitle">{t('auth.resetPasswordSubtitle')}</p>
          </div>
          
          <form className="login-form" onSubmit={handleForgotPassword}>
            {error && <div className="auth-error">{error}</div>}
            {message && <div className="auth-success">{message}</div>}
            
            <div className="form-group">
              <label htmlFor="email">{t('auth.email')}</label>
              <div className="input-wrapper">
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  placeholder={t('auth.emailPlaceholder')}
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
              {submitting ? t('auth.sending') : t('auth.sendResetLink')}
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
              {t('auth.backToSignIn')}
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
          <img src="/assets/logo.svg" alt="Da Nang Blockchain Hub Portal" />
        </div>
        <div className="login-header">
          <h1 className="gradient-text">
            {isSignUp ? t('auth.createAccountTitle') : t('auth.welcomeBack')}
          </h1>
          <p className="login-subtitle">
            {isSignUp ? t('auth.signupSubtitle') : t('auth.loginSubtitle')}
          </p>
        </div>

        {error && <div className="auth-error">{error}</div>}
        {message && <div className="auth-success">{message}</div>}

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
          {t('auth.continueWithGoogle')}
        </button>

        <div className="auth-divider">
          <span>{t('auth.orSignInWithWallet')}</span>
        </div>

        <button
          className="btn login-button evm-wallet-button"
          onClick={handleEVMWalletClick}
          disabled={loading || submitting}
        >
          <EthereumIcon />
          {t('auth.ethereumWallet')}
        </button>

        <button
          className="btn login-button solana-button"
          onClick={handleSolanaWalletClick}
          disabled={loading || submitting}
        >
          <SolanaIcon />
          {t('auth.solanaWallet')}
        </button>

        {showWalletPicker && (
          <div className="wallet-picker">
            {evmWallets.map((wallet) => (
              <button
                key={wallet.info.uuid}
                className="wallet-option"
                onClick={() => handleSelectWallet(wallet)}
              >
                <img src={wallet.info.icon} alt={wallet.info.name} width={24} height={24} />
                {wallet.info.name}
              </button>
            ))}
          </div>
        )}

        {showSolanaWalletPicker && (
          <div className="wallet-picker">
            {solanaWallets.map((wallet) => (
              <button
                key={wallet.name}
                className="wallet-option"
                onClick={() => handleSelectSolanaWallet(wallet)}
              >
                {wallet.icon
                  ? <img src={wallet.icon} alt={wallet.name} width={24} height={24} />
                  : <SolanaIcon />
                }
                {wallet.name}
              </button>
            ))}
          </div>
        )}

        <div className="auth-divider">
          <span>{t('auth.orContinueWithEmail')}</span>
        </div>

        <form className="login-form" onSubmit={handleEmailAuth}>
          {isSignUp && (
            <div className="form-group">
              <label htmlFor="displayName">{t('auth.fullName')}</label>
              <div className="input-wrapper">
                <input
                  type="text"
                  id="displayName"
                  name="displayName"
                  value={formData.displayName}
                  onChange={handleInputChange}
                  placeholder={t('auth.fullNamePlaceholder')}
                  autoComplete="name"
                />
                <UserIcon />
              </div>
            </div>
          )}

          <div className="form-group">
            <label htmlFor="email">{t('auth.email')}</label>
            <div className="input-wrapper">
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder={t('auth.emailPlaceholder')}
                autoComplete="email"
              />
              <MailIcon />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="password">{t('auth.password')}</label>
            <div className="input-wrapper">
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="••••••••"
                autoComplete={isSignUp ? 'new-password' : 'current-password'}
                maxLength={MAX_PASSWORD_LENGTH}
              />
              <LockIcon />
            </div>
          </div>

          {isSignUp && (
            <div className="form-group">
              <label htmlFor="confirmPassword">{t('auth.confirmPassword')}</label>
              <div className="input-wrapper">
                <input
                  type="password"
                  id="confirmPassword"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  maxLength={MAX_PASSWORD_LENGTH}
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
                {t('auth.forgotPassword')}
              </button>
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary login-button"
            disabled={submitting}
          >
            {submitting ? t('auth.pleaseWait') : (isSignUp ? t('auth.createAccountTitle') : t('auth.signIn'))}
          </button>
        </form>

        <div className="auth-footer">
          <p>
            {isSignUp ? t('auth.alreadyHaveAccount') : t('auth.dontHaveAccount')}
            {' '}
            <button className="auth-link" onClick={toggleMode}>
              {isSignUp ? t('auth.signIn') : t('auth.signUp')}
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}

export default Login
