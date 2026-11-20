// Run against `npm run dev:skipauth -- --host 127.0.0.1 --port 3019`.
// Playwright is intentionally installed outside the app; see the backlog Verify commands.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const base = 'http://127.0.0.1:3019';

async function checkPlacement(page) {
  await page.waitForTimeout(350); // let the real dialog entry animation settle
  const input = await page.getByRole('combobox', { name: 'Member', exact: true }).boundingBox();
  const list = await page.getByRole('listbox').boundingBox();
  assert(input && list);
  assert(Math.abs(input.x - list.x) < 3, 'list aligns with the input, not dialog coordinates');
  assert(Math.abs(list.y - input.y - input.height - 4) < 4 ||
    Math.abs(list.y + list.height - input.y + 4) < 4, 'list is tethered above or below input');
  const viewport = page.viewportSize();
  assert(list.x >= 0 && list.y >= 0 && list.x + list.width <= viewport.width + 1 &&
    list.y + list.height <= viewport.height + 1, 'list fits viewport');
  assert(await page.getByRole('listbox').getByRole('option').first().evaluate(element => {
    const rect = element.getBoundingClientRect();
    return element.contains(document.elementFromPoint(rect.x + 10, rect.y + 10));
  }), 'option is not clipped by the dialog');
}

async function verifyPicker(page) {
  await page.goto(`${base}/admin/bookings`);
  await page.getByRole('button', { name: 'Assign Booking', exact: true }).click();
  const input = page.getByRole('combobox', { name: 'Member', exact: true });
  await input.fill('a');
  await checkPlacement(page);
  await page.getByRole('listbox').getByRole('option').first().click();
  assert((await input.inputValue()).length > 1);
  await input.fill('a');
  await input.press('ArrowDown');
  const selected = await page.getByRole('listbox').getByRole('option', { selected: true }).locator('.member-combobox-name').textContent();
  await input.press('Enter');
  assert.equal(await input.inputValue(), selected);
  assert.equal(await page.getByRole('listbox').count(), 0);
  await input.fill('a');
  await input.press('Escape');
  assert.equal(await page.getByRole('listbox').count(), 0);
  assert.equal(await page.locator('dialog:modal').count(), 1, 'first Escape closes only suggestions');
  await input.press('ArrowDown');
  await page.setViewportSize({ width: 390, height: 844 });
  await checkPlacement(page);
  await page.locator('.modal-body').evaluate(element => { element.scrollTop += 20; });
  await checkPlacement(page);
  await page.screenshot({ path: '/tmp/pr219-fixed-member-picker.png' });
  await page.getByRole('listbox').getByRole('option').first().click();
  assert((await input.inputValue()).length > 1);
  await input.press('Escape');
  assert.equal(await page.locator('dialog:modal').count(), 0);
  console.log('PASS picker pointer, keyboard, Escape, viewport resize and scroll');
}

async function verifySaveAndExpiry(page) {
  await page.setViewportSize({ width: 1400, height: 1000 });
  await page.goto(`${base}/admin/amenities`);
  for (let repeat = 0; repeat < 3; repeat++) {
    await page.getByRole('button', { name: 'Edit', exact: true }).first().click();
    await page.getByRole('button', { name: 'Save Changes', exact: true }).click();
    await page.waitForFunction(() => !document.querySelector('dialog:modal'));
    await page.waitForFunction(() => document.querySelector('.toast-container:popover-open .toast'));
  }
  await page.screenshot({ path: '/tmp/pr219-fixed-save-toast.png' });
  // Queue a toast expiry and a close in the same task, without touching service data.
  await page.getByRole('button', { name: 'Edit', exact: true }).first().click();
  await page.evaluate(async () => {
    const { showToast } = await import('/src/utils/toast.js');
    showToast('Expiry regression', 'success', 0);
    setTimeout(() => document.querySelector('dialog .modal-close').click(), 0);
  });
  await page.waitForFunction(() => !document.querySelector('dialog:modal'));
  await page.waitForTimeout(200);
  assert.equal(await page.getByText('Expiry regression', { exact: true }).count(), 0);
  assert.equal(await page.locator('.error-boundary').count(), 0);
  console.log('PASS repeated actual amenity saves and toast expiry during modal close');
}

async function verifyStackedToast(page) {
  await page.goto(`${base}/admin/events`);
  await page.getByRole('button', { name: 'Rust & Solana: Zero to Hero', exact: true }).click();
  await page.locator('dialog').getByRole('button', { name: '1', exact: true }).click();
  await page.getByRole('button', { name: 'Copy emails', exact: true }).click();
  const toast = page.locator('.toast').first();
  await toast.waitFor();
  assert(await toast.evaluate(element => {
    const rect = element.getBoundingClientRect();
    return element.contains(document.elementFromPoint(rect.x + 20, rect.y + 20));
  }));
  await toast.locator('button').click();
  assert.equal(await page.locator('dialog:modal').count(), 2);
  await page.locator('dialog:modal').last().getByRole('button', { name: 'Copy emails', exact: true }).focus();
  await page.locator('dialog:modal').last().evaluate(dialog => dialog.close());
  await page.waitForTimeout(100);
  assert.equal(await page.locator('dialog:modal').count(), 2);
  assert.equal(await page.evaluate(() => document.activeElement.textContent), 'Copy emails');
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('dialog:modal').count(), 1);
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('dialog:modal').count(), 0);
  console.log('PASS stacked clickable toasts, refused native close focus and Escape');
}

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1400, height: 1000 },
      permissions: ['clipboard-read', 'clipboard-write'] });
    page.setDefaultTimeout(10000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => {
      const url = new URL(route.request().url());
      return url.hostname === '127.0.0.1' ? route.continue() : route.abort();
    });
    await verifyPicker(page);
    await verifySaveAndExpiry(page);
    await verifyStackedToast(page);
    assert.deepEqual(errors, [], 'no application errors during modal lifecycle regressions');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
