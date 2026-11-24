import { readFile } from 'node:fs/promises'
import { after, before, test } from 'node:test'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment
} from '@firebase/rules-unit-testing'
import { doc, setDoc, updateDoc } from 'firebase/firestore'

const hasEmulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST)
const projectId = process.env.GCLOUD_PROJECT || 'danang-hub-member-profile-fields-rules'
let testEnv

const seed = async (id, data) => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'members', id), data)
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
    await seed('admin-a', { membershipType: 'admin' })
    await seed('member-a', { membershipType: 'member', phone: '' })
    await seed('legacy-a', { membershipType: 'member', phone: '0905 123 456', gender: 'unknown' })
  })

  after(async () => testEnv.cleanup())

  const member = (uid) => doc(testEnv.authenticatedContext(uid).firestore(), 'members', uid)

  test('owners save an E.164 phone or clear it', async () => {
    await assertSucceeds(updateDoc(member('member-a'), { phone: '+84905123456' }))
    await assertSucceeds(updateDoc(member('member-a'), { phone: '' }))
  })

  test('owners cannot save a free-text or out-of-range phone', async () => {
    await assertFails(updateDoc(member('member-a'), { phone: '0905 123 456' }))
    await assertFails(updateDoc(member('member-a'), { phone: '+8412' }))
    await assertFails(updateDoc(member('member-a'), { phone: '+1234567890123456' }))
    await assertFails(updateDoc(member('member-a'), { phone: 84905123456 }))
  })

  test('owners pick a listed gender or clear it', async () => {
    for (const gender of ['female', 'male', 'other', 'prefer-not-to-say', '']) {
      await assertSucceeds(updateDoc(member('member-a'), { gender }))
    }
  })

  test('owners cannot save an unlisted gender', async () => {
    await assertFails(updateDoc(member('member-a'), { gender: 'robot' }))
  })

  test('writes that leave legacy values alone still work', async () => {
    await assertSucceeds(updateDoc(member('legacy-a'), { bio: 'hi' }))
  })

  test('a legacy phone can be normalized', async () => {
    await assertSucceeds(updateDoc(member('legacy-a'), { phone: '+84905123456' }))
  })

  test('a new profile cannot start with a free-text phone', async () => {
    await assertFails(setDoc(member('new-a'), { membershipType: 'member', phone: 'call me' }))
    await assertSucceeds(setDoc(member('new-b'), { membershipType: 'member', phone: '+6581234567', gender: 'female' }))
  })

  test('admins are not held to the owner checks', async () => {
    const adminDb = testEnv.authenticatedContext('admin-a').firestore()
    await assertSucceeds(updateDoc(doc(adminDb, 'members', 'member-a'), { phone: '0905 123 456' }))
  })
}
