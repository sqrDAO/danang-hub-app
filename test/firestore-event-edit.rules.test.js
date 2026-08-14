import { readFile } from 'node:fs/promises'
import { after, before, test } from 'node:test'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment
} from '@firebase/rules-unit-testing'
import { deleteDoc, doc, setDoc, updateDoc } from 'firebase/firestore'

const hasEmulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST)
const projectId = process.env.GCLOUD_PROJECT || 'danang-hub-event-edit-rules'
let testEnv

const event = (overrides = {}) => ({
  organizerId: 'organizer-a',
  status: 'pending',
  title: 'Future event',
  date: '2030-01-01T10:00:00.000Z',
  attendees: [],
  waitlist: [],
  revision: 1,
  ...overrides
})

const seedEvent = async (eventId, data) => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'events', eventId), data)
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
  })

  after(async () => testEnv.cleanup())

  test('organizers cannot directly edit event content', async () => {
    await seedEvent('direct-edit', event())
    const organizerDb = testEnv.authenticatedContext('organizer-a').firestore()

    await assertFails(updateDoc(
      doc(organizerDb, 'events', 'direct-edit'),
      { title: 'Bypass attempt' }
    ))
  })

  test('registrations are allowed only on approved events', async () => {
    await seedEvent('pending-event', event())
    await seedEvent('approved-event', event({ status: 'approved' }))
    const memberDb = testEnv.authenticatedContext('member-b').firestore()

    await assertFails(updateDoc(
      doc(memberDb, 'events', 'pending-event'),
      { attendees: ['member-b'] }
    ))
    await assertSucceeds(updateDoc(
      doc(memberDb, 'events', 'approved-event'),
      { attendees: ['member-b'] }
    ))
  })

  test('attendee writes cannot alter protected fields', async () => {
    await seedEvent('protected-fields', event({ status: 'approved' }))
    const memberDb = testEnv.authenticatedContext('member-b').firestore()

    await assertFails(updateDoc(
      doc(memberDb, 'events', 'protected-fields'),
      { attendees: ['member-b'], capacity: 999 }
    ))
  })

  test('only never-approved pending events are organizer-deletable', async () => {
    await seedEvent('ever-approved', event({ everApproved: true }))
    await seedEvent('never-approved', event({ everApproved: false }))
    const organizerDb = testEnv.authenticatedContext('organizer-a').firestore()

    await assertFails(deleteDoc(doc(organizerDb, 'events', 'ever-approved')))
    await assertSucceeds(deleteDoc(doc(organizerDb, 'events', 'never-approved')))
  })
}
