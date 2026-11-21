import { useEffect, useState } from 'react'

export const useMcpTokenCooldown = (metadata, receivedAt) => {
  const [retryAt, setRetryAt] = useState(0)
  const [now, setNow] = useState(Date.now)
  // Use server remaining duration, not server wall time: member clocks may differ.
  const serverDeadline = metadata?.retryAfterMs ? receivedAt + metadata.retryAfterMs : 0
  const deadline = Math.max(serverDeadline, retryAt)
  const seconds = Math.max(0, Math.ceil((deadline - Math.max(now, receivedAt)) / 1000))
  const running = seconds > 0
  useEffect(() => {
    if (deadline <= Date.now()) return
    const timer = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(timer)
  }, [deadline, running])
  const wait = (duration) => {
    const time = Date.now()
    setNow(time)
    setRetryAt(time + duration)
  }
  return { seconds, wait }
}
