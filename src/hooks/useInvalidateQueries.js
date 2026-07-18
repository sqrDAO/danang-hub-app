import { useQueryClient } from '@tanstack/react-query'

// Shared invalidation helper. Each key may be a scalar ('bookings') or a
// full queryKey array (['memberStats', uid]); arrays pass through unchanged.
export const useInvalidateQueries = () => {
  const queryClient = useQueryClient()
  return (...keys) => {
    keys.forEach(key => {
      queryClient.invalidateQueries({ queryKey: Array.isArray(key) ? key : [key] })
    })
  }
}
