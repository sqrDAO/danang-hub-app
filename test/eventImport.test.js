import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { getEventImportErrorKey } from '../src/utils/eventImportErrors.js'

const require = createRequire(import.meta.url)
const {
  parseImportUrl,
  fetchEventPage,
  extractEventJsonLd,
  toEventDraft
} = require('../functions/eventImport.js')

const page = (jsonLd) =>
  `<html><head><script type="application/ld+json">${JSON.stringify(jsonLd)}</script></head></html>`

const lumaEvent = {
  '@type': 'Event',
  name: '  Web3 Night  ',
  description: 'Talks and pizza.',
  startDate: '2026-12-01T18:30:00.000+07:00',
  endDate: '2026-12-01T21:10:00.000+07:00',
  url: 'https://luma.com/web3night'
}

const pageUrl = new URL('https://luma.com/fallback')

test('parseImportUrl accepts https Luma hosts, with or without www', () => {
  for (const url of ['https://lu.ma/abc', 'https://luma.com/abc', 'https://www.luma.com/abc']) {
    assert.equal(parseImportUrl(url)?.href, url)
  }
})

test('parseImportUrl rejects other hosts, schemes, ports and credentials', () => {
  const rejected = [
    'http://lu.ma/abc', 'https://example.com/abc', 'https://lu.ma.evil.com/abc',
    'https://evilluma.com/abc', 'https://luma.com:8443/abc', 'https://user:pw@luma.com/abc',
    'https://169.254.169.254/latest', 'javascript:alert(1)', 'not a url', '', null, 42
  ]
  for (const url of rejected) assert.equal(parseImportUrl(url), null, String(url))
})

test('extractEventJsonLd finds the Event block', () => {
  assert.equal(extractEventJsonLd(page(lumaEvent)).name, lumaEvent.name)
})

test('extractEventJsonLd looks inside arrays, @graph and Event subtypes', () => {
  const site = { '@type': 'WebSite', name: 'Luma' }
  assert.equal(extractEventJsonLd(page([site, lumaEvent])).name, lumaEvent.name)
  assert.equal(extractEventJsonLd(page({ '@graph': [site, lumaEvent] })).name, lumaEvent.name)
  assert.ok(extractEventJsonLd(page({ ...lumaEvent, '@type': ['Thing', 'SocialEvent'] })))
})

test('extractEventJsonLd returns null without an Event, and skips broken JSON', () => {
  assert.equal(extractEventJsonLd(page({ '@type': 'WebSite', name: 'Luma' })), null)
  assert.equal(extractEventJsonLd('<html></html>'), null)
  const broken = '<script type="application/ld+json">{oops</script>'
  assert.equal(extractEventJsonLd(broken + page(lumaEvent)).name, lumaEvent.name)
})

test('toEventDraft maps the fields and rounds duration up to 15 minutes', () => {
  assert.deepEqual(toEventDraft(lumaEvent, pageUrl), {
    title: 'Web3 Night',
    description: 'Talks and pizza.',
    date: '2026-12-01T11:30:00.000Z',
    duration: 165,
    eventLink: 'https://luma.com/web3night',
    image: null
  })
})

test('toEventDraft passes on a cover only from the Luma image host', () => {
  const cover = 'https://images.lumacdn.com/uploads/cover.jpg'
  const image = (value) => toEventDraft({ ...lumaEvent, image: value }, pageUrl).image
  assert.equal(image(cover), cover)
  assert.equal(image([cover, 'https://images.lumacdn.com/other.jpg']), cover)
  assert.equal(image({ '@type': 'ImageObject', url: cover }), cover)
  for (const bad of ['http://images.lumacdn.com/a.jpg', 'https://example.com/a.jpg',
    'https://images.lumacdn.com.evil.com/a.jpg', 'data:image/png;base64,AAAA', 'nope', 42, {}, []]) {
    assert.equal(image(bad), null, JSON.stringify(bad))
  }
})

test('toEventDraft leaves duration null without a usable end date', () => {
  assert.equal(toEventDraft({ ...lumaEvent, endDate: undefined }, pageUrl).duration, null)
  assert.equal(toEventDraft({ ...lumaEvent, endDate: lumaEvent.startDate }, pageUrl).duration, null)
})

test('toEventDraft caps duration, title and description', () => {
  const long = toEventDraft({
    ...lumaEvent,
    name: 'a'.repeat(300),
    description: 'b'.repeat(6000),
    endDate: '2026-12-05T18:30:00.000+07:00'
  }, pageUrl)
  assert.equal(long.title.length, 200)
  assert.equal(long.description.length, 5000)
  assert.equal(long.duration, 1440)
})

test('toEventDraft falls back to the page URL when the block links elsewhere', () => {
  const draft = toEventDraft({ ...lumaEvent, url: 'https://example.com/x' }, pageUrl)
  assert.equal(draft.eventLink, pageUrl.href)
})

test('toEventDraft needs a title and a valid start', () => {
  assert.equal(toEventDraft(null, pageUrl), null)
  assert.equal(toEventDraft({ ...lumaEvent, name: ' ' }, pageUrl), null)
  assert.equal(toEventDraft({ ...lumaEvent, startDate: 'soon' }, pageUrl), null)
  assert.equal(toEventDraft({ ...lumaEvent, startDate: undefined }, pageUrl), null)
})

test('toEventDraft reads times without an offset as hub time', () => {
  const draft = toEventDraft({
    ...lumaEvent,
    startDate: '2026-12-01T18:30:00',
    endDate: '2026-12-01T21:10'
  }, pageUrl)
  assert.equal(draft.date, '2026-12-01T11:30:00.000Z')
  assert.equal(draft.duration, 165)
})

const htmlResponse = (html) => new Response(html, { status: 200 })
const redirect = (location) => new Response(null, { status: 302, headers: { location } })

const fakeFetch = (responses) => {
  const calls = []
  const fetchImpl = async (href, options) => {
    calls.push({ href, options })
    return responses[href]()
  }
  return { calls, fetchImpl }
}

test('fetchEventPage follows the lu.ma redirect to luma.com without auto-redirects', async () => {
  const { calls, fetchImpl } = fakeFetch({
    'https://lu.ma/abc': () => redirect('https://luma.com/abc'),
    'https://luma.com/abc': () => htmlResponse('<html>ok</html>')
  })
  const result = await fetchEventPage(new URL('https://lu.ma/abc'), fetchImpl)
  assert.equal(result.html, '<html>ok</html>')
  assert.equal(result.url.href, 'https://luma.com/abc')
  assert.ok(calls.every(call => call.options.redirect === 'manual'))
})

test('fetchEventPage resolves a relative redirect against the current page', async () => {
  const { fetchImpl } = fakeFetch({
    'https://luma.com/abc': () => redirect('/def'),
    'https://luma.com/def': () => htmlResponse('moved')
  })
  const result = await fetchEventPage(new URL('https://luma.com/abc'), fetchImpl)
  assert.equal(result.url.href, 'https://luma.com/def')
})

test('fetchEventPage refuses a redirect to a host off the allowlist', async () => {
  const { calls, fetchImpl } = fakeFetch({
    'https://lu.ma/abc': () => redirect('http://169.254.169.254/latest/meta-data')
  })
  await assert.rejects(fetchEventPage(new URL('https://lu.ma/abc'), fetchImpl),
    (error) => {
      assert.match(error.message, /unsupported/)
      assert.equal(error.callableCode, 'unavailable')
      assert.equal(getEventImportErrorKey({ code: `functions/${error.callableCode}` }), 'toast.eventImportFailed')
      return true
    })
  assert.equal(calls.length, 1)
})

test('fetchEventPage stops after 3 redirects', async () => {
  const { calls, fetchImpl } = fakeFetch({
    'https://luma.com/loop': () => redirect('https://luma.com/loop')
  })
  await assert.rejects(fetchEventPage(new URL('https://luma.com/loop'), fetchImpl), /Too many/)
  assert.equal(calls.length, 4)
})

test('fetchEventPage rejects error statuses and pages over 1 MB', async () => {
  const { fetchImpl } = fakeFetch({
    'https://luma.com/missing': () => new Response('nope', { status: 404 }),
    'https://luma.com/down': () => new Response('nope', { status: 503 }),
    'https://luma.com/huge': () => htmlResponse('x'.repeat(1000001))
  })
  await assert.rejects(fetchEventPage(new URL('https://luma.com/missing'), fetchImpl),
    { message: /404/, callableCode: 'not-found' })
  await assert.rejects(fetchEventPage(new URL('https://luma.com/down'), fetchImpl),
    { message: /503/, callableCode: undefined })
  await assert.rejects(fetchEventPage(new URL('https://luma.com/huge'), fetchImpl), /too large/)
})

test('direct unsupported links retain useful feedback in both locales', () => {
  assert.equal(parseImportUrl('https://example.com/event'), null)
  const unsupported = getEventImportErrorKey({ code: 'functions/invalid-argument' })
  const failed = getEventImportErrorKey({ code: 'functions/unavailable' })
  assert.equal(unsupported, 'toast.eventImportUnsupported')
  for (const locale of ['en', 'vi']) {
    const { toast } = require(`../src/locales/${locale}.json`)
    assert.ok(toast[unsupported.split('.')[1]].includes('Luma'))
    assert.ok(toast[failed.split('.')[1]])
    assert.notEqual(toast[unsupported.split('.')[1]], toast[failed.split('.')[1]])
  }
})
