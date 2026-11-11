import test from 'node:test'
import assert from 'node:assert/strict'
import { missingProfileFields } from '../src/utils/profileFields.js'

const keys = (profile) => missingProfileFields(profile).map(({ key }) => key)

test('a profile with name, company and role misses nothing', () => {
  assert.deepEqual(keys({ displayName: 'A', company: 'B', jobTitle: 'C' }), [])
})

test('blank and whitespace-only fields count as missing, in form order', () => {
  assert.deepEqual(keys({ displayName: 'A', company: '  ', jobTitle: '' }), ['company', 'jobTitle'])
})

test('no profile yet misses every field', () => {
  assert.deepEqual(keys(null), ['displayName', 'company', 'jobTitle'])
})
