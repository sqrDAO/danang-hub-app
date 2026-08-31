import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const port = Number(env.PORT) || 3000

  return {
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
