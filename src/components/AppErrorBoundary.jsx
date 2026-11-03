import { Component } from 'react'
import { withTranslation } from 'react-i18next'

// Last line of defence: without it, any uncaught render error (such as a lazy
// page chunk the latest deploy removed) unmounts the whole app to a white screen.
class AppErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    console.error('[AppErrorBoundary]', error, info?.componentStack)
  }

  render() {
    if (!this.state.hasError) return this.props.children

    const { t } = this.props
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', padding: '16px' }}>
        <div className="glass" role="alert" style={{ padding: '24px', maxWidth: '360px', textAlign: 'center' }}>
          <p style={{ marginBottom: '16px' }}>{t('common.errorReload')}</p>
          <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
            {t('common.reload')}
          </button>
        </div>
      </div>
    )
  }
}

const TranslatedAppErrorBoundary = withTranslation()(AppErrorBoundary)

export default TranslatedAppErrorBoundary
