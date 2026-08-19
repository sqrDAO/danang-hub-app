import test from 'node:test'
import assert from 'node:assert/strict'
import { shouldRefreshPushToken } from '../src/utils/pushDeviceOptIn.js'

const refresh = (overrides) => shouldRefreshPushToken({
  eligible: true,
  permission: 'granted',
  deviceOptedIn: true,
  ...overrides
})

test('refreshes when the device is eligible, permitted, and opted in', () => {
  assert.equal(refresh({}), true)
})

test('never refreshes without the device opt-in marker', () => {
  // disablePushNotifications leaves Notification.permission granted, so the
  // marker is the only thing separating an explicit opt-out from a live opt-in.
  assert.equal(refresh({ deviceOptedIn: false }), false)
})

test('never refreshes unless permission is already granted', () => {
  // 'default' must not refresh: requesting permission at launch is exactly what
  // this path is designed to avoid.
  assert.equal(refresh({ permission: 'default' }), false)
  assert.equal(refresh({ permission: 'denied' }), false)
})

test('never refreshes on a device that cannot register push', () => {
  assert.equal(refresh({ eligible: false }), false)
})

test('defaults to not refreshing when inputs are missing', () => {
  assert.equal(shouldRefreshPushToken(), false)
  assert.equal(shouldRefreshPushToken({}), false)
})
