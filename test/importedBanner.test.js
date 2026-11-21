import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { IMPORTED_BANNER_HOSTS, isImportedBannerUrl } from '../src/utils/importedBanner.js'
const require = createRequire(import.meta.url)
const { toEventDraft } = require('../functions/eventImport.js')
const event = { name: 'An event', startDate: '2026-12-01T10:00:00Z' }
const page = new URL('https://luma.com/event')

test('client and server permit only the same verified cover origins', () => {
  for (const host of IMPORTED_BANNER_HOSTS) {
    const image = `https://${host}/cover.jpg`
    assert.equal(isImportedBannerUrl(image), true)
    for (const value of [image, [image], { '@type': 'ImageObject', url: image }]) {
      assert.equal(toEventDraft({ ...event, image: value }, page).image, image)
    }
  }
})

test('both cover boundaries reject lookalikes, credentials, ports and unsafe schemes', () => {
  const rejected = [null, '', 'data:image/png;base64,AAAA', 'https://127.0.0.1/image',
    'https://example.com/image', ...IMPORTED_BANNER_HOSTS.flatMap(host => [
      `http://${host}/a`, `https://${host}.evil.com/a`, `https://not${host}/a`,
      `https://user:password@${host}/a`, `https://${host}:8443/a`
    ])]
  for (const image of rejected) {
    assert.equal(isImportedBannerUrl(image), false, String(image))
    assert.equal(toEventDraft({ ...event, image }, page).image, null, String(image))
  }
})
