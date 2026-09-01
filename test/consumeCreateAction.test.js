import test from 'node:test'
import assert from 'node:assert/strict'
import { consumeCreateAction } from '../src/utils/consumeCreateAction.js'

const currentUser = { uid: 'member-1' }

const run = ({ search, isLoadingAmenities = false }) => {
  const calls = { open: [], create: [], params: [] }
  consumeCreateAction({
    searchParams: new URLSearchParams(search),
    currentUser,
    openCreateForAmenity: (id) => calls.open.push(id),
    handleOpenCreateModal: () => calls.create.push(true),
    setSearchParams: (params, opts) => calls.params.push({ params: params.toString(), opts }),
    isLoadingAmenities
  })
  return calls
}

test('defers create without amenityId while amenities are loading', () => {
  const calls = run({ search: 'action=create', isLoadingAmenities: true })
  assert.deepEqual(calls.open, [])
  assert.deepEqual(calls.create, [])
  assert.deepEqual(calls.params, [])
})

test('defers create with amenityId while amenities are loading', () => {
  const calls = run({ search: 'action=create&amenityId=local-hall', isLoadingAmenities: true })
  assert.deepEqual(calls.open, [])
  assert.deepEqual(calls.create, [])
  assert.deepEqual(calls.params, [])
})

test('opens the generic create modal after amenities resolve', () => {
  const calls = run({ search: 'action=create' })
  assert.deepEqual(calls.create, [true])
  assert.deepEqual(calls.open, [])
  assert.deepEqual(calls.params, [{ params: '', opts: { replace: true } }])
})

test('prefills a given amenity after amenities resolve', () => {
  const calls = run({ search: 'action=create&amenityId=local-hall' })
  assert.deepEqual(calls.open, ['local-hall'])
  assert.deepEqual(calls.create, [])
  assert.deepEqual(calls.params, [{ params: '', opts: { replace: true } }])
})

test('ignores non-create actions and signed-out visits', () => {
  const ignored = run({ search: 'action=register&eventId=evt-1' })
  assert.deepEqual(ignored.create, [])
  assert.deepEqual(ignored.params, [])

  const calls = { open: [], create: [], params: [] }
  consumeCreateAction({
    searchParams: new URLSearchParams('action=create'),
    currentUser: null,
    openCreateForAmenity: (id) => calls.open.push(id),
    handleOpenCreateModal: () => calls.create.push(true),
    setSearchParams: (params) => calls.params.push(params.toString()),
    isLoadingAmenities: false
  })
  assert.deepEqual(calls.create, [])
  assert.deepEqual(calls.params, [])
})
