import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { escapeHtml, buildEventStatusEmail } = require('../functions/emailHtml.js')

test('escapeHtml escapes the five HTML-significant characters', () => {
  assert.equal(escapeHtml(`& < > " '`), '&amp; &lt; &gt; &quot; &#39;')
})

test('escapeHtml leaves ordinary and Vietnamese text unchanged', () => {
  assert.equal(escapeHtml('Hội thảo Web3 Đà Nẵng'), 'Hội thảo Web3 Đà Nẵng')
})

test('escapeHtml returns an empty string for null and undefined', () => {
  assert.equal(escapeHtml(null), '')
  assert.equal(escapeHtml(undefined), '')
})

test('escapeHtml keeps falsy non-null values like 0', () => {
  assert.equal(escapeHtml(0), '0')
})

test('escapeHtml escapes already-escaped text again (use only at output)', () => {
  assert.equal(escapeHtml('&amp;'), '&amp;amp;')
})

const emailOptions = {
  eventTitle: 'Hội thảo Web3', displayName: 'Linh',
  rejectionReason: 'Please revise the date.', appUrl: 'https://app.example'
}

for (const isApproved of [true, false]) {
  for (const field of ['eventTitle', 'displayName', ...(isApproved ? [] : ['rejectionReason'])]) {
    test(`complete ${isApproved ? 'approval' : 'rejection'} email escapes ${field}`, () => {
      const payload = `<a href="https://evil.example">O'Reilly & Co</a>`
      const html = buildEventStatusEmail({ ...emailOptions, isApproved, [field]: payload })
      assert.ok(html.includes('&lt;a href=&quot;https://evil.example&quot;&gt;O&#39;Reilly &amp; Co&lt;/a&gt;'))
      assert.ok(!html.includes(payload))
      assert.ok(!html.includes('<a href="https://evil.example">'))
      assert.ok(html.includes('<a href="https://app.example/member/events"'))
    })
  }
}

test('approval includes guidelines and omits rejection feedback', () => {
  const html = buildEventStatusEmail({ ...emailOptions, isApproved: true })
  assert.ok(html.includes('Hội thảo Web3'))
  assert.ok(html.includes('Event Guidelines</a>'))
  assert.ok(!html.includes(emailOptions.rejectionReason))
})

test('rejection includes fallback feedback and omits approval guidelines', () => {
  const html = buildEventStatusEmail({ ...emailOptions, isApproved: false, rejectionReason: '' })
  assert.ok(html.includes('No reason was provided.'))
  assert.ok(!html.includes('Event Guidelines</a>'))
})
