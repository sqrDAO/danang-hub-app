// Helpers for the MCP OAuth consent page (/oauth/consent, #263).

// Request ids are 16 random bytes in hex (functions/oauth/authorize.js).
export const isConsentRequestId = (id) => typeof id === 'string' && /^[a-f0-9]{32}$/.test(id)

export const consentPath = (id) => `/oauth/consent?request=${encodeURIComponent(id)}`

// The whole consent path is one `redirect` value, so its own `?request=`
// survives the trip through /login (Login runs it through toSafeRedirectPath).
export const consentLoginPath = (id) => `/login?redirect=${encodeURIComponent(consentPath(id))}`

// Maps an oauthConsent callable error to what the page shows.
export const consentErrorKind = (error) => {
  if (error?.code === 'functions/unauthenticated') {
    // requireUser: no reason = signed out; 'disabled' is not fixable here.
    const reason = error.details?.reason
    if (reason === 'unverified') return 'unverified'
    return reason ? 'failed' : 'signIn'
  }
  if (error?.code === 'functions/not-found') return 'expired'
  if (error?.code === 'functions/invalid-argument') return 'invalid'
  return 'failed'
}
