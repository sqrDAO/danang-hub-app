// List rows share a single mutation object, so `mutation.isPending` alone would
// disable an action on every row while one row is in flight. Match the
// in-flight variables against the row id instead, so only the row actually
// being submitted is disabled.
//
// Covers the variable shapes used across the app: a bare id string, or an
// object keyed by `id` / `eventId` / `uid`.
const targetIdOf = (variables) => {
  if (typeof variables === 'string') return variables
  if (!variables || typeof variables !== 'object') return null
  return variables.id ?? variables.eventId ?? variables.uid ?? null
}

// The id a mutation is currently acting on, or null when it is idle. Use this
// when the pending row has to be identified above the component that renders
// the rows; use isPendingFor when the row id is already in scope.
export const pendingTargetId = (mutation) =>
  mutation?.isPending ? targetIdOf(mutation.variables) : null

export const isPendingFor = (mutation, id) => {
  if (id == null) return false
  return pendingTargetId(mutation) === id
}
