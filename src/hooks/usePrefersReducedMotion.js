import { useEffect, useState } from 'react'

const QUERY = '(prefers-reduced-motion: reduce)'

const getMotionQuery = () => window.matchMedia?.(QUERY) ?? null

const readReducedMotion = () => Boolean(getMotionQuery()?.matches)

const usePrefersReducedMotion = () => {
  const [reduced, setReduced] = useState(readReducedMotion)

  useEffect(() => {
    const mq = getMotionQuery()
    if (!mq) return undefined
    const onChange = () => setReduced(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  return reduced
}

export default usePrefersReducedMotion
