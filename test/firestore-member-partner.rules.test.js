import { readFile } from 'node:fs/promises'
import { after, before, test } from 'node:test'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment
} from '@firebase/rules-unit-testing'
import { deleteField, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore'

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
    await assertSucceeds(setDoc(doc(memberDb('new-b'), 'members', 'new-b'), { displayName: 'B', membershipType: 'member' }))
  })

  test('owners create their profile only as a member', async () => {
    await assertFails(setDoc(doc(memberDb('new-c'), 'members', 'new-c'), { membershipType: 'admin' }))
    await assertFails(setDoc(doc(memberDb('new-f'), 'members', 'new-f'), { membershipType: null }))
    await assertFails(setDoc(doc(memberDb('new-g'), 'members', 'new-g'), { membershipType: 'Admin' }))
    await assertFails(setDoc(doc(memberDb('new-e'), 'members', 'new-e'), { displayName: 'E' }))
    await assertSucceeds(setDoc(doc(memberDb('new-d'), 'members', 'new-d'), { membershipType: 'member' }))
  })

  test('owners cannot change or remove their membershipType', async () => {
    await seed('members', 'member-t', { membershipType: 'member' })
    const ref = doc(memberDb('member-t'), 'members', 'member-t')
    await assertFails(updateDoc(ref, { membershipType: 'admin' }))
    await assertFails(updateDoc(ref, { membershipType: deleteField() }))
    await assertSucceeds(updateDoc(ref, { bio: 'still editable' }))
  })

  test('a legacy profile with no membershipType cannot be promoted by its owner', async () => {
    await seed('members', 'member-legacy', { displayName: 'Old' })
    const ref = doc(memberDb('member-legacy'), 'members', 'member-legacy')
    await assertFails(updateDoc(ref, { membershipType: 'admin' }))
    await assertSucceeds(updateDoc(ref, { bio: 'still editable' }))
  })

  test('admins set membershipType only to member or admin', async () => {
    await seed('members', 'member-promote', { membershipType: 'member' })
    const ref = doc(memberDb('admin-a'), 'members', 'member-promote')
    await assertSucceeds(updateDoc(ref, { membershipType: 'admin' }))
    await assertSucceeds(updateDoc(ref, { membershipType: 'member' }))
    await assertFails(updateDoc(ref, { membershipType: 'Admin' }))
    await assertFails(updateDoc(ref, { membershipType: '' }))
  })

  test('admins can still edit a legacy profile with no membershipType', async () => {
    await seed('members', 'member-legacy-2', { displayName: 'Old' })
    await assertSucceeds(updateDoc(doc(memberDb('admin-a'), 'members', 'member-legacy-2'), { displayName: 'New' }))
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
