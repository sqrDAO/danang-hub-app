import { readFile } from 'node:fs/promises'
import { after, before, test } from 'node:test'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment
} from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore'

const hasEmulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST)
const projectId = process.env.GCLOUD_PROJECT || 'danang-hub-member-partner-rules'
let testEnv

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
    await seed('members', 'member-a', { membershipType: 'member', displayName: 'A' })
    await seed('members', 'partner-a', { membershipType: 'member', partnerId: 'p-9am' })
    await seed('partners', 'p-9am', { name: '9AM Games' })
  })

  after(async () => testEnv.cleanup())

  const memberDb = (uid) => testEnv.authenticatedContext(uid).firestore()

  test('owners can still edit their own profile', async () => {
    await assertSucceeds(updateDoc(doc(memberDb('member-a'), 'members', 'member-a'), { bio: 'hi' }))
    await assertSucceeds(updateDoc(doc(memberDb('partner-a'), 'members', 'partner-a'), { bio: 'hi' }))
  })

  test('owners cannot attach themselves to a partner', async () => {
    await assertFails(updateDoc(doc(memberDb('member-a'), 'members', 'member-a'), { partnerId: 'p-9am' }))
  })

  test('owners cannot change or clear their partner', async () => {
    const ref = doc(memberDb('partner-a'), 'members', 'partner-a')
    await assertFails(updateDoc(ref, { partnerId: 'other' }))
    await assertFails(updateDoc(ref, { partnerId: null }))
  })

  test('owners cannot create a profile already attached to a partner', async () => {
    await assertFails(setDoc(doc(memberDb('new-a'), 'members', 'new-a'), { partnerId: 'p-9am' }))
    await assertSucceeds(setDoc(doc(memberDb('new-b'), 'members', 'new-b'), { displayName: 'B' }))
  })

  test('admins can attach and detach members', async () => {
    const ref = doc(memberDb('admin-a'), 'members', 'member-a')
    await assertSucceeds(updateDoc(ref, { partnerId: 'p-9am' }))
    await assertSucceeds(updateDoc(ref, { partnerId: null }))
  })

  test('signed-in users read partners; only admins write them', async () => {
    await assertSucceeds(getDoc(doc(memberDb('member-a'), 'partners', 'p-9am')))
    await assertFails(getDoc(doc(testEnv.unauthenticatedContext().firestore(), 'partners', 'p-9am')))
    await assertFails(setDoc(doc(memberDb('member-a'), 'partners', 'p-x'), { name: 'X' }))
    await assertSucceeds(setDoc(doc(memberDb('admin-a'), 'partners', 'p-x'), { name: 'X' }))
  })
}
