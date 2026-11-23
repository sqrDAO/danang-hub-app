import { httpsCallable } from 'firebase/functions'
import { auth, functions } from './firebase'
import { firebaseConfig } from './firebaseConfig'
import { LOCAL_DEV_MODE } from '../utils/localDevMode'
import { CONSENT_ACTION_PATH, consentError } from '../utils/oauthConsent'

// Production serves /mcp through a Hosting rewrite on the branded origin (the OAuth
// resource URL); other projects use the raw function URL, which also takes dhm_ tokens.
const HUB_PROJECT_ID = 'danang-hub-app'
export const mcpEndpoint = firebaseConfig.projectId === HUB_PROJECT_ID ?
  'https://app.danangblockchainhub.com/mcp' :
  `https://us-central1-${firebaseConfig.projectId}.cloudfunctions.net/mcp`

// Never cache the create response: it contains the one-time secret.
export const manageMcpToken = async (action) => {
  if (LOCAL_DEV_MODE) return { active: false }
  const result = await httpsCallable(functions, 'manageMcpToken')({ action })
  return result.data
}

// Local preview fixtures (`npm run dev:skipauth`), so the consent page and
// Connected apps render without a backend.
const LOCAL_GRANT = { id: 'local', clientName: 'Claude Code', redirectHost: 'localhost:33418',
  createdAt: Date.now() - 86400000, lastUsedAt: null, expiresAt: Date.now() + 89 * 86400000 }
const LOCAL_CONSENT = { clientName: 'Claude Code', clientNameSelfDeclared: true, redirectHost: 'localhost:33418',
  loopback: true, scopes: [{ scope: 'bookings', text: '' }], account: 'local-dev@localhost' }

// Connected apps (MCP OAuth grants, #263) live behind the same callable.
export const listConnectedApps = async () => {
  if (LOCAL_DEV_MODE) return { grants: [LOCAL_GRANT] }
  const result = await httpsCallable(functions, 'manageMcpToken')({ action: 'listGrants' })
  return result.data
}

export const disconnectApp = async (grantId) => {
  if (LOCAL_DEV_MODE) return { revoked: true }
  const result = await httpsCallable(functions, 'manageMcpToken')({ action: 'revokeGrant', grantId })
  return result.data
}

// OAuth consent: describe a stored authorization request, or approve/deny it.
// Approve and deny resolve to { redirectUrl } for the AI app's callback.
// Same-origin POST to the `oauth` function (Hosting rewrite), so the
// browser-binding cookie set by /oauth/authorize goes along; the ID token
// in the body identifies the member.
export const oauthConsent = async (action, request) => {
  if (LOCAL_DEV_MODE) return action === 'describe' ? LOCAL_CONSENT : { redirectUrl: '/member/profile' }
  const idToken = await auth.currentUser?.getIdToken()
  const response = await fetch(CONSENT_ACTION_PATH, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, request, idToken })
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw consentError(body)
  return body
}
