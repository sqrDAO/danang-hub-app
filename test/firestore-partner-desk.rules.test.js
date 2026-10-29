import { readFile } from 'node:fs/promises'
import { after, before, test } from 'node:test'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment
} from '@firebase/rules-unit-testing'
import { addDoc, collection, doc, setDoc } from 'firebase/firestore'

const hasEmulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST)
const projectId = process.env.GCLOUD_PROJECT || 'danang-hub-partner-desk-rules'
let testEnv

const booking = (memberId, amenityId, overrides = {}) => ({
  memberId,
  amenityId,
  status: 'pending',
  startTime: new Date('2030-01-01T02:00:00.000Z'),
  endTime: new Date('2030-01-01T10:00:00.000Z'),
  ...overrides
})

const seed = async (path, id, data) => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), path, id), data)
  })
}

const create = (uid, data) =>
  addDoc(collection(testEnv.authenticatedContext(uid).firestore(), 'bookings'), data)

if (!hasEmulator) {
  test.skip('Firestore rules tests require FIRESTORE_EMULATOR_HOST')
} else {
  before(async () => {
    testEnv = await initializeTestEnvironment({
      projectId,
      firestore: { rules: await readFile('firestore.rules', 'utf8') }
    })
    await seed('members', 'admin-a', { membershipType: 'admin' })
    await seed('members', 'member-a', { membershipType: 'member' })
    await seed('members', 'partner-9am', { membershipType: 'member', partnerId: 'p-9am' })
    await seed('members', 'partner-diid', { membershipType: 'member', partnerId: 'p-diid' })
    await seed('partners', 'p-9am', { name: '9AM Games', deskAmenityId: 'desk-9am' })
    await seed('partners', 'p-diid', { name: 'DiiD', deskAmenityId: 'desk-diid' })
    await seed('amenities', 'desk-9am', { type: 'desk', capacity: 4, reservedForPartnerId: 'p-9am' })
    await seed('amenities', 'desk-diid', { type: 'desk', capacity: 4, reservedForPartnerId: 'p-diid' })
    await seed('amenities', 'desk-open', { type: 'desk', capacity: 4 })
    await seed('amenities', 'desk-released', { type: 'desk', capacity: 4, reservedForPartnerId: null })
  })

  after(async () => testEnv.cleanup())

  test('a member with no partner cannot book a reserved desk', async () => {
    await assertFails(create('member-a', booking('member-a', 'desk-9am')))
  })

  test("a partner's member can book their own partner's desk", async () => {
    await assertSucceeds(create('partner-9am', booking('partner-9am', 'desk-9am')))
  })

  test('a member of another partner cannot book the desk', async () => {
    await assertFails(create('partner-diid', booking('partner-diid', 'desk-9am')))
  })

  test('unreserved desks stay open to every member', async () => {
    await assertSucceeds(create('member-a', booking('member-a', 'desk-open')))
    await assertSucceeds(create('member-a', booking('member-a', 'desk-released')))
    await assertSucceeds(create('partner-diid', booking('partner-diid', 'desk-open')))
  })

  test('a booking on a missing amenity is not blocked by the reservation check', async () => {
    await assertSucceeds(create('member-a', booking('member-a', 'no-such-amenity')))
  })

  test('a member without a profile cannot book a reserved desk', async () => {
    await assertFails(create('ghost', booking('ghost', 'desk-9am')))
    await assertSucceeds(create('ghost', booking('ghost', 'desk-open')))
  })

  test('admins can book anyone on a reserved desk', async () => {
    await assertSucceeds(create('admin-a', booking('member-a', 'desk-9am', { status: 'approved' })))
  })

  test('the reservation does not loosen the other member-create checks', async () => {
    await assertFails(create('partner-9am', booking('partner-9am', 'desk-9am', { status: 'approved' })))
    await assertFails(create('partner-9am', booking('partner-9am', 'desk-9am', { planType: 'partner-desk' })))
  })
}
