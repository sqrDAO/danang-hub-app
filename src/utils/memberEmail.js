// Proof is bound to an address: changing a contact email cannot reuse it.
export const isMemberEmailVerified = (member) =>
  Boolean(member?.email && member.verifiedEmail === member.email)

export const memberEmailFields = (user, profile = {}) => ({
  email: user.email || profile.email || '',
  verifiedEmail: user.email && user.emailVerified === true ? user.email : ''
})
