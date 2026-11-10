// Event emails go only to a Firebase-verified Auth email (getVerifiedEmail in
// functions/index.js), so the email switch follows the Auth user, never the
// member-editable profile email.
// 'verified': Google, or a password account that clicked the link.
// 'unverified': a password account that hasn't yet.
// 'none': a wallet (custom token) account, which has no Auth email.
export const getEmailStatus = (user) => {
  if (!user?.email) return 'none'
  return user.emailVerified ? 'verified' : 'unverified'
}
