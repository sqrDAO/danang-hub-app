import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { initializeTestEnvironment, assertFails } from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore'

test('import counters are inaccessible to owners, other users, admins and guests', {
  skip: !process.env.FIRESTORE_EMULATOR_HOST
}, async () => {
  const env = await initializeTestEnvironment({
    projectId: 'demo-import-rate-limit',
    firestore: { rules: await readFile('firestore.rules', 'utf8') }
  })
  try {
    await env.withSecurityRulesDisabled(async context => {
      await setDoc(doc(context.firestore(), 'importRateLimits/owner'), { windowStart: 1, count: 10 })
      await setDoc(doc(context.firestore(), 'members/admin'), { membershipType: 'admin' })
    })
    for (const context of [env.authenticatedContext('owner'), env.authenticatedContext('other'), env.authenticatedContext('admin'), env.unauthenticatedContext()]) {
      const ref = doc(context.firestore(), 'importRateLimits/owner')
      await assertFails(getDoc(ref))
      await assertFails(setDoc(ref, { windowStart: 0, count: 0 }))
      await assertFails(deleteDoc(ref))
      await assertFails(setDoc(doc(context.firestore(), 'importRateLimits/new'), { count: 0 }))
    }
  } finally {
    await env.cleanup()
  }
})
