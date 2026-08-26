export const resolveLocalDevMode = ({ isDev, skipAuthFlag }) =>
  isDev === true && skipAuthFlag === 'true'

// Vite inlines `import.meta.env.*` at build time. A function call would keep
// the in-memory store in the production bundle.
export const LOCAL_DEV_MODE = resolveLocalDevMode({
  isDev: Boolean(import.meta.env && import.meta.env.DEV),
  skipAuthFlag: import.meta.env && import.meta.env.VITE_SKIP_AUTH
})

export const isLocalDevMode = () => LOCAL_DEV_MODE

export const LOCAL_DEV_UID = 'local-dev-user'

export const getLocalDevProfile = () => ({
  uid: LOCAL_DEV_UID,
  displayName: 'Local Dev',
  email: 'local-dev@localhost',
  photoURL: '',
  company: 'Da Nang Blockchain Hub',
  jobTitle: 'Local Preview',
  membershipType: 'admin',
  preferences: {
    emailNotifications: false,
    eventReminders: false,
    pushNotifications: false
  }
})

export const getLocalDevUser = () => {
  const profile = getLocalDevProfile()
  return {
    uid: profile.uid,
    email: profile.email,
    displayName: profile.displayName,
    photoURL: profile.photoURL
  }
}
