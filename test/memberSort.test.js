import test from 'node:test'
import assert from 'node:assert/strict'
import { Timestamp } from 'firebase/firestore'
import { compareMembersCreatedAt } from '../src/utils/memberSort.js'

test('mixed ISO strings and Firestore timestamps sort newest first without changing documents', () => {
  const timestamp = Timestamp.fromDate(new Date('2026-11-20T12:00:00Z'))
  const members = [
    { id: 'old', createdAt: '2026-11-19T12:00:00.000Z' },
    { id: 'timestamp', createdAt: timestamp },
    { id: 'new', createdAt: '2026-11-21T12:00:00.000Z' },
    { id: 'like', createdAt: { toDate: () => new Date('2026-11-20T13:00:00Z') } }
  ]
  assert.deepEqual(members.sort(compareMembersCreatedAt).map(m => m.id), ['new', 'like', 'timestamp', 'old'])
  assert.equal(members[2].createdAt, timestamp)
})

test('missing and invalid dates stay in the roster after valid dates', () => {
  const invalid = [undefined, null, '', 'invalid', {}, false, [], { toDate: 'not a function' }, new Date(NaN)]
  const members = invalid.map((createdAt, id) => ({ id, createdAt }))
  members.push({ id: 'epoch', createdAt: 0 }, { id: 'before-epoch', createdAt: new Date('1960-01-01T00:00:00Z') })
  assert.deepEqual(members.sort(compareMembersCreatedAt).map(m => m.id), ['epoch', 'before-epoch', ...invalid.keys()])
})

test('equivalent instants retain input order across representations and offsets', () => {
  const members = [
    { id: 'offset', createdAt: '2026-11-20T19:00:00+07:00' },
    { id: 'timestamp', createdAt: Timestamp.fromDate(new Date('2026-11-20T12:00:00Z')) },
    { id: 'iso', createdAt: '2026-11-20T12:00:00.000Z' }
  ]
  assert.deepEqual(members.sort(compareMembersCreatedAt).map(m => m.id), ['offset', 'timestamp', 'iso'])
})
