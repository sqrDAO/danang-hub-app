import { Link, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useAuth } from '../../hooks/useAuth'
import { useTheme } from '../../hooks/useTheme'
import useEmailStatus from '../../hooks/useEmailStatus'
import useSendVerificationLink from '../../hooks/useSendVerificationLink'
import { oauthConsent } from '../../services/mcpTokens'
import { formatCooldown } from '../../utils/emailVerification'
import { consentErrorKind, consentLoginPath, consentPath, isConsentRequestId } from '../../utils/oauthConsent'
import './Consent.css'

// MCP OAuth consent (#263). Outside ProtectedRoute: it does its own sign-in
// and email checks and keeps the request id in its URL, so a member who
// signs in or verifies comes back to this same request. The server
// (POST /oauth/consent-action) re-checks the account (requireUser) and the
// browser binding from /oauth/authorize, and is authoritative.

const ConsentShell = ({ children }) => {
  const { theme } = useTheme()
  return (
    <main className="consent-page">
      <section className="consent-card glass" aria-labelledby="consent-title">
        <img className="consent-logo" src={theme === 'light' ? '/assets/logo-dark.svg' : '/assets/logo.svg'}
          alt="Da Nang Blockchain Hub" />
        {children}
      </section>
    </main>
  )
}

const Spinner = () => <div className="consent-spinner"><div className="spinner" role="status" /></div>

const Notice = ({ kind }) => {
  const { t } = useTranslation()
  return <>
    <h1 id="consent-title" className="consent-title">{t(`oauth.errors.${kind}Title`)}</h1>
    <p>{t(`oauth.errors.${kind}`)}</p>
  </>
}

const SignInStep = ({ requestId }) => {
  const { t } = useTranslation()
  return <>
    <h1 id="consent-title" className="consent-title">{t('oauth.signInTitle')}</h1>
    <p>{t('oauth.signInBody')}</p>
    <Link className="btn btn-primary consent-wide" to={consentLoginPath(requestId)}>{t('oauth.signIn')}</Link>
  </>
}

// Email-pending accounts verify here; the link's Continue button returns to
// this request, and useEmailStatus picks the change up on focus.
const VerifyStep = ({ user, requestId, onVerified }) => {
  const { t } = useTranslation()
  const link = useSendVerificationLink(user.uid, consentPath(requestId), onVerified)
  const label = link.secondsLeft > 0
    ? t('profile.verifyEmailResendIn', { time: formatCooldown(link.secondsLeft) })
    : t(link.sent ? 'profile.verifyEmailResend' : 'profile.verifyEmail')
  return <>
    <h1 id="consent-title" className="consent-title">{t('oauth.verifyTitle')}</h1>
    <p>{t('oauth.verifyBody', { email: user.email })}</p>
    {link.sent && <p role="status">{t('oauth.verifySent')}</p>}
    <button type="button" className="btn btn-primary consent-wide" onClick={link.send} disabled={link.busy}>{label}</button>
  </>
}

const ConsentFacts = ({ consent }) => {
  const { t } = useTranslation()
  return (
    <dl className="consent-facts">
      <div>
        <dt>{t('oauth.appName')}</dt>
        <dd>
          <bdi className="consent-client">{consent.clientName || t('oauth.unnamedApp')}</bdi>
          <span className="consent-hint">{t('oauth.appNameHint')}</span>
        </dd>
      </div>
      <div>
        <dt>{t('oauth.redirect')}</dt>
        <dd><strong className="consent-host">{consent.redirectHost}</strong></dd>
      </div>
      <div>
        <dt>{t('oauth.account')}</dt>
        <dd>{consent.account}</dd>
      </div>
    </dl>
  )
}

const ConsentDetails = ({ consent, decision }) => {
  const { t } = useTranslation()
  const { logout } = useAuth()
  // After approve/deny the page navigates away; keep the buttons disabled.
  const busy = decision.isPending || decision.isSuccess
  return <>
    <h1 id="consent-title" className="consent-title">{t('oauth.title')}</h1>
    <p>{t('oauth.lead')}</p>
    <ConsentFacts consent={consent} />
    {consent.loopback && (
      <p className="consent-warning" role="note">{t('oauth.loopbackWarning', { host: consent.redirectHost })}</p>
    )}
    <h2 className="consent-subtitle">{t('oauth.accessTitle')}</h2>
    <ul className="consent-scopes">
      {consent.scopes.map(({ scope, text }) => <li key={scope}>{t(`oauth.scopes.${scope}`, { defaultValue: text })}</li>)}
    </ul>
    <p className="consent-hint">{t('oauth.revokeHint')}</p>
    {decision.isError && <p className="consent-error" role="alert">{t(`oauth.errors.${consentErrorKind(decision.error)}`)}</p>}
    <div className="consent-actions">
      <button type="button" className="btn btn-secondary" disabled={busy}
        onClick={() => decision.mutate('deny')}>{t('oauth.deny')}</button>
      <button type="button" className="btn btn-primary" disabled={busy}
        onClick={() => decision.mutate('approve')}>{t('oauth.approve')}</button>
    </div>
    <p className="consent-hint">
      <button type="button" className="consent-link" disabled={busy} onClick={logout}>{t('oauth.switchAccount')}</button>
    </p>
  </>
}

const ConsentReview = ({ user, requestId, emailStatus, onVerified }) => {
  const query = useQuery({
    queryKey: ['oauthConsent', requestId, user.uid, emailStatus],
    queryFn: () => oauthConsent('describe', requestId),
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: Infinity
  })
  const decision = useMutation({
    mutationFn: (action) => oauthConsent(action, requestId),
    // Full navigation to the AI app's callback (a form POST redirect would
    // hit CSP form-action 'self').
    onSuccess: ({ redirectUrl }) => window.location.assign(redirectUrl)
  })
  if (query.isPending) return <Spinner />
  if (!query.isError) return <ConsentDetails consent={query.data} decision={decision} />
  const kind = consentErrorKind(query.error)
  if (kind === 'unverified') return <VerifyStep user={user} requestId={requestId} onVerified={onVerified} />
  if (kind === 'signIn') return <SignInStep requestId={requestId} />
  return <Notice kind={kind} />
}

const ConsentFlow = ({ requestId }) => {
  const { currentUser, loading, isEmailVerificationPending } = useAuth()
  const [emailStatus, markVerified] = useEmailStatus(currentUser)
  if (loading) return <Spinner />
  if (!currentUser) return <SignInStep requestId={requestId} />
  if (isEmailVerificationPending() && emailStatus !== 'verified') {
    return <VerifyStep user={currentUser} requestId={requestId} onVerified={markVerified} />
  }
  return <ConsentReview key={currentUser.uid} user={currentUser} requestId={requestId}
    emailStatus={emailStatus} onVerified={markVerified} />
}

export default function Consent() {
  const [searchParams] = useSearchParams()
  const requestId = searchParams.get('request')
  return (
    <ConsentShell>
      {isConsentRequestId(requestId) ? <ConsentFlow requestId={requestId} /> : <Notice kind="invalid" />}
    </ConsentShell>
  )
}
