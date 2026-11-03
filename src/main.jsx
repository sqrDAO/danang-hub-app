import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { I18nextProvider } from 'react-i18next'
import { registerSW } from 'virtual:pwa-register'
import App from './App.jsx'
import AppErrorBoundary from './components/AppErrorBoundary.jsx'
import i18n from './i18n'
import { shouldReloadForStaleChunk } from './utils/chunkReload'
import { APP_COMMIT, APP_BUILT_AT } from './utils/appVersion'
import './styles/globals.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      // Avoid back-to-back refetches when navigating between pages that share
      // the same query keys (amenities, members, etc.).
      staleTime: 30 * 1000,
    },
  },
})

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  registerSW({ immediate: true })
}

// A tab still on the previous build asks for lazy chunks the new deploy removed.
// Reload into the new build, once per build; if the guard or blocked storage
// stops us, the error is left to the importer's own .catch (HeroCanvas3D) or
// AppErrorBoundary instead.
const STALE_CHUNK_RELOAD_KEY = 'hub-stale-chunk-reload-build'
const CURRENT_BUILD = `${APP_COMMIT}@${APP_BUILT_AT}`

window.addEventListener('vite:preloadError', (event) => {
  try {
    const reload = shouldReloadForStaleChunk({
      error: event.payload,
      online: navigator.onLine,
      reloadedBuild: sessionStorage.getItem(STALE_CHUNK_RELOAD_KEY),
      currentBuild: CURRENT_BUILD,
    })
    if (!reload) return
    sessionStorage.setItem(STALE_CHUNK_RELOAD_KEY, CURRENT_BUILD)
  } catch {
    return
  }
  event.preventDefault()
  window.location.reload()
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>
        <BrowserRouter>
          <AppErrorBoundary>
            <App />
          </AppErrorBoundary>
        </BrowserRouter>
      </I18nextProvider>
    </QueryClientProvider>
  </React.StrictMode>,
)
