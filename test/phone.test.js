import test from 'node:test'
import assert from 'node:assert/strict'
import { formatPhone, normalizePhone, phoneForSave, phoneHref, phoneMatches, splitPhone } from '../src/utils/phone.js'

test('a Vietnamese local number drops its trunk 0 behind +84', () => {
  assert.deepEqual(normalizePhone('VN', '0905 123 456'), { value: '+84905123456', valid: true })
  assert.deepEqual(normalizePhone('VN', '905-123-456'), { value: '+84905123456', valid: true })
})

test('a pasted + or 00 number wins over the picker', () => {
  assert.deepEqual(normalizePhone('VN', '+65 8123 4567'), { value: '+6581234567', valid: true })
  assert.deepEqual(normalizePhone('US', '0065 8123 4567'), { value: '+6581234567', valid: true })
})

test('Italian numbers keep their leading 0', () => {
  assert.equal(normalizePhone('IT', '06 1234 5678').value, '+390612345678')
})

test('empty is valid and stores nothing', () => {
  assert.deepEqual(normalizePhone('VN', '   '), { value: '', valid: true })
})

test('letters, too few and too many digits are invalid', () => {
  assert.equal(normalizePhone('VN', '0905 abc').valid, false)
  assert.equal(normalizePhone('VN', '12').valid, false)
  assert.equal(normalizePhone('VN', '+1234567890123456').valid, false)
})

test('a stored number splits back into the picker region and number', () => {
  assert.deepEqual(splitPhone('+84905123456'), { region: 'VN', national: '905123456' })
  assert.deepEqual(splitPhone('+85512345678'), { region: 'KH', national: '12345678' })
  assert.deepEqual(splitPhone('+14155550100'), { region: 'US', national: '4155550100' })
})

test('legacy free-text numbers are read as Vietnamese', () => {
  assert.deepEqual(splitPhone('0905 123 456'), { region: 'VN', national: '905123456' })
  assert.deepEqual(splitPhone('84 905 123 456'), { region: 'VN', national: '905123456' })
  assert.deepEqual(splitPhone('(090) 512-3456'), { region: 'VN', national: '905123456' })
  assert.deepEqual(splitPhone(''), { region: 'VN', national: '' })
})

test('E.164 numbers display grouped; legacy text displays as stored', () => {
  assert.equal(formatPhone('+84905123456'), '+84 905 123 456')
  assert.equal(formatPhone('+14155550100'), '+1 415 555 0100')
  assert.equal(formatPhone('0905 123 456'), '0905 123 456')
  assert.equal(formatPhone(undefined), '')
})

test('tel: links use E.164, or the digits of a legacy value', () => {
  assert.equal(phoneHref('+84905123456'), 'tel:+84905123456')
  assert.equal(phoneHref('(090) 512-3456'), 'tel:0905123456')
})

test('a country code typed without + is not added twice', () => {
  assert.equal(normalizePhone('VN', '84 905 123 456').value, '+84905123456')
  assert.equal(normalizePhone('VN', '(+84) 0905 123 456').value, '+84905123456')
  assert.equal(normalizePhone('US', '1 415 555 0100').value, '+14155550100')
})

test('a national number that starts like the dial code keeps its digits', () => {
  // VinaPhone 084…: 9 digits after the trunk 0, so not a typed country code.
  assert.equal(normalizePhone('VN', '084 123 4567').value, '+84841234567')
})

test('a pasted international number drops the trunk 0 after the country code', () => {
  assert.equal(normalizePhone('VN', '+84 0905 123 456').value, '+84905123456')
  assert.equal(normalizePhone('US', '0084 0905 123 456').value, '+84905123456')
  assert.equal(normalizePhone('VN', '+39 06 1234 5678').value, '+390612345678')
})

test('untouched phone inputs keep the stored value, even legacy text', () => {
  for (const stored of ['4155550100', '0905123456 / 0912345678', '+84905123456', '']) {
    const { region, national } = splitPhone(stored)
    assert.deepEqual(phoneForSave(region, national, stored), { value: stored, valid: true }, stored)
  }
})

test('edited phone inputs are normalized and checked', () => {
  assert.deepEqual(phoneForSave('VN', '0905 123 456', '4155550100'), { value: '+84905123456', valid: true })
  assert.equal(phoneForSave('VN', '12', '+84905123456').valid, false)
  assert.equal(phoneForSave('US', '9051234560912345678', '0905123456 / 0912345678').valid, false)
})

test('a phone matches however the admin types it', () => {
  for (const query of ['+84905123456', '+84 905', '905 123', '0905123456', '0905 123 456', '090-512']) {
    assert.ok(phoneMatches('+84905123456', query), query)
  }
  assert.ok(phoneMatches('+390612345678', '06 1234'))
  assert.equal(phoneMatches('+84905123456', '0912'), false)
  assert.equal(phoneMatches('', '0905'), false)
})
