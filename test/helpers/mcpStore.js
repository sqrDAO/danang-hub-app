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
  // Firestore order: the orderBy fields, then document ID. A non-string key is
  // FieldPath.documentId(). startAfter takes values for those fields, as in
  // Firestore, so a cursor never depends on the document still matching.
  const valueOf = (doc, field) => field === '__name__' ? doc.id : comparable(doc.data()[field])
  const orderOf = (fields) => fields.includes('__name__') ? fields : [...fields, '__name__']
  const compare = (fields) => (a, b) => {
    for (const field of fields) {
      const left = valueOf(a, field)
      const right = valueOf(b, field)
      if (left < right) return -1
      if (left > right) return 1
    }
    return 0
  }
  const isAfter = (doc, fields, values) => {
    if (values.length === 0) return true
    for (const [index, value] of values.entries()) {
      const left = valueOf(doc, fields[index])
      const right = comparable(value)
      if (left !== right) return left > right
    }
    return false
  }
  const query = (name, filters = [], max = Infinity, cursor = [], fields = []) => ({
    doc: (id) => ref(`${name}/${id}`),
    where: (key, op, value) => query(name, [...filters, [key, op, value]], max, cursor, fields),
    orderBy: (key) => query(name, filters, max, cursor, [...fields, typeof key === 'string' ? key : '__name__']),
    limit: (n) => query(name, filters, n, cursor, fields),
    startAfter: (...values) => query(name, filters, max, values, fields),
    get: async () => {
      const order = orderOf(fields)
      const docs = [...data.keys()].filter(path => path.startsWith(name + '/'))
        .map(snapshot).filter(doc => filters.every(filter => matches(doc, filter)))
        .sort(compare(order)).filter(doc => isAfter(doc, order, cursor)).slice(0, max)
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
