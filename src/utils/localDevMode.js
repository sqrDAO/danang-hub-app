export const resolveLocalDevMode = ({ isDev, skipAuthFlag }) =>
  isDev === true && skipAuthFlag === 'true'

// Inline so Rollup constant-folds this to false in production and tree-shakes
// the in-memory store. Optional chaining keeps Node tests (no import.meta.env).
export const LOCAL_DEV_MODE = import.meta.env?.DEV === true
  && import.meta.env?.VITE_SKIP_AUTH === 'true'

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
