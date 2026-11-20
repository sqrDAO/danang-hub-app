import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { profileErrorMessage } from '../src/utils/pushErrors.js'

for (const locale of ['en', 'vi']) {
  test(`push lifecycle errors use the existing ${locale} translation`, async () => {
    const messages = JSON.parse(await readFile(new URL(`../src/locales/${locale}.json`, import.meta.url), 'utf8'))
    const t = (key) => key.split('.').reduce((value, part) => value[part], messages)
    for (const code of ['push/timeout', 'push/revoke-failed', 'push/cleanup-failed', 'push/registration-failed']) {
      assert.equal(profileErrorMessage({ code, message: 'Raw English failure' }, t), messages.toast.profileUpdateFailed)
    }
    assert.equal(profileErrorMessage({ code: 'push/permission-denied' }, t), messages.profile.pushNotificationsDenied)
    assert.ok(messages.toast.pushCleanupWarning)
    assert.ok(messages.notifications.pushOptInFailed)
  })
}
