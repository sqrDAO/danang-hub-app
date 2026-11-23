// Helpers for the MCP OAuth consent page (/oauth/consent, #263).

// Request ids are 16 random bytes in hex (functions/oauth/authorize.js).
export const isConsentRequestId = (id) => typeof id === 'string' && /^[a-f0-9]{32}$/.test(id)

export const consentPath = (id) => `/oauth/consent?request=${encodeURIComponent(id)}`

// The whole consent path is one `redirect` value, so its own `?request=`
// survives the trip through /login (Login runs it through toSafeRedirectPath).
export const consentLoginPath = (id) => `/login?redirect=${encodeURIComponent(consentPath(id))}`

// Same-origin endpoint on the `oauth` function (firebase.json rewrite).
export const CONSENT_ACTION_PATH = '/oauth/consent-action'

// An error response body ({ error, reason, message }) as a thrown Error.
export const consentError = (body) =>
  Object.assign(new Error(body?.message || 'Consent request failed'), { code: body?.error, reason: body?.reason })

// Maps a consent-action error to what the page shows.
export const consentErrorKind = (error) => {
  if (error?.code === 'unauthenticated') {
    // requireUser: no reason = signed out; 'disabled' is not fixable here.
    if (error.reason === 'unverified') return 'unverified'
    return error.reason ? 'failed' : 'signIn'
  }
  if (error?.code === 'permission-denied' && error.reason === 'browser') return 'otherBrowser'
  if (error?.code === 'not-found') return 'expired'
  if (error?.code === 'invalid-argument') return 'invalid'
  return 'failed'
}
