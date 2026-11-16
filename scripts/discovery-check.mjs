import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.TEST_URL || 'http://127.0.0.1:3001';
const apiPort = process.env.P1_API_TEST_PORT || '3002';
const apiBase = `http://127.0.0.1:${apiPort}`;
// A separate Vite process demonstrates build-time repository selection. No Worker or DB.
const vite = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', apiPort, '--strictPort'], { env: { ...process.env, VITE_P1_REPOSITORY: 'api' }, stdio: 'pipe' });
let logs = ''; vite.stdout.on('data', b => { logs += b; }); vite.stderr.on('data', b => { logs += b; });
let browser;
let checks = 0;
const errors = [];
try {
  for (let i = 0; i < 80; i++) {
    if (vite.exitCode !== null) throw new Error(logs);
    try { if ((await fetch(apiBase)).ok) break; } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  browser = await chromium.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(base + '/en/discovery-lab');
  await page.getByTestId('plan-image-a').waitFor();
  const fixture = await page.evaluate(async () => (await import('/src/shared/discovery/fixtures.ts')).createMockCatalog());
  for (const [mode, origin] of [['mock', base], ['api', apiBase]]) {
    if (mode === 'api') await page.route('**/api/p1/catalog', route => route.fulfill({ json: fixture }));
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      console.log(`Checking ${mode} at ${width}px`);
      await page.goto(origin + '/en/discovery-lab');
      await page.reload();
      await page.getByTestId('plan-image-a').waitFor({ timeout: 10000 }).catch(async e => { console.log((await page.locator('body').innerText()).slice(0,2000)); throw e; });
      assert.match(await page.getByTestId('simulation').innerText(), /SIMULATED DATA/);
      for (const [category, unit, quantity, purchase] of [['image', 'image', '20', '4'], ['video', 'second', '20', '4'], ['tts', 'character', '2000', '0.4'], ['music', 'song', '20', '4'], ['llm', 'input_token', '2000', '0.6']]) {
        await page.getByLabel('Discovery experience', { exact: true }).selectOption(category);
        await page.getByLabel(`Usage ${unit}`, { exact: true }).fill(quantity);
        const a = page.getByTestId(`plan-${category}-a`), b = page.getByTestId(`plan-${category}-b`);
        await a.getByTestId('purchase').filter({ hasText: `USD ${purchase}` }).waitFor();
        await page.getByLabel(`Reference ${category}-a`, { exact: true }).check();
        await page.getByLabel(`Compare ${category}-b`, { exact: true }).check();
        assert.match(await b.getByTestId('savings').innerText(), /50%/);
        assert.match(await page.getByRole('heading', { name: 'Alternative evidence' }).locator('..').innerText(), /commercial permission differs/);
        await page.getByLabel('Search', { exact: true }).fill('Channel B');
        assert.equal(await page.locator('article').count(), 1);
        assert.match(await page.locator('article').innerText(), /second provider/);
        await page.getByLabel('Search', { exact: true }).fill('');
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${mode}/${width}/${category} overflow`);
        checks++;
      }
      await page.getByLabel('Discovery experience', { exact: true }).selectOption('image');
      for (const [plan, expected] of [['image-a', '2'], ['free', '0'], ['monthly', '10'], ['annual', '120'], ['package', '10'], ['one_time', '10'], ['credits', '10']]) {
        assert.equal(await page.getByTestId(`plan-${plan}`).getByTestId('purchase').innerText(), `USD ${expected}`);
      }
      assert.match(await page.getByTestId('plan-missing').innerText(), /Missing price — not free/);
      assert.equal(await page.getByTestId('plan-missing').getByTestId('purchase').count(), 0);
      assert.match(await page.getByTestId('plan-expired').innerText(), /Expired price/);
      assert.match(await page.getByTestId('plan-wrong-pool').innerText(), /Credit pool mismatch/);
      await page.getByLabel('Billing credits', { exact: true }).check();
      assert.equal(await page.locator('article').count(), 2);
      await page.getByLabel('Billing monthly', { exact: true }).check();
      assert.equal(await page.locator('article').count(), 4);
      await page.getByLabel('Billing credits', { exact: true }).uncheck();
      await page.getByLabel('Billing monthly', { exact: true }).uncheck();
      await page.getByLabel('Require commercial use', { exact: true }).check();
      assert.match(await page.getByTestId('plan-image-b').innerText(), /Required capability missing/);
      await page.getByLabel('Search', { exact: true }).fill('no-such-fixture');
      assert.equal(await page.locator('article').count(), 0);
      checks++;
    }
  }
  fixture.experiences.push({ ...fixture.experiences[0], id: 'campaign', name: 'SIM new campaign', usage: { image: '30' } });
  await page.goto(apiBase + '/en/discovery-lab');
  await page.getByLabel('Discovery experience', { exact: true }).selectOption('campaign');
  assert.equal(await page.getByTestId('plan-image-a').getByTestId('purchase').innerText(), 'USD 6'); checks++;
  await page.getByLabel('Discovery experience', { exact: true }).selectOption('image');
  const search = page.getByRole('combobox', { name: 'Search', exact: true });
  await search.fill('mdlimg');
  await page.getByRole('option').filter({ hasText: 'SIM Model image-a' }).click();
  assert.equal(await page.getByTestId('plan-image-b').count(), 0);
  await page.getByRole('option').filter({ hasText: 'SIM Model image-b' }).click();
  await page.getByTestId('plan-image-b').waitFor();
  await page.getByRole('button', { name: 'Remove SIM Model image-a Model', exact: true }).click();
  assert.equal(await page.getByTestId('plan-image-a').count(), 0);
  await page.getByRole('button', { name: 'Clear selections', exact: true }).click();
  await page.getByTestId('plan-image-a').waitFor();
  await search.fill('Channel B');
  await page.getByRole('option').filter({ hasText: 'SIM Channel B' }).click();
  assert.equal(await page.locator('article').count(), 1);
  await search.press('Escape');
  assert.equal(await page.getByRole('listbox').count(), 0);
  await page.getByLabel('Discovery experience', { exact: true }).selectOption('video');
  await page.getByTestId('plan-video-a').waitFor();
  assert.equal(await page.getByRole('button', { name: 'Clear selections', exact: true }).count(), 0);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  checks++;
  await page.unroute('**/api/p1/catalog');
  await page.route('**/api/p1/catalog', route => route.fulfill({ status: 503, body: 'Unavailable' }));
  await page.reload();
  await page.getByRole('alert').waitFor();
  assert.match(await page.getByRole('alert').innerText(), /503/);
  assert.equal(await page.locator('article').count(), 0); checks++;
  await page.unroute('**/api/p1/catalog');
  await page.route('**/api/p1/catalog', route => route.fulfill({ json: {} }));
  await page.reload(); await page.getByRole('alert').waitFor();
  assert.match(await page.getByRole('alert').innerText(), /Invalid catalog/); checks++;
  await page.goto(base + '/zh/discovery-lab');
  await page.getByTestId('simulation').waitFor();
  assert.match(await page.getByTestId('simulation').innerText(), /模拟数据/);
  assert.match(await page.getByLabel('Discovery experience', { exact: true }).innerText(), /文生图/);
  assert.doesNotMatch(await page.getByLabel('Discovery experience', { exact: true }).innerText(), /SIM/); checks++;
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ checks, pageErrors: errors, modes: ['mock', 'api-intercepted'], widths: [1440, 390] }));
} finally {
  await browser?.close();
  vite.kill('SIGTERM');
}
