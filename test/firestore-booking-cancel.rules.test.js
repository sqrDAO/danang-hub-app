import { readFile } from 'node:fs/promises'
import { after, before, test } from 'node:test'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment
} from '@firebase/rules-unit-testing'
import { doc, setDoc, updateDoc } from 'firebase/firestore'

const hasEmulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST)
const projectId = process.env.GCLOUD_PROJECT || 'danang-hub-booking-cancel-rules'
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

  test('owners may still cancel their own booking', async () => {
    await seed('bookings', 'own-cancel', booking())
    const memberDb = testEnv.authenticatedContext('member-a').firestore()

    await assertSucceeds(updateDoc(
      doc(memberDb, 'bookings', 'own-cancel'),
      { status: 'cancelled' }
    ))
  })

  // cancelledReason is the actor signal behind the cancellation notification.
  // An owner able to write it could forge that notice to themselves.
  test('owners cannot write cancelledReason', async () => {
    await seed('bookings', 'forge-reason', booking())
    const memberDb = testEnv.authenticatedContext('member-a').firestore()

    await assertFails(updateDoc(
      doc(memberDb, 'bookings', 'forge-reason'),
      { status: 'cancelled', cancelledReason: 'hub-closure-independence-day-2026' }
    ))
  })

  test('owners cannot add cancelledReason without cancelling', async () => {
    await seed('bookings', 'reason-only', booking())
    const memberDb = testEnv.authenticatedContext('member-a').firestore()

    await assertFails(updateDoc(
      doc(memberDb, 'bookings', 'reason-only'),
      { cancelledReason: 'admin' }
    ))
  })

  test('admins may write cancelledReason', async () => {
    await seed('bookings', 'admin-cancel', booking())
    const adminDb = testEnv.authenticatedContext('admin-a').firestore()

    await assertSucceeds(updateDoc(
      doc(adminDb, 'bookings', 'admin-cancel'),
      { status: 'cancelled', cancelledReason: 'admin' }
    ))
  })
}
