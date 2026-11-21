// Member documents normally carry ISO strings, but console-created documents
// can carry Firestore Timestamps. Unknown dates belong after every valid date.
const creationTime = (value) => {
  if (typeof value?.toDate === 'function') value = value.toDate()
  if (!(value instanceof Date) && typeof value !== 'string' && typeof value !== 'number') return -Infinity
  const time = new Date(value).getTime()
  return Number.isFinite(time) ? time : -Infinity
}

export const compareMembersCreatedAt = (a, b) => {
  const first = creationTime(a.createdAt)
  const second = creationTime(b.createdAt)
  if (first === second) return 0
  return first > second ? -1 : 1
}
