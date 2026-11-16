import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.TEST_URL || 'http://127.0.0.1:3001';
const browser = await chromium.launch({ args: ['--no-sandbox'] });
let checks = 0; const errors = [];
const field = (page, label) => page.getByText(label, { exact: true }).locator('..').locator('input');
async function uploadDetailed(page, data, name) {
  await page.locator('input[type=file]').setInputFiles({ name, mimeType:'application/json', buffer:Buffer.from(JSON.stringify(data)) });
  await page.getByRole('dialog',{name:'Import preview'}).getByRole('button',{name:/^(确认导入并替换|Confirm import and replace)$/}).click();
  // File.text() and React effects are asynchronous: wait for the actual imported state.
  await page.waitForFunction(expected => {
    const actual = JSON.parse(localStorage.getItem('oph.detailed-compare.v1'));
    return JSON.stringify(actual?.plans) === JSON.stringify(expected.plans) && JSON.stringify(actual?.rules) === JSON.stringify(expected.rules) && actual?.scenario.imageCount === expected.scenario.imageCount;
  }, data);
}
try {
 for (const locale of ['zh','en']) for (const width of [1440,390]) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, acceptDownloads: true });
  const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message)); const zh = locale === 'zh';
  await page.goto(`${base}/${locale}/calculator?type=image`);
  await page.getByRole('button', { name: zh ? '载入示例' : 'Load sample', exact: true }).click();
  await field(page, zh ? '图片张数' : 'Images').fill('100');
  const pro = page.getByTestId('comparison-row-rule-image-credit:plan-pro'), demo = page.getByTestId('comparison-row-rule-image-credit:plan-demo');
  assert.equal(await pro.getByTestId('credits-required').innerText(), '2000');
  assert.equal(await pro.getByTestId('package-count').innerText(), '2');
  assert.equal(await pro.getByTestId('purchase-amount').innerText(), '198 CNY');
  assert.equal(await pro.getByTestId('consumed-cost').innerText(), '165 CNY');
  assert.match(await pro.getByTestId('credits-remaining').innerText(), /^400/); checks++;
  await page.getByLabel('Comparison metric', { exact: true }).selectOption('purchase');
  const monthly = page.getByTestId('comparison-group').filter({ has: pro });
  assert.match(await monthly.locator('tbody tr').first().innerText(), /195 CNY/);
  assert.equal(await page.getByTestId('comparison-group').count(), 2); // Monthly package and usage billing stay separate.
  assert.equal(await demo.getByTestId('purchase-amount').innerText(), '195 CNY'); checks++;
  await field(page, '1 USD = ? CNY').fill('8');
  const direct = page.getByTestId('comparison-row-rule-image-direct:direct');
  assert.equal(await direct.getByTestId('purchase-amount').innerText(), '240 CNY');
  await page.getByText(zh ? '结果币种' : 'Target currency', { exact: true }).locator('..').locator('select').selectOption('USD');
  assert.equal(await pro.getByTestId('purchase-amount').innerText(), '24.75 USD');
  assert.equal(await pro.getByTestId('consumed-cost').innerText(), '20.625 USD'); checks++;
  // JSON keeps the entered usage and explicit terms, not an old default scenario.
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: zh ? '导出 JSON' : 'Export JSON', exact: true }).click();
  const download = await downloadPromise, exported=JSON.parse(await readFile(await download.path(), 'utf8'));
  assert.equal(exported.version,2);const json=exported.data;
  assert.equal(json.scenario.imageCount, 100); assert.equal(json.targetCurrency, 'USD');
  assert.equal(json.plans[1].purchaseTerms.stackable, true); assert.ok(json.rules[0].planIds.includes('plan-pro')); checks++;
  // Unknown terms, quota shortages and a wrong pool cannot become purchasable/free plans.
  const limited = structuredClone(json); limited.plans[1].purchaseTerms = { stackable: false, maxPackages: null };
  await uploadDetailed(page, limited, 'limited.json');
  assert.equal(await pro.getByTestId('purchase-amount').innerText(), '—');
  assert.match(await pro.innerText(), zh ? /单套餐额度不足/ : /non-combinable package/); checks++;
  limited.plans[1].purchaseTerms = { stackable: true, maxPackages: 1 };
  await uploadDetailed(page, limited, 'limit.json');
  assert.match(await pro.innerText(), zh ? /超过购买上限/ : /exceed the purchase limit/); checks++;
  limited.plans[1].purchaseTerms = { stackable: true, maxPackages: null }; limited.plans[1].creditPool='wrong-pool';
  await uploadDetailed(page, limited, 'pool.json');
  assert.match(await pro.innerText(), zh ? /积分池缺失或不一致/ : /credit pools are missing or different/); checks++;
  // Edit an eligible plan using the actual form, then confirm it still quotes correctly.
  await uploadDetailed(page, json, 'restore.json');
  await page.getByRole('button', { name: zh ? '2. 套餐' : '2. Plans', exact: true }).click();
  const planItem = page.getByText('99 元 / 1200 积分', { exact: true }).filter({ visible:true }).first().locator('../..');
  await planItem.getByRole('button', { name: zh ? '编辑' : 'Edit', exact: true }).click();
  await page.getByLabel('Stackable detailed-plan', { exact: true }).selectOption('false');
  await page.getByRole('button', { name: zh ? '更新套餐' : 'Update plan', exact: true }).click();
  assert.match(await pro.innerText(), zh ? /单套餐额度不足/ : /non-combinable package/); checks++;
  await page.getByRole('button', { name: zh ? '4. 模型价格' : '4. Model prices', exact:true }).click();
  const ruleItem = page.getByText('SIM Image Model', { exact:true }).first().locator('../..');
  await ruleItem.getByRole('button', { name: zh ? '编辑' : 'Edit', exact:true }).click();
  await page.getByLabel('Eligible plan plan-pro', { exact:true }).uncheck();
  await page.getByRole('button', { name: zh ? '更新模型价格' : 'Update model price', exact:true }).click();
  assert.equal(await pro.getByTestId('purchase-amount').innerText(), '—');
  assert.match(await pro.innerText(), zh ? /尚未确认此套餐适用/ : /Plan eligibility/); checks++;
  await page.getByRole('button', { name: zh ? /简单快速比价/ : /^Quick comparison/ }).click();
  await page.getByRole('button', { name: zh ? '载入示例' : 'Load sample', exact: true }).click();
  const quick = await page.evaluate(() => JSON.parse(localStorage.getItem('oph.manual-compare.v1'))), id = quick.items[0].id;
  const card = page.getByLabel(`Stackable ${id}`, { exact:true }).locator('xpath=ancestor::section[1]');
  await card.getByText(zh ? '套餐价格' : 'Plan price', { exact:true }).locator('..').locator('input').fill('99');
  await card.getByText(zh ? '套餐积分数' : 'Plan credits', { exact:true }).locator('..').locator('input').fill('1200');
  await field(page, zh ? '图片张数' : 'Images').fill('100');
  const q = page.getByTestId(`comparison-row-${id}`);
  assert.equal(await q.getByTestId('purchase-amount').innerText(), '198 CNY');
  assert.match(await q.getByTestId('credits-remaining').innerText(), /^400/); checks++;
  await page.getByLabel(`Stackable ${id}`, { exact:true }).selectOption('unknown');
  assert.equal(await q.getByTestId('purchase-amount').innerText(), '—');
  assert.equal(await q.getByTestId('consumed-cost').innerText(), '165 CNY');
  await page.getByLabel(`Stackable ${id}`, { exact:true }).selectOption('true');
  await page.getByLabel(`Max packages ${id}`, { exact:true }).fill('1');
  assert.equal(await q.getByTestId('purchase-amount').innerText(), '—');
  await page.getByLabel(`Max packages ${id}`, { exact:true }).fill('2');
  assert.equal(await q.getByTestId('purchase-amount').innerText(), '198 CNY'); checks++;
  await page.getByLabel(`Unit price ${id} per_image`, { exact:true }).fill('');
  assert.equal(await q.getByTestId('purchase-amount').innerText(), '—');
  assert.equal(await q.getByTestId('consumed-cost').innerText(), '—'); checks++;
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.goto(`${base}/${locale}`);
  assert.equal(await page.locator('[data-ad-slot]').count(), 2);
  assert.match(await page.locator('[data-ad-slot=home-primary]').innerText(), zh ? /广告位.*预留/ : /ADVERTISEMENT.*RESERVED/);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false); checks++;
  await page.screenshot({ path:`/tmp/oph-p1-${locale}-${width}.png`, fullPage:true });
  await context.close();
 }
 assert.deepEqual(errors, []); console.log(JSON.stringify({checks,pageErrors:errors,locales:['zh','en'],widths:[1440,390]}));
} finally { await browser.close(); }
