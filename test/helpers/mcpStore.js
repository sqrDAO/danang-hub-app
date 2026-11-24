// Isolated Firestore-shaped repository. Writes commit only after callback success.
export const makeStore = (initial = {}, createdAt = Date.now()) => {
  const data = new Map(Object.entries(initial))
  const snapshot = (path) => ({
    id: path.split('/').at(-1),
    exists: data.has(path),
    data: () => data.get(path),
    createTime: data.has(path) ? { toMillis: () => createdAt } : undefined
  })
  const ref = (path) => ({ path, get: async () => snapshot(path) })
  // Timestamps and Dates compare by time, as Firestore orders them.
  const comparable = (value) => typeof value?.toMillis === 'function' ? value.toMillis()
    : value instanceof Date ? value.getTime() : value
  const matches = (doc, [key, op, value]) => {
    const field = doc.data()[key]
    if (op === 'in') return value.includes(field)
    if (op === '>') return field !== undefined && comparable(field) > comparable(value)
    return field === value
  }
  // orderBy(field) sorts by that field, then ID; any other orderBy is by ID.
  const byField = (field) => (a, b) => {
    const left = comparable(a.data()[field])
    const right = comparable(b.data()[field])
    return left < right ? -1 : left > right ? 1 : a.id < b.id ? -1 : 1
  }
  // startAfter takes an ID (ID order) or a snapshot (field order).
  const afterCursor = (docs, cursor) => {
    if (typeof cursor === 'string') return docs.filter(doc => doc.id > cursor)
    return docs.slice(docs.findIndex(doc => doc.id === cursor.id) + 1)
  }
  const query = (name, filters = [], max = Infinity, cursor = '', field = null) => ({
    doc: (id) => ref(`${name}/${id}`),
    where: (key, op, value) => query(name, [...filters, [key, op, value]], max, cursor, field),
    orderBy: (key) => query(name, filters, max, cursor, typeof key === 'string' ? key : null),
    limit: (n) => query(name, filters, n, cursor, field),
    startAfter: (after) => query(name, filters, max, after, field),
    get: async () => {
      const all = [...data.keys()].filter(path => path.startsWith(name + '/'))
        .sort().map(snapshot).filter(doc => filters.every(filter => matches(doc, filter)))
      if (field) all.sort(byField(field))
      const docs = afterCursor(all, cursor).slice(0, max)
      return { docs, size: docs.length, forEach: (fn) => docs.forEach(fn) }
    }
  })
  let queue = Promise.resolve()
  const db = { collection: (name) => query(name), runTransaction: (fn) => {
    const run = queue.then(async () => {
      const writes = []
      const tx = { get: (target) => target.get(),
        set: (ref, value) => writes.push(() => data.set(ref.path, value)),
        update: (ref, value) => writes.push(() => data.set(ref.path, { ...data.get(ref.path), ...value })),
        create: (ref, value) => writes.push(() => { if (data.has(ref.path)) throw Error('exists'); data.set(ref.path, value) }),
        delete: (ref) => writes.push(() => data.delete(ref.path)) }
      const result = await fn(tx)
      writes.forEach(write => write())
      return result
    })
    queue = run.catch(() => {})
    return run
  } }
  return { db, data }
}
