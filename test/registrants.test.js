import test from 'node:test'
import assert from 'node:assert/strict'
import {
  resolveRegistrants,
  filterRegistrants,
  getRegistrantEmails
} from '../src/components/event/registrants.js'

const members = [
  { id: 'a', displayName: 'Alice Nguyen', email: 'alice@example.com', company: 'Solana Labs VN' },
  { id: 'b', displayName: 'Bob Tran', email: 'bob@example.com', jobTitle: 'AI Engineer' },
  { id: 'c', displayName: 'Carol Le' }
]

test('rows keep the event order, not the members-list order', () => {
  const rows = resolveRegistrants(['c', 'a'], members)
  assert.deepEqual(rows.map(r => [r.uid, r.position, r.member.displayName]), [
    ['c', 1, 'Carol Le'],
    ['a', 2, 'Alice Nguyen']
  ])
})

test('a uid with no member doc still gets a row', () => {
  const rows = resolveRegistrants(['a', 'gone', 'b'], members)
  assert.equal(rows.length, 3)
  assert.deepEqual(rows[1], { uid: 'gone', position: 2, member: null })
})

test('missing attendees or members resolve to an empty or member-less list', () => {
  assert.deepEqual(resolveRegistrants(undefined, members), [])
  assert.deepEqual(resolveRegistrants(['a'], undefined), [{ uid: 'a', position: 1, member: null }])
})

test('search matches name, email, company and job title, ignoring case', () => {
  const rows = resolveRegistrants(['a', 'b', 'c'], members)
  const found = (query) => filterRegistrants(rows, query).map(r => r.uid)
  assert.deepEqual(found('ALICE'), ['a'])
  assert.deepEqual(found('bob@'), ['b'])
  assert.deepEqual(found('solana'), ['a'])
  assert.deepEqual(found('engineer'), ['b'])
  assert.deepEqual(found('nobody'), [])
})

test('a blank search returns every row; filtered rows keep their position', () => {
  const rows = resolveRegistrants(['a', 'b', 'c'], members)
  assert.deepEqual(filterRegistrants(rows, '   '), rows)
  assert.equal(filterRegistrants(rows, 'carol')[0].position, 3)
})

test('a deleted account is found by its uid', () => {
  const rows = resolveRegistrants(['a', 'gone-123'], members)
  assert.deepEqual(filterRegistrants(rows, 'gone').map(r => r.uid), ['gone-123'])
})

test('emails skip members without one, deleted accounts and duplicates', () => {
  const dupes = [...members, { id: 'd', email: ' alice@example.com ' }]
  const rows = resolveRegistrants(['a', 'gone', 'c', 'b', 'd'], dupes)
  assert.deepEqual(getRegistrantEmails(rows), ['alice@example.com', 'bob@example.com'])
})
