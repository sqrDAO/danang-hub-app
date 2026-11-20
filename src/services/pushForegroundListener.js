/** Share an in-flight start only within the current listener generation. */
export const createForegroundListener = ({ isSupported, start, onStop }) => {
  let generation = 0
  let pending = null
  let stopListener = null

  const ensure = () => {
    if (stopListener) return Promise.resolve(stopListener)
    if (pending?.generation === generation) return pending.promise
    const attempt = { generation }
    attempt.promise = (async () => {
      try {
        if (!(await isSupported()) || attempt.generation !== generation) return undefined
        stopListener = start()
        return stopListener
      } finally {
        if (pending === attempt) pending = null
      }
    })()
    pending = attempt
    return attempt.promise
  }

  const stop = () => {
    generation += 1
    try {
      stopListener?.()
    } finally {
      stopListener = null
      onStop()
    }
  }
  return { ensure, stop }
}
