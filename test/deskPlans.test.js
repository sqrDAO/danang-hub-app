import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import {
  deskPlanBadgeKey,
  deskPlanCopyPrefix,
  deskPlanTypeFor,
  isDeskPlan,
  isSyncedPartnerPlan,
  normalizePartnerName as normalizePartnerNameClient
} from '../src/utils/deskPlans.js'

const require = createRequire(import.meta.url)
const { deskPlanLabel, isDeskPlan: isDeskPlanServer } = require('../functions/bookingNotifications.js')
const { matchPartnerForCompany, normalizePartnerName } = require('../functions/partners.js')

const partners = [
  { id: 'p-9am', name: '9AM Games', deskAmenityId: 'desk-1' },
  { id: 'p-diid', name: 'DiiD' }
]

test('partner members get partner desk plans, everyone else fixed desk', () => {
  assert.equal(deskPlanTypeFor({ partnerId: 'p-9am' }, partners), 'partner-desk')
  assert.equal(deskPlanTypeFor({ partnerId: null }, partners), 'fixed-desk')
  assert.equal(deskPlanTypeFor(null, partners), 'fixed-desk')
})

test('a partner without a desk keeps its members on the Fixed Desk flow', () => {
  assert.equal(deskPlanTypeFor({ partnerId: 'p-diid' }, partners), 'fixed-desk')
})

test('only the synced plan counts as the automatic partner desk', () => {
  assert.equal(isSyncedPartnerPlan({ planType: 'partner-desk', planGroupId: 'partner_m1' }), true)
  assert.equal(isSyncedPartnerPlan({ planType: 'partner-desk', planGroupId: 'a1b2-random' }), false)
  assert.equal(isSyncedPartnerPlan({ planType: 'fixed-desk', planGroupId: 'partner_m1' }), false)
})

test('a partnerId pointing at a removed partner falls back to fixed desk', () => {
  assert.equal(deskPlanTypeFor({ partnerId: 'p-gone' }, partners), 'fixed-desk')
  assert.equal(deskPlanTypeFor({ partnerId: 'p-9am' }), 'fixed-desk')
})

test('client and server normalize partner names the same way', () => {
  for (const name of ['9AM Games', ' 9am-games! ', 'DiiD', 'Công ty Đà Nẵng', '']) {
    assert.equal(normalizePartnerNameClient(name), normalizePartnerName(name), name)
  }
})

test('both plan types count as desk plans on client and server', () => {
  for (const check of [isDeskPlan, isDeskPlanServer]) {
    assert.equal(check('fixed-desk'), true)
    assert.equal(check('partner-desk'), true)
    assert.equal(check('standard'), false)
    assert.equal(check(undefined), false)
  }
})

test('plan copy keys follow the plan type', () => {
  assert.equal(deskPlanCopyPrefix('partner-desk'), 'partnerDesk')
  assert.equal(deskPlanCopyPrefix('fixed-desk'), 'fixedDesk')
  assert.equal(deskPlanBadgeKey('partner-desk'), 'partnerDesk.badge')
  assert.equal(deskPlanBadgeKey('fixed-desk'), 'fixedDesk.badge')
})

test('server copy never calls a partner plan a fixed desk plan', () => {
  assert.deepEqual(deskPlanLabel('partner-desk'), { en: 'partner desk', vi: 'bàn đối tác' })
  assert.deepEqual(deskPlanLabel('fixed-desk'), { en: 'fixed desk', vi: 'bàn cố định' })
})

test('company matching ignores case, spacing and punctuation', () => {
  assert.equal(normalizePartnerName(' 9AM-Games! '), '9amgames')
  for (const company of ['9AM Games', '9am games', '9AMGames', '9AM Games Studio']) {
    assert.equal(matchPartnerForCompany(company, partners)?.id, 'p-9am', company)
  }
  assert.equal(matchPartnerForCompany('diid', partners)?.id, 'p-diid')
})

test('unrelated or empty companies match nothing', () => {
  assert.equal(matchPartnerForCompany('Acme Labs', partners), null)
  assert.equal(matchPartnerForCompany('', partners), null)
  assert.equal(matchPartnerForCompany(undefined, partners), null)
  assert.equal(matchPartnerForCompany('ab', [{ id: 'short', name: 'AB' }]), null)
})

test('the longest matching partner name wins', () => {
  const nested = [{ id: 'games', name: 'Games' }, ...partners]
  assert.equal(matchPartnerForCompany('9AM Games', nested)?.id, 'p-9am')
})
