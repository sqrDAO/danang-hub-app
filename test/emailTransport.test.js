import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { createServer } from 'node:net'
import { once } from 'node:events'

const require = createRequire(import.meta.url)
const { createTransporterGetter } = require('../functions/emailTransport.js')
const nodemailer = createRequire(new URL('../functions/package.json', import.meta.url))('nodemailer')

test('transport initialization is lazy and reads runtime secrets once', () => {
  const env = { EMAIL_SMTP_HOST: 'smtp.example.test', EMAIL_USER: 'sender' }
  const calls = []
  const transport = { sendMail() {} }
  const getTransporter = createTransporterGetter(options => {
    calls.push(options)
    return transport
  }, env)
  assert.equal(calls.length, 0)
  env.EMAIL_PASS = 'runtime-secret'
  for (let i = 0; i < 20; i++) assert.equal(getTransporter(), transport)
  assert.equal(calls.length, 1)
  assert.deepEqual(calls[0], {
    pool: true, maxConnections: 2, maxMessages: 100, maxRequeues: 1,
    idleTimeout: 60000, socketTimeout: 20000, connectionTimeout: 5000,
    greetingTimeout: 5000, dnsTimeout: 5000,
    host: 'smtp.example.test', port: 465, secure: true,
    auth: { user: 'sender', pass: 'runtime-secret' },
  })
})

// Small SMTP peer: after two deliveries, the first socket stops responding
// without closing, as a stale NAT mapping does after an instance resumes.
async function startStallingServer(t) {
  const sockets = new Set()
  const state = { connections: 0, delivered: 0, stalled: false }
  const server = createServer(socket => {
    const connection = ++state.connections
    sockets.add(socket)
    socket.on('close', () => sockets.delete(socket))
    socket.on('error', () => {})
    socket.write('220 localhost ESMTP\r\n')
    let pending = ''
    let data = false
    socket.on('data', chunk => {
      pending += chunk.toString()
      let end
      while ((end = pending.indexOf('\r\n')) >= 0) {
        const line = pending.slice(0, end)
        pending = pending.slice(end + 2)
        if (connection === 1 && state.delivered === 2) {
          state.stalled = true
          continue
        }
        if (data) {
          if (line === '.') {
            data = false
            state.delivered++
            socket.write('250 queued\r\n')
          }
        } else if (/^EHLO|^HELO/.test(line)) {
          socket.write('250 localhost\r\n')
        } else if (line === 'DATA') {
          data = true
          socket.write('354 send message\r\n')
        } else if (line === 'QUIT') {
          socket.end('221 goodbye\r\n')
        } else {
          socket.write('250 OK\r\n')
        }
      }
    })
  })
  t.after(async () => {
    for (const socket of sockets) socket.destroy()
    await new Promise(resolve => server.close(resolve))
  })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  return { state, port: server.address().port }
}

test('a stalled reused SMTP socket retries on a fresh connection within the function budget',
  { timeout: 45000 }, async t => {
    const { state, port } = await startStallingServer(t)
    const getTransporter = createTransporterGetter(nodemailer.createTransport, {
      EMAIL_SMTP_HOST: '127.0.0.1', EMAIL_SMTP_PORT: String(port),
      EMAIL_SMTP_SECURE: 'false',
    })
    const transporter = getTransporter()
    t.after(() => transporter.close())
    const message = { from: 'sender@example.test', to: 'member@example.test', text: 'test' }
    await transporter.sendMail(message)
    await transporter.sendMail(message)
    assert.equal(state.connections, 1, 'healthy sends reuse the same socket')
    const start = Date.now()
    const result = await transporter.sendMail(message)
    assert.equal(state.stalled, true, 'third send reached the silent socket')
    assert.equal(state.delivered, 3)
    assert.equal(state.connections, 2, 'retry opened one fresh connection')
    assert.deepEqual(result.accepted, ['member@example.test'])
    assert.ok(Date.now() - start < 45000)
  })
