import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Modal from './Modal'
import './AuthPrompt.css'

const AuthPrompt = ({ isOpen, onClose, action = 'book', onLogin, onSignUp }) => {
  const navigate = useNavigate()
  const { t } = useTranslation()

  const handleLogin = () => {
    if (onLogin) {
      onLogin()
    } else {
      navigate('/login')
    }
    onClose()
  }

  const handleSignUp = () => {
    if (onSignUp) {
      onSignUp()
    } else {
      navigate('/login?signup=true')
    }
    onClose()
  }

  const actionKey = {
    book: 'authPrompt.actions.book',
    register: 'authPrompt.actions.register',
    create: 'authPrompt.actions.create'
  }[action] || 'authPrompt.actions.default'

  const actionText = t(actionKey)

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('authPrompt.title')}
    >
      <div className="auth-prompt-content">
        <p className="auth-prompt-message">
          {t('authPrompt.message', { action: actionText })}
        </p>
        <p className="auth-prompt-submessage">
          {t('authPrompt.submessage')}
        </p>
        <div className="auth-prompt-actions">
          <button
            className="btn btn-primary"
            onClick={handleLogin}
          >
            {t('authPrompt.signIn')}
          </button>
          <button
            className="btn btn-secondary"
            onClick={handleSignUp}
          >
            {t('authPrompt.signUp')}
          </button>
        </div>
      </div>
    </Modal>
  )
}

export default AuthPrompt
