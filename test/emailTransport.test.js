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

// Small SMTP peer: once one socket has made two deliveries, that socket stops
// responding without closing, as a stale NAT mapping does after an instance
// resumes. Only one socket ever stalls.
async function startStallingServer(t) {
  const sockets = new Set()
  const state = { connections: 0, delivered: 0, stalledOn: 0 }
  const server = createServer(socket => {
    const connection = ++state.connections
    sockets.add(socket)
    socket.on('close', () => sockets.delete(socket))
    socket.on('error', () => {})
    socket.write('220 localhost ESMTP\r\n')
    let pending = ''
    let data = false
    let deliveredHere = 0
    socket.on('data', chunk => {
      pending += chunk.toString()
      let end
      while ((end = pending.indexOf('\r\n')) >= 0) {
        const line = pending.slice(0, end)
        pending = pending.slice(end + 2)
        if (!state.stalledOn && deliveredHere === 2) state.stalledOn = connection
        if (state.stalledOn === connection) continue
        if (data) {
          if (line === '.') {
            data = false
            state.delivered++
            deliveredHere++
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

// Production waits 20s for a silent socket; the test shortens that to 500ms
// (same retry path, no 20s wait) after checking the getter asked for 20000.
// A slow runner can idle out the pooled socket between sends at 500ms, so the
// test keeps sending until the server has stalled a socket that made two
// deliveries, then checks that exact send retried on one fresh connection.
const TEST_SOCKET_TIMEOUT = 500

test('a stalled reused SMTP socket retries on a fresh connection within the function budget',
  { timeout: 10000 }, async t => {
    const { state, port } = await startStallingServer(t)
    let requested
    const getTransporter = createTransporterGetter(options => {
      requested = options
      return nodemailer.createTransport({ ...options, socketTimeout: TEST_SOCKET_TIMEOUT })
    }, {
      EMAIL_SMTP_HOST: '127.0.0.1', EMAIL_SMTP_PORT: String(port),
      EMAIL_SMTP_SECURE: 'false',
    })
    const transporter = getTransporter()
    t.after(() => transporter.close())
    assert.equal(requested.socketTimeout, 20000, 'production keeps the 20s socket budget')
    const message = { from: 'sender@example.test', to: 'member@example.test', text: 'test' }
    let sends = 0
    let result
    while (!state.stalledOn && sends < 10) {
      result = await transporter.sendMail(message)
      sends++
    }
    assert.ok(state.stalledOn, 'a send reached a reused socket that went silent')
    assert.equal(state.delivered, sends, 'the stalled send was still delivered')
    assert.equal(state.connections, state.stalledOn + 1, 'retry opened one fresh connection')
    assert.deepEqual(result.accepted, ['member@example.test'])
  })
