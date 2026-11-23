import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery } from '@tanstack/react-query'
import Modal from './Modal'
import { disconnectApp, listConnectedApps } from '../services/mcpTokens'

// AI apps connected by OAuth sign-in (#263): one row per live grant, with
// Disconnect. Disconnecting revokes the grant, so the app's next MCP request
// is refused and it has to ask the member to sign in again.

const useHubDate = () => {
  const { i18n } = useTranslation()
  const format = new Intl.DateTimeFormat(i18n.language, { timeZone: 'Asia/Ho_Chi_Minh', dateStyle: 'medium' })
  return (ms) => format.format(new Date(ms))
}

const AppRow = ({ app, onDisconnect }) => {
  const { t } = useTranslation()
  const date = useHubDate()
  return (
    <li className="mcp-app">
      <div className="mcp-app-text">
        <bdi className="mcp-app-name">{app.clientName || t('oauth.unnamedApp')}</bdi>
        <span>{t('mcp.apps.redirect', { host: app.redirectHost })}</span>
        <span>
          {t('mcp.apps.connected', { date: date(app.createdAt) })}
          {' · '}
          {app.lastUsedAt ? t('mcp.apps.lastUsed', { date: date(app.lastUsedAt) }) : t('mcp.apps.neverUsed')}
        </span>
      </div>
      <button type="button" className="btn btn-secondary btn-sm" onClick={() => onDisconnect(app)}>
        {t('mcp.apps.disconnect')}
      </button>
    </li>
  )
}

const DisconnectDialog = ({ app, busy, failed, onCancel, onConfirm }) => {
  const { t } = useTranslation()
  const footer = <>
    <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={busy} autoFocus>
      {t('common.cancel')}
    </button>
    <button type="button" className="btn btn-danger" onClick={onConfirm} disabled={busy}>
      {t('mcp.apps.disconnect')}
    </button>
  </>
  return (
    <Modal isOpen={Boolean(app)} onClose={busy ? () => {} : onCancel} title={t('mcp.apps.confirmTitle')} footer={footer}>
      <p>{t('mcp.apps.confirmBody', { host: app?.redirectHost })}</p>
      {failed && <p role="alert">{t('mcp.apps.error')}</p>}
    </Modal>
  )
}

const AppList = ({ query, onDisconnect }) => {
  const { t } = useTranslation()
  if (query.isPending) return null
  if (query.isError) return <p role="alert">{t('mcp.apps.loadError')}</p>
  if (query.data.grants.length === 0) return <p>{t('mcp.apps.empty')}</p>
  return (
    <ul className="mcp-apps">
      {query.data.grants.map((app) => <AppRow key={app.id} app={app} onDisconnect={onDisconnect} />)}
    </ul>
  )
}

export default function ConnectedApps({ uid }) {
  const { t } = useTranslation()
  const [target, setTarget] = useState(null)
  const query = useQuery({ queryKey: ['mcpGrants', uid], queryFn: listConnectedApps, staleTime: 30000 })
  const disconnect = useMutation({
    mutationFn: (app) => disconnectApp(app.id),
    onSuccess: async () => {
      setTarget(null)
      await query.refetch()
    }
  })
  const open = (app) => {
    disconnect.reset()
    setTarget(app)
  }
  return (
    <div className="mcp-connected" aria-labelledby="mcp-apps-title" role="group">
      <h3 id="mcp-apps-title">{t('mcp.apps.title')}</h3>
      <p>{t('mcp.apps.help')}</p>
      <AppList query={query} onDisconnect={open} />
      <DisconnectDialog app={target} busy={disconnect.isPending} failed={disconnect.isError}
        onCancel={() => setTarget(null)} onConfirm={() => disconnect.mutate(target)} />
    </div>
  )
}
