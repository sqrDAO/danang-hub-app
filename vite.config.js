import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Version shown in the footer: package.json `version` (bumped per release,
// tagged v<version> on deploy) plus the commit the build came from.
const appVersion = JSON.parse(readFileSync(new URL('./package.json', import.meta.url))).version
const appCommit = () => {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, 7)
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
  } catch {
    return 'dev'
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const port = Number(env.PORT) || 3000

  return {
    define: {
      __APP_VERSION__: JSON.stringify(appVersion),
      __APP_COMMIT__: JSON.stringify(appCommit()),
      __APP_BUILT_AT__: JSON.stringify(new Date().toISOString())
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            'react-vendor': ['react', 'react-dom', 'react-router-dom'],
            'firebase-vendor': [
              'firebase/app',
              'firebase/auth',
              'firebase/firestore',
              'firebase/functions',
              'firebase/storage',
            ],
            'i18n-vendor': ['i18next', 'react-i18next'],
            'query-vendor': ['@tanstack/react-query'],
          },
        },
      },
    },
    plugins: [
      react(),
      VitePWA({
        strategies: 'injectManifest',
        injectRegister: false,
        manifest: false,
        injectManifest: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
          // Home wallpaper is lazy; do not make every installed PWA download Three.js.
          globIgnores: ['**/*.map', '**/iFonts-License.txt', '**/HeroCanvas3D*.js']
        }
      })
    ],
    server: {
      port,
      open: true
    }
  }
})
