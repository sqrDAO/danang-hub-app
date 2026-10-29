import { readFile } from 'node:fs/promises'
import { after, before, test } from 'node:test'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment
} from '@firebase/rules-unit-testing'
import { deleteField, doc, setDoc, updateDoc } from 'firebase/firestore'

const hasEmulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST)
const projectId = process.env.GCLOUD_PROJECT || 'danang-hub-booking-renewal-rules'
let testEnv

const booking = (overrides = {}) => ({
  memberId: 'member-a',
  amenityId: 'desk-1',
  status: 'approved',
  startTime: new Date('2030-01-01T02:00:00.000Z'),
  endTime: new Date('2030-01-01T10:00:00.000Z'),
  ...overrides
})

const seed = async (path, id, data) => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), path, id), data)
  })
}

if (!hasEmulator) {
  test.skip('Firestore rules tests require FIRESTORE_EMULATOR_HOST')
} else {
  before(async () => {
    testEnv = await initializeTestEnvironment({
      projectId,
      firestore: { rules: await readFile('firestore.rules', 'utf8') }
    })
    await seed('members', 'admin-a', { membershipType: 'admin' })
  })

  after(async () => testEnv.cleanup())

  const memberDb = () => testEnv.authenticatedContext('member-a').firestore()

  test('members may create a pending renewal day', async () => {
    await assertSucceeds(setDoc(doc(memberDb(), 'bookings', 'renew-ok'),
      booking({ status: 'pending', planType: 'fixed-desk', planGroupId: 'plan-b', renewalOf: 'plan-a' })))
  })

  test('renewalOf must be a safe id', async () => {
    await assertFails(setDoc(doc(memberDb(), 'bookings', 'renew-bad'),
      booking({ status: 'pending', planType: 'fixed-desk', renewalOf: 'bad/../id' })))
  })

  test('owners cannot add, change or remove renewalOf', async () => {
    await seed('bookings', 'own-plain', booking({ status: 'pending' }))
    await seed('bookings', 'own-renewal', booking({ status: 'pending', renewalOf: 'plan-a' }))
    await assertFails(updateDoc(doc(memberDb(), 'bookings', 'own-plain'), { renewalOf: 'plan-a' }))
    await assertFails(updateDoc(doc(memberDb(), 'bookings', 'own-renewal'), { renewalOf: 'plan-x' }))
    await assertFails(updateDoc(doc(memberDb(), 'bookings', 'own-renewal'), { renewalOf: deleteField() }))
  })

  test('owners cannot write rejectionReason; they can still cancel', async () => {
    await seed('bookings', 'own-renewal-2', booking({ status: 'pending', renewalOf: 'plan-a' }))
    const ref = doc(memberDb(), 'bookings', 'own-renewal-2')
    await assertFails(updateDoc(ref, { rejectionReason: 'x' }))
    await assertSucceeds(updateDoc(ref, { status: 'cancelled' }))
  })

  test('admins may reject a renewal with a reason', async () => {
    await seed('bookings', 'renewal-admin', booking({ status: 'pending', renewalOf: 'plan-a' }))
    const adminDb = testEnv.authenticatedContext('admin-a').firestore()
    await assertSucceeds(updateDoc(doc(adminDb, 'bookings', 'renewal-admin'),
      { status: 'cancelled', cancelledReason: 'renewal-rejected', rejectionReason: 'Desk reserved' }))
  })
}
