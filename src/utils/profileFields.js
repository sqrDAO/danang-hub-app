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
