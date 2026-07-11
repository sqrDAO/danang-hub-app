let toastIdCounter = 0
const toastListeners = new Set()

export const showToast = (message, type = 'info', duration = 3000) => {
  const id = ++toastIdCounter
  const toast = { id, message, type, duration }

  toastListeners.forEach(listener => listener(toast))
  return id
}

export const subscribeToToasts = (listener) => {
  toastListeners.add(listener)
  return () => {
    toastListeners.delete(listener)
  }
}
