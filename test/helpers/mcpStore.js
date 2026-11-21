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
  const query = (name, filters = [], max = Infinity, cursor = '') => ({
    doc: (id) => ref(`${name}/${id}`),
    where: (key, op, value) => query(name, [...filters, [key, op, value]], max, cursor),
    orderBy: () => query(name, filters, max, cursor),
    limit: (n) => query(name, filters, n, cursor),
    startAfter: (id) => query(name, filters, max, id),
    get: async () => {
      const docs = [...data.keys()].filter(path => path.startsWith(name + '/'))
        .sort().map(snapshot).filter(doc => doc.id > cursor && filters.every(([key, op, value]) =>
          op === 'in' ? value.includes(doc.data()[key]) : doc.data()[key] === value)).slice(0, max)
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
