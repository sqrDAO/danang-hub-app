import { readFile } from 'node:fs/promises'
import { after, before, test } from 'node:test'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment
} from '@firebase/rules-unit-testing'
import { deleteDoc, doc, getDoc, setDoc } from 'firebase/firestore'

const hasEmulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST)
const projectId = process.env.GCLOUD_PROJECT || 'danang-hub-push-tokens-rules'
let testEnv

const device = (overrides = {}) => ({
  token: 'fcm-token-a',
  platform: 'web',
  updatedAt: '2030-01-01T00:00:00.000Z',
  ...overrides
})

const seed = async (path, data) => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), path), data)
  })
}

const memberDb = (uid = 'member-a') => testEnv.authenticatedContext(uid).firestore()

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

  test('owners can create their own device doc', async () => {
    await assertSucceeds(setDoc(doc(memberDb(), 'push_tokens/member-a/devices/phone-1'), device()))
  })

  test('owners can update their own device doc', async () => {
    await seed('push_tokens/member-a/devices/phone-2', device())
    await assertSucceeds(setDoc(
      doc(memberDb(), 'push_tokens/member-a/devices/phone-2'),
      device({ token: 'fcm-token-b' })
    ))
  })

  test('owners can delete their own device doc', async () => {
    await seed('push_tokens/member-a/devices/phone-3', device())
    await assertSucceeds(deleteDoc(doc(memberDb(), 'push_tokens/member-a/devices/phone-3')))
  })

  test('owners can delete their own legacy push token doc', async () => {
    await seed('push_tokens/member-a', { token: 'fcm-token-legacy' })
    await assertSucceeds(deleteDoc(doc(memberDb(), 'push_tokens/member-a')))
  })

  test('members cannot write another member\'s device docs', async () => {
    await seed('push_tokens/member-b/devices/phone-1', device())
    const otherDb = memberDb()
    await assertFails(setDoc(doc(otherDb, 'push_tokens/member-b/devices/phone-2'), device()))
    await assertFails(setDoc(doc(otherDb, 'push_tokens/member-b/devices/phone-1'), device()))
    await assertFails(deleteDoc(doc(otherDb, 'push_tokens/member-b/devices/phone-1')))
  })

  test('nobody can read device docs, including the owner', async () => {
    await seed('push_tokens/member-a/devices/phone-4', device())
    await assertFails(getDoc(doc(memberDb(), 'push_tokens/member-a/devices/phone-4')))
  })

  test('device docs with extra keys are refused', async () => {
    await assertFails(setDoc(
      doc(memberDb(), 'push_tokens/member-a/devices/phone-5'),
      device({ memberId: 'member-b' })
    ))
  })

  test('device docs with an empty token are refused', async () => {
    await assertFails(setDoc(doc(memberDb(), 'push_tokens/member-a/devices/phone-6'), device({ token: '' })))
  })

  test('device docs with a non-string token are refused', async () => {
    await assertFails(setDoc(doc(memberDb(), 'push_tokens/member-a/devices/phone-7'), device({ token: 42 })))
  })
}
