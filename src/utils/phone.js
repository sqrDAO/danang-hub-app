// Member phone numbers, stored as E.164 (+84905123456). Pure helpers, no
// library: the hub only needs a dial-code picker, normalizing and display.
// firestore.rules checks the same E.164 shape on owner writes.

export const DEFAULT_PHONE_COUNTRY = 'VN'

// ISO 3166 region → dial code. Where regions share a code, the first listed
// wins when a stored number is split back into region + number.
export const PHONE_COUNTRIES = [
  ['VN', '84'], ['US', '1'], ['CA', '1'], ['GB', '44'], ['AU', '61'], ['NZ', '64'],
  ['SG', '65'], ['TH', '66'], ['MY', '60'], ['ID', '62'], ['PH', '63'], ['KH', '855'],
  ['LA', '856'], ['MM', '95'], ['CN', '86'], ['HK', '852'], ['TW', '886'], ['JP', '81'],
  ['KR', '82'], ['IN', '91'], ['PK', '92'], ['BD', '880'], ['AE', '971'], ['SA', '966'],
  ['IL', '972'], ['TR', '90'], ['RU', '7'], ['UA', '380'], ['DE', '49'], ['FR', '33'],
  ['NL', '31'], ['BE', '32'], ['CH', '41'], ['AT', '43'], ['IT', '39'], ['ES', '34'],
  ['PT', '351'], ['IE', '353'], ['SE', '46'], ['NO', '47'], ['DK', '45'], ['FI', '358'],
  ['PL', '48'], ['CZ', '420'], ['RO', '40'], ['GR', '30'], ['ZA', '27'], ['NG', '234'],
  ['KE', '254'], ['EG', '20'], ['BR', '55'], ['AR', '54'], ['MX', '52'], ['CO', '57'],
  ['CL', '56'],
].map(([region, dialCode]) => ({ region, dialCode }))

const E164 = /^\+[1-9]\d{7,14}$/
const PHONE_CHARACTERS = /^[\d\s\-+().]+$/
const INTERNATIONAL_PREFIX = /^(\+|00)/
// Italian numbers keep their leading 0 after the country code.
const KEEPS_TRUNK_ZERO = new Set(['IT'])

const digitsOf = (value) => String(value || '').replace(/\D/g, '')

const dialCodeFor = (region) =>
  (PHONE_COUNTRIES.find((country) => country.region === region) ||
    PHONE_COUNTRIES.find((country) => country.region === DEFAULT_PHONE_COUNTRY)).dialCode

// Longest dial code first: +855 is Cambodia, not +85x of something shorter.
const BY_DIAL_LENGTH = [...PHONE_COUNTRIES].sort((a, b) => b.dialCode.length - a.dialCode.length)
const countryForDigits = (digits) =>
  BY_DIAL_LENGTH.find((country) => digits.startsWith(country.dialCode)) || null

export const isE164 = (value) => E164.test(String(value || ''))

const withoutTrunkZero = (region, digits) =>
  KEEPS_TRUNK_ZERO.has(region) ? digits : digits.replace(/^0/, '')

// Separators carry no meaning, so "(+84) 0905…" reads like "+840905…".
const compactOf = (input) => input.replace(/[\s().-]/g, '')

// A full number with no national part shorter than 8 digits: E.164 numbers are
// at least 11 digits once a country code is typed out ("84 905 123 456",
// "1 415 555 0100"), while a national number like VinaPhone's 084… is 9-10.
const MIN_TYPED_INTERNATIONAL = 11

const typedDialCode = (region, digits) => {
  const dialCode = dialCodeFor(region)
  return digits.length >= MIN_TYPED_INTERNATIONAL && digits.startsWith(dialCode)
    ? dialCode
    : ''
}

// "+84 0905…": the trunk 0 never belongs after a country code (except Italy).
const fromInternationalDigits = (digits) => {
  const country = countryForDigits(digits)
  if (!country) return `+${digits}`
  const national = withoutTrunkZero(country.region, digits.slice(country.dialCode.length))
  return `+${country.dialCode}${national}`
}

// Picker region + national number; a country code typed without + is dropped.
const fromNationalDigits = (region, digits) => {
  const typed = typedDialCode(region, digits)
  return `+${dialCodeFor(region)}${withoutTrunkZero(region, digits.slice(typed.length))}`
}

/**
 * The E.164 number for what the member typed: a region from the picker and a
 * national number, or a full +/00 number pasted into the number input (then
 * the picker is ignored).
 * @returns {{value: string, valid: boolean}} value '' for an empty input.
 */
export const normalizePhone = (region, raw) => {
  const input = String(raw || '').trim()
  if (!input) return { value: '', valid: true }
  if (!PHONE_CHARACTERS.test(input)) return { value: input, valid: false }
  const compact = compactOf(input)
  const value = INTERNATIONAL_PREFIX.test(compact)
    ? fromInternationalDigits(digitsOf(compact.replace(/^00/, '')))
    : fromNationalDigits(region, digitsOf(compact))
  return { value, valid: isE164(value) }
}

const splitInternational = (digits) => {
  const country = countryForDigits(digits)
  return country && { region: country.region, national: digits.slice(country.dialCode.length) }
}

/**
 * Picker region and national number for a stored value, for the edit form.
 * Older free-text numbers are read as Vietnamese unless they carry a country
 * code; anything unreadable is returned as typed so the member can fix it.
 */
export const splitPhone = (stored) => {
  const input = String(stored || '').trim()
  const fallback = { region: DEFAULT_PHONE_COUNTRY, national: input }
  if (!input) return fallback
  const { value, valid } = normalizePhone(DEFAULT_PHONE_COUNTRY, input)
  return (valid && splitInternational(value.slice(1))) || fallback
}

/**
 * The phone to save from the edit form. Inputs still showing what the form
 * opened with keep the stored value as it is, so an older free-text number is
 * never rewritten or rejected by a save that didn't touch it.
 * @returns {{value: string, valid: boolean}}
 */
export const phoneForSave = (region, raw, stored) => {
  const prefill = splitPhone(stored)
  const untouched = region === prefill.region && String(raw || '').trim() === prefill.national
  return untouched ? { value: stored || '', valid: true } : normalizePhone(region, raw)
}

// 905123456 → "905 123 456"; a lone trailing digit joins the group before it.
const groupDigits = (digits) => {
  const groups = digits.match(/.{1,3}/g) || []
  const last = groups[groups.length - 1]
  if (groups.length > 1 && last.length === 1) {
    groups.splice(-2, 2, groups[groups.length - 2] + last)
  }
  return groups.join(' ')
}

/** "+84 905 123 456" for an E.164 number; anything else as stored. */
export const formatPhone = (stored) => {
  if (!isE164(stored)) return stored || ''
  const parts = splitInternational(stored.slice(1))
  return parts
    ? `+${dialCodeFor(parts.region)} ${groupDigits(parts.national)}`
    : stored
}

/** A tel: link that dials from anywhere for E.164, best effort for legacy text. */
export const phoneHref = (stored) =>
  `tel:${isE164(stored) ? stored : String(stored || '').replace(/[^\d+]/g, '')}`

// Stored, grouped, and the local trunk-0 form (0905123456) where it applies.
const phoneForms = (stored) => {
  if (!isE164(stored)) return [String(stored || '')]
  const parts = splitInternational(stored.slice(1))
  if (!parts) return [stored]
  const local = KEEPS_TRUNK_ZERO.has(parts.region) ? parts.national : `0${parts.national}`
  return [stored, formatPhone(stored), local]
}

const MIN_DIGIT_QUERY = 3

/**
 * Whether a search box query names this phone, however the admin types it:
 * "+84 905…", "0905 123 456", "905123". Digit queries ignore separators.
 */
export const phoneMatches = (stored, query) => {
  const needle = String(query || '').trim().toLowerCase()
  if (!needle || !stored) return false
  const forms = phoneForms(stored)
  if (forms.some((form) => form.toLowerCase().includes(needle))) return true
  const digits = digitsOf(needle)
  return PHONE_CHARACTERS.test(needle) && digits.length >= MIN_DIGIT_QUERY &&
    forms.some((form) => digitsOf(form).includes(digits))
}
