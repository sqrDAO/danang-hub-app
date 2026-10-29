import { readFile } from 'node:fs/promises'
import { after, before, test } from 'node:test'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment
} from '@firebase/rules-unit-testing'
import { doc, setDoc, updateDoc } from 'firebase/firestore'

const hasEmulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST)
const projectId = process.env.GCLOUD_PROJECT || 'danang-hub-booking-fields-rules'
let testEnv

const booking = (overrides = {}) => ({
  memberId: 'member-a',
  amenityId: 'desk-1',
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

const memberDb = () => testEnv.authenticatedContext('member-a').firestore()

if (!hasEmulator) {
  test.skip('Firestore rules tests require FIRESTORE_EMULATOR_HOST')
} else {
  before(async () => {
    testEnv = await initializeTestEnvironment({
      projectId,
      firestore: { rules: await readFile('firestore.rules', 'utf8') }
    })
    await seed('members', 'admin-a', { membershipType: 'admin' })
    await seed('amenities', 'desk-1', { type: 'desk', capacity: 8 })
  })

  after(async () => testEnv.cleanup())

  test('a plain member booking can still be created', async () => {
    await assertSucceeds(setDoc(doc(memberDb(), 'bookings', 'plain'), booking()))
  })

  // These are written only by admins or the server; set at create they would
  // pass for the server's own marks.
  for (const field of ['cancelledReason', 'rejectionReason', 'limitHoursLeft', 'limitMonth', 'partnerId', 'checkInTime', 'checkOutTime']) {
    test(`members cannot create a booking with ${field}`, async () => {
      const value = field === 'limitHoursLeft' ? 4 : 'x'
      await assertFails(setDoc(doc(memberDb(), 'bookings', `with-${field}`), booking({ [field]: value })))
    })
  }

  test('members cannot create a booking at a Partner Desk sync id', async () => {
    await assertFails(setDoc(doc(memberDb(), 'bookings', 'pd_member-a_desk-1_20300101'), booking()))
  })

  test("members cannot create a booking in a Partner Desk sync's plan group", async () => {
    await assertFails(setDoc(doc(memberDb(), 'bookings', 'in-sync-group'),
      booking({ planType: 'fixed-desk', planGroupId: 'partner_member-a' })))
  })

  test('members can still create a Fixed Desk day in their own plan group', async () => {
    await assertSucceeds(setDoc(doc(memberDb(), 'bookings', 'own-plan'),
      booking({ planType: 'fixed-desk', planGroupId: 'plan-1', planPeriod: 'weekly' })))
  })

  test('admins may still create at any id with any field', async () => {
    const adminDb = testEnv.authenticatedContext('admin-a').firestore()
    await assertSucceeds(setDoc(doc(adminDb, 'bookings', 'pd_admin_x'), booking({ cancelledReason: 'x' })))
  })

  test('owners cannot change planType', async () => {
    await seed('bookings', 'relabel', booking({ status: 'approved' }))
    await assertFails(updateDoc(doc(memberDb(), 'bookings', 'relabel'), { planType: 'fixed-desk' }))
    await assertFails(updateDoc(doc(memberDb(), 'bookings', 'relabel'), { planType: 'partner-desk' }))
  })

  // Owners may only cancel: any other field, named or not, is fixed.
  for (const [field, value] of [['planPeriod', 'monthly'], ['notes', 'x'], ['status', 'approved']]) {
    test(`owners cannot write ${field}`, async () => {
      await seed('bookings', `own-${field}`, booking({ status: 'pending', planType: 'fixed-desk', planGroupId: 'g2', planPeriod: 'weekly' }))
      await assertFails(updateDoc(doc(memberDb(), 'bookings', `own-${field}`), { [field]: value }))
    })
  }

  test('owners can still cancel a desk plan day', async () => {
    await seed('bookings', 'plan-day', booking({ status: 'approved', planType: 'fixed-desk', planGroupId: 'g1' }))
    await assertSucceeds(updateDoc(doc(memberDb(), 'bookings', 'plan-day'), { status: 'cancelled' }))
  })
}
