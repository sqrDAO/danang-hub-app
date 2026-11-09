import { useEffect, useState } from 'react'

const TICK_MS = 60 * 1000

// "Today" and "already started" are read from `now` at render, and nothing
// re-renders a page that is just left open, so both go stale: a PWA resumed the
// next morning would show today's booking with no entry pass. One shared `now`
// that ticks every minute (catches hub midnight and booking starts) and
// refreshes when the page is shown again (background timers are throttled).
const useHubNow = () => {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const refresh = () => setNow(new Date())
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    const timer = setInterval(refresh, TICK_MS)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  return now
}

export default useHubNow
