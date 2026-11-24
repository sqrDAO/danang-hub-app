import test from 'node:test'
import assert from 'node:assert/strict'
import { genderLabelKey, genderSelectValue, missingProfileFields } from '../src/utils/profileFields.js'

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

test('listed genders select and label; unlisted ones show blank', () => {
  assert.equal(genderSelectValue('female'), 'female')
  assert.equal(genderLabelKey('prefer-not-to-say'), 'profile.genderOptions.prefer-not-to-say')
  for (const gender of ['unknown', '', undefined]) {
    assert.equal(genderSelectValue(gender), '')
    assert.equal(genderLabelKey(gender), null)
  }
})
