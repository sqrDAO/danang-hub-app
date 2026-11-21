import { httpsCallable } from 'firebase/functions'
import { functions } from './firebase'
import { firebaseConfig } from './firebaseConfig'
import { LOCAL_DEV_MODE } from '../utils/localDevMode'

export const mcpEndpoint = `https://us-central1-${firebaseConfig.projectId}.cloudfunctions.net/mcp`

// Never cache the create response: it contains the one-time secret.
export const manageMcpToken = async (action) => {
  if (LOCAL_DEV_MODE) return { active: false }
  const result = await httpsCallable(functions, 'manageMcpToken')({ action })
  return result.data
}
