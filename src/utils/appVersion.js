// Build info injected by vite.config.js (`define`). The typeof guards keep
// this importable where Vite did not build it (node --test).
/* global __APP_VERSION__, __APP_COMMIT__, __APP_BUILT_AT__ */
export const APP_VERSION = typeof __APP_VERSION__ === 'undefined' ? '0.0.0' : __APP_VERSION__
export const APP_COMMIT = typeof __APP_COMMIT__ === 'undefined' ? 'dev' : __APP_COMMIT__
export const APP_BUILT_AT = typeof __APP_BUILT_AT__ === 'undefined' ? null : __APP_BUILT_AT__

// "v1.0.0 (38164ca)"
export const appVersionLabel = (version = APP_VERSION, commit = APP_COMMIT) => `v${version} (${commit})`
