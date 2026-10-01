const isWhitespaceOrControl = (char) => {
  const code = char.charCodeAt(0)
  return code <= 0x20 || code === 0x7f || /\s/.test(char)
}

/**
 * Accept a post-login redirect only when it is an in-app path, so a crafted
 * `/login?redirect=` link cannot send a member off-site after sign-in.
 * Rejects protocol-relative (`//host`), backslash (`/\host`, which browsers
 * normalize to `//host`), scheme-bearing, and whitespace/control-character
 * values (browsers strip tabs and newlines, which can rebuild `//`).
 * @param {unknown} value
 * @returns {string|null} the path, or null when it is not a safe in-app path
 */
export function toSafeRedirectPath(value) {
  if (typeof value !== 'string' || !value.startsWith('/')) return null
  if (value.includes('//') || value.includes('\\')) return null
  if ([...value].some(isWhitespaceOrControl)) return null
  return value
}
