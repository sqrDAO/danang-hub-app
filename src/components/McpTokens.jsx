import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { manageMcpToken, mcpEndpoint } from '../services/mcpTokens'
import { LOCAL_DEV_MODE } from '../utils/localDevMode'
import { useMcpTokenCooldown } from '../hooks/useMcpTokenCooldown'
import { useAuth } from '../hooks/useAuth'
import ConnectedApps from './ConnectedApps'
import './McpTokens.css'

const TokenError = ({ failed }) => {
  const { t } = useTranslation()
  return failed ? <p role="alert">{t('mcp.error')}</p> : null
}

const useTokenActions = (refresh, wait) => {
  const [secret, setSecret] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)
  const run = async (action) => {
    setBusy(true)
    setError(false)
    setSecret('')
    try {
      const result = await manageMcpToken(action)
      setSecret(result.token || '')
      await refresh()
    } catch (failure) {
      if (failure.code === 'functions/resource-exhausted') {
        wait(failure.details?.retryAfterMs || 60000)
      } else {
        setError(true)
      }
    } finally {
      setBusy(false)
    }
  }
  return { secret, busy, error, run, hide: () => setSecret('') }
}

function TokenControls({ disabled, active, cooldown, run }) {
  const { t } = useTranslation()
  return <>
      <p id="mcp-cooldown" role="status">{t(cooldown.seconds > 0 ? 'mcp.cooldownHelp' : 'mcp.generationHelp')}</p>
      {cooldown.seconds > 0 && <p role="timer" aria-live="off">{t('mcp.cooldownRemaining', { seconds: cooldown.seconds })}</p>}
      <div className="mcp-actions">
        <button type="button" className="btn btn-primary" disabled={disabled || active || cooldown.seconds > 0}
          aria-describedby="mcp-cooldown" onClick={() => run('create')}>{t('mcp.create')}</button>
        <button type="button" className="btn btn-secondary" disabled={disabled || !active}
          onClick={() => run('revoke')}>{t('mcp.revoke')}</button>
      </div>
  </>
}

function McpTokenPanel({ uid }) {
  const { t, i18n } = useTranslation()
  const query = useQuery({ queryKey: ['mcpToken', uid],
    queryFn: () => manageMcpToken('status'), enabled: !LOCAL_DEV_MODE,
    staleTime: 30000 })
  const cooldown = useMcpTokenCooldown(query.data, query.dataUpdatedAt)
  const state = useTokenActions(query.refetch, cooldown.wait)
  const disabled = LOCAL_DEV_MODE || query.isLoading || state.busy || query.isError
  return (
    <section className="profile-card glass mcp-access" aria-labelledby="mcp-title">
      <h2 id="mcp-title">{t('mcp.title')}</h2>
      <p>{t('mcp.help')}</p>
      <p>{t('mcp.compatibility')}</p>
      <p><a href="https://github.com/sqrDAO/danang-hub-app/blob/main/docs/knowledge/mcp-booking.md#choose-your-client"
        target="_blank" rel="noopener noreferrer">{t('mcp.setupGuide')}</a></p>
      <label className="form-label" htmlFor="mcp-endpoint">{t('mcp.endpoint')}</label>
      <input id="mcp-endpoint" className="form-field" readOnly value={mcpEndpoint} />
      {LOCAL_DEV_MODE && <p>{t('mcp.preview')}</p>}
      {query.data?.active && <p>{t('mcp.active', {
        date: new Intl.DateTimeFormat(i18n.language, { timeZone: 'Asia/Ho_Chi_Minh' })
          .format(new Date(query.data.expiresAt))
      })}</p>}
      {state.secret && <div>
        <p>{t('mcp.once')}</p>
        <label className="form-label" htmlFor="mcp-secret">{t('mcp.token')}</label>
        <input id="mcp-secret" className="form-field" readOnly value={state.secret}
          autoComplete="off" spellCheck={false} />
        <button type="button" className="btn btn-secondary" onClick={state.hide}>{t('mcp.hide')}</button>
      </div>}
      <TokenError failed={state.error || query.isError} />
      <TokenControls disabled={disabled} active={query.data?.active} cooldown={cooldown} run={state.run} />
      <ConnectedApps uid={uid} />
    </section>
  )
}

export default function McpTokens() {
  const { currentUser } = useAuth()
  return <McpTokenPanel key={currentUser.uid} uid={currentUser.uid} />
}
