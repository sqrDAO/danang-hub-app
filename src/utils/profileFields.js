// The fields a profile needs before the hub's gated pages open. One list, so
// the route guard (isProfileComplete), the save check and the Profile banner
// can't disagree about what is missing.
export const REQUIRED_PROFILE_FIELDS = [
  { key: 'displayName', label: 'profile.name', error: 'profile.validation.nameRequired' },
  { key: 'company', label: 'profile.company', error: 'profile.validation.companyRequired' },
  { key: 'jobTitle', label: 'profile.role', error: 'profile.validation.jobTitleRequired' },
]

export const missingProfileFields = (profile) =>
  REQUIRED_PROFILE_FIELDS.filter(({ key }) => !profile?.[key]?.trim())

// Optional, self-reported gender for the hub's aggregate gender-balance
// reporting (UN SDG 5). Only the member and admins can read member docs.
// firestore.rules accepts the same values on owner writes.
export const GENDER_OPTIONS = ['female', 'male', 'other', 'prefer-not-to-say']

// The select's value for a stored gender: a listed value, else blank (an
// admin can write anything, which the select can't show).
export const genderSelectValue = (gender) =>
  GENDER_OPTIONS.includes(gender) ? gender : ''

// Locale key for a stored gender, or null for blank or unlisted values.
export const genderLabelKey = (gender) =>
  GENDER_OPTIONS.includes(gender) ? `profile.genderOptions.${gender}` : null
