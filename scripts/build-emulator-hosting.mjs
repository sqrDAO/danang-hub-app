import { readFile, writeFile } from 'node:fs/promises'
import { build, loadEnv } from 'vite'

const config = JSON.parse(await readFile('firebase.json', 'utf8'))
const env = loadEnv('production', process.cwd(), 'VITE_')
const host = env.VITE_EMULATOR_HOST || 'localhost'
if (new URL(`http://${host}`).hostname !== host.toLowerCase() || host.includes('*')) {
  throw new Error('VITE_EMULATOR_HOST must be a hostname or IP address without a port')
}

const origin = service => `http://${host}:${config.emulators[service].port}`
const connections = ['auth', 'firestore', 'functions', 'storage'].map(origin).join(' ')
const csp = config.hosting.headers.flatMap(rule => rule.headers)
  .find(header => header.key === 'Content-Security-Policy')
csp.value = csp.value
  .replace('connect-src ', `connect-src ${connections} `)
  .replace('frame-src ', `frame-src ${origin('auth')} `)

// Keep the local bundle outside the directory used by firebase deploy.
config.hosting.public = '.firebase/emulator-dist'
process.env.VITE_USE_EMULATORS = 'true'
await build({ build: { outDir: config.hosting.public } })
await writeFile('firebase.emulators.local', JSON.stringify(config, null, 2))
