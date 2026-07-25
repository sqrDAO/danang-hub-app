import { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'

// Shared invalidation helper. Each key may be a scalar ('bookings') or a
// full queryKey array (['memberStats', uid]); arrays pass through unchanged.
// Memoized so the identity is stable across renders: every current caller uses
// it inside a mutation onSuccess, but a future caller putting it in a
// dependency array shouldn't have to discover that it wasn't.
export const useInvalidateQueries = () => {
  const queryClient = useQueryClient()
  return useCallback((...keys) => {
    keys.forEach(key => {
      queryClient.invalidateQueries({ queryKey: Array.isArray(key) ? key : [key] })
    })
  }, [queryClient])
}
