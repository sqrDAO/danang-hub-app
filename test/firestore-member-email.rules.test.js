import { readFile } from 'node:fs/promises'
import { after, before, test } from 'node:test'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment
} from '@firebase/rules-unit-testing'
import { deleteField, doc, setDoc, updateDoc } from 'firebase/firestore'

const hasEmulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST)
const projectId = process.env.GCLOUD_PROJECT || 'danang-hub-member-email-rules'
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
    await seed('google-a', { membershipType: 'member', email: 'a@hub.dev' })
    await seed('legacy-a', { membershipType: 'member', email: 'typed@other.dev' })
    await seed('legacy-b', { membershipType: 'member', email: 'typed@other.dev' })
    await seed('wallet-a', { membershipType: 'member', email: '' })
  })

  after(async () => testEnv.cleanup())

  // Auth email in the ID token, as Firebase sets it; a wallet token has none.
  const memberDb = (uid, email) =>
    testEnv.authenticatedContext(uid, email ? { email, email_verified: true } : {}).firestore()
  const member = (uid, email) => doc(memberDb(uid, email), 'members', uid)

  test('owners can set the profile email to their Auth email', async () => {
    await assertSucceeds(updateDoc(member('legacy-a', 'real@hub.dev'), { email: 'real@hub.dev' }))
  })

  test('owners cannot set the profile email to another address', async () => {
    await assertFails(updateDoc(member('google-a', 'a@hub.dev'), { email: 'victim@hub.dev' }))
  })

  test('a wallet account without an Auth email types its own contact email', async () => {
    await assertSucceeds(updateDoc(member('wallet-a'), { email: 'me@wallet.dev' }))
    await assertSucceeds(updateDoc(member('wallet-a'), { email: '' }))
  })

  test('writes that leave the email alone still work, even a legacy mismatch', async () => {
    await assertSucceeds(updateDoc(member('google-a', 'a@hub.dev'), { bio: 'hi' }))
    await assertSucceeds(updateDoc(member('wallet-a'), { bio: 'hi' }))
    await assertSucceeds(updateDoc(member('legacy-b', 'real@hub.dev'), { bio: 'hi' }))
  })

  test('owners create with their Auth email, or none; a wallet account with any', async () => {
    const create = (uid, email, data) =>
      setDoc(member(uid, email), { membershipType: 'member', ...data })
    await assertSucceeds(create('new-google', 'g@hub.dev', { email: 'g@hub.dev' }))
    await assertSucceeds(create('new-wallet', null, { email: '' }))
    await assertSucceeds(create('new-wallet-typed', null, { email: 'me@wallet.dev' }))
    await assertFails(create('new-liar', 'l@hub.dev', { email: 'victim@hub.dev' }))
  })

  test('owners cannot remove a synced email', async () => {
    await assertFails(updateDoc(member('google-a', 'a@hub.dev'), { email: deleteField() }))
  })

  test('admins can still edit other members', async () => {
    const adminDb = memberDb('admin-a', 'admin@hub.dev')
    await assertSucceeds(updateDoc(doc(adminDb, 'members', 'google-a'), { displayName: 'A' }))
  })
}
