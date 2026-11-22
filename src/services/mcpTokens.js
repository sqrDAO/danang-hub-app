import { httpsCallable } from 'firebase/functions'
import { functions } from './firebase'
import { firebaseConfig } from './firebaseConfig'
import { LOCAL_DEV_MODE } from '../utils/localDevMode'

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
