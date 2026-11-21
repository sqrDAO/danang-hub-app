// Keep in sync with functions/eventImport.js; tests check both boundaries.
export const IMPORTED_BANNER_HOSTS = [
  'images.lumacdn.com', 'secure-content.meetupstatic.com', 'img.evbuc.com'
]

export const isImportedBannerUrl = (value) => {
  if (typeof value !== 'string') return false
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && IMPORTED_BANNER_HOSTS.includes(url.hostname) &&
      !url.port && !url.username && !url.password
  } catch {
    return false
  }
}
