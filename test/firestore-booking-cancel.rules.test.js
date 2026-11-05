import { readFile } from 'node:fs/promises'
import { after, before, test } from 'node:test'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment
} from '@firebase/rules-unit-testing'
import { deleteField, doc, setDoc, updateDoc } from 'firebase/firestore'

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

  test('owners may still cancel their own pending booking', async () => {
    await seed('bookings', 'own-cancel', booking({ status: 'pending' }))
    const memberDb = testEnv.authenticatedContext('member-a').firestore()

    await assertSucceeds(updateDoc(
      doc(memberDb, 'bookings', 'own-cancel'),
      { status: 'cancelled' }
    ))
  })

  // Policy (#150): an approved booking counts toward the monthly desk-hours
  // limit, and its owner can't cancel it to win those hours back.
  for (const status of ['approved', 'checked-in', 'completed']) {
    test(`owners cannot cancel their own ${status} booking`, async () => {
      await seed('bookings', `own-${status}`, booking({ status }))
      const ref = doc(testEnv.authenticatedContext('member-a').firestore(), 'bookings', `own-${status}`)
      await assertFails(updateDoc(ref, { status: 'cancelled' }))
    })
  }

  // Desk-plan days sit outside the limit; Cancel Plan and Cancel day stay.
  for (const [planType, planGroupId] of [['fixed-desk', 'plan-1'], ['partner-desk', 'partner_member-a']]) {
    test(`owners can cancel an approved ${planType} day`, async () => {
      await seed('bookings', `own-${planType}`, booking({ planType, planGroupId }))
      const ref = doc(testEnv.authenticatedContext('member-a').firestore(), 'bookings', `own-${planType}`)
      await assertSucceeds(updateDoc(ref, { status: 'cancelled' }))
    })
  }

  test('owners cannot cancel a checked-in fixed-desk day', async () => {
    await seed('bookings', 'own-plan-in', booking({ status: 'checked-in', planType: 'fixed-desk', planGroupId: 'plan-1' }))
    const ref = doc(testEnv.authenticatedContext('member-a').firestore(), 'bookings', 'own-plan-in')
    await assertFails(updateDoc(ref, { status: 'cancelled' }))
  })

  // Members may set any well-formed planGroupId at create, so it can't be the key.
  test('a planGroupId alone does not make an approved booking cancellable', async () => {
    await seed('bookings', 'own-group-only', booking({ planGroupId: 'plan-1' }))
    const ref = doc(testEnv.authenticatedContext('member-a').firestore(), 'bookings', 'own-group-only')
    await assertFails(updateDoc(ref, { status: 'cancelled' }))
  })

  test('owners can still touch updatedAt alone', async () => {
    await seed('bookings', 'own-touch', booking())
    const ref = doc(testEnv.authenticatedContext('member-a').firestore(), 'bookings', 'own-touch')
    await assertSucceeds(updateDoc(ref, { updatedAt: '2030-01-01T00:00:00.000Z' }))
  })

  // The limit counts bookings by status; one without it counts zero hours.
  test('owners cannot remove status from their booking', async () => {
    await seed('bookings', 'own-drop-status', booking())
    const ref = doc(testEnv.authenticatedContext('member-a').firestore(), 'bookings', 'own-drop-status')
    await assertFails(updateDoc(ref, { status: deleteField() }))
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

  test('members cannot create a partner-desk booking; the sync writes those', async () => {
    const memberDb = testEnv.authenticatedContext('member-a').firestore()
    await assertFails(setDoc(doc(memberDb, 'bookings', 'pd_member-a_desk-1_20300101'),
      { ...booking({ status: 'pending' }), planType: 'partner-desk', planGroupId: 'partner_member-a' }))
    await assertSucceeds(setDoc(doc(memberDb, 'bookings', 'own-fixed'),
      { ...booking({ status: 'pending' }), planType: 'fixed-desk', planGroupId: 'plan-1' }))
  })

  test('a Fixed Desk day must belong to a plan', async () => {
    const memberDb = testEnv.authenticatedContext('member-a').firestore()
    await assertFails(setDoc(doc(memberDb, 'bookings', 'loose-fixed'),
      { ...booking({ status: 'pending' }), planType: 'fixed-desk' }))
  })

  test('owners cannot move or stretch a booking after creating it', async () => {
    await seed('bookings', 'own-fixed-times', booking({ status: 'pending' }))
    const ref = doc(testEnv.authenticatedContext('member-a').firestore(), 'bookings', 'own-fixed-times')
    await assertFails(updateDoc(ref, { endTime: new Date('2030-01-01T23:00:00.000Z') }))
    await assertFails(updateDoc(ref, { startTime: new Date('2030-01-01T00:00:00.000Z') }))
    await assertFails(updateDoc(ref, { amenityId: 'desk-2' }))
    await assertFails(updateDoc(ref, { memberId: 'member-b' }))
    await assertFails(updateDoc(ref, { limitHoursLeft: 40 }))
    await assertFails(updateDoc(ref, { limitMonth: '2030-01' }))
    await assertSucceeds(updateDoc(ref, { status: 'cancelled' }))
  })

  test('admins can still reschedule a booking', async () => {
    await seed('bookings', 'admin-move', booking())
    const adminDb = testEnv.authenticatedContext('admin-a').firestore()
    await assertSucceeds(updateDoc(doc(adminDb, 'bookings', 'admin-move'), { endTime: new Date('2030-01-01T11:00:00.000Z') }))
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
