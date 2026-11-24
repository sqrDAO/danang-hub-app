import test from 'node:test'
import assert from 'node:assert/strict'
import { formatPhone, normalizePhone, phoneHref, phoneSearchText, splitPhone } from '../src/utils/phone.js'

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

test('search text covers stored, grouped and local forms', () => {
  const text = phoneSearchText('+84905123456')
  for (const needle of ['+84905123456', '905 123', '0905123456', '905123456']) {
    assert.ok(text.includes(needle), needle)
  }
})
