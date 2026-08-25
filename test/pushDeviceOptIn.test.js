import test from 'node:test'
import assert from 'node:assert/strict'
import {
  DEVICE_OPTED_IN,
  DEVICE_OPTED_OUT,
  DEVICE_OPT_IN_UNKNOWN,
  shouldAdoptLegacyOptIn,
  shouldRefreshPushToken
} from '../src/utils/pushDeviceOptIn.js'

const refresh = (overrides) => shouldRefreshPushToken({
  eligible: true,
  permission: 'granted',
  deviceOptedIn: true,
  preferenceEnabled: true,
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

test('never refreshes while the account preference is off', () => {
  // Preference-off is account intent (desktop opt-out included). A phone that
  // still holds an opted-in marker must not re-issue a token or heal the field.
  assert.equal(refresh({ preferenceEnabled: false }), false)
})

test('defaults to not refreshing when inputs are missing', () => {
  assert.equal(shouldRefreshPushToken(), false)
  assert.equal(shouldRefreshPushToken({}), false)
})

const adopt = (overrides) => shouldAdoptLegacyOptIn({
  state: DEVICE_OPT_IN_UNKNOWN,
  preferenceEnabled: true,
  permission: 'granted',
  ...overrides
})

test('adopts a device that opted in before the marker existed', () => {
  // No marker + account preference on + permission granted can only describe a
  // device that opted in through the Profile toggle or the banner, both of
  // which predate the marker. These are the members already sitting on a dead
  // token, so without adoption the refresh reaches nobody who is broken today.
  assert.equal(adopt({}), true)
})

test('never adopts a device that recorded an opt-out', () => {
  assert.equal(adopt({ state: DEVICE_OPTED_OUT }), false)
})

test('never re-adopts a device already marked opted in', () => {
  // Already opted in takes the normal path; adoption must not double-write.
  assert.equal(adopt({ state: DEVICE_OPTED_IN }), false)
})

test('never adopts while the account preference is off', () => {
  // Preference-off is account intent, including leftover clears from the old
  // stale-token path. Leave it alone; the member re-enables in Profile once.
  assert.equal(adopt({ preferenceEnabled: false }), false)
})

test('never adopts without granted permission', () => {
  assert.equal(adopt({ permission: 'default' }), false)
  assert.equal(adopt({ permission: 'denied' }), false)
})

test('defaults to not adopting when inputs are missing', () => {
  assert.equal(shouldAdoptLegacyOptIn(), false)
  assert.equal(shouldAdoptLegacyOptIn({}), false)
})
