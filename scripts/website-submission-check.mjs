// Run only against an isolated local Worker/D1. Never points writes at production.
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.TEST_URL||'http://127.0.0.1:3001';
const api=process.env.WEBSITE_TEST_API||'http://127.0.0.1:8788';
assert.equal(new URL(api).hostname,'127.0.0.1','Only isolated local API allowed');
const key=process.env.WEBSITE_TEST_KEY||'website-e2e-test-key';
const browser=await chromium.launch({args:['--no-sandbox']});let checks=0;const errors=[];
try{
 for(const locale of ['zh','en'])for(const width of [1440,390]){
  const zh=locale==='zh',context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage();
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{Object.defineProperty(Crypto.prototype,'randomUUID',{value:undefined,configurable:true});});
  await page.route('**/api/websites**',async route=>{const u=new URL(route.request().url());const response=await route.fetch({url:api+u.pathname+u.search});await route.fulfill({response});});
  const name=`SIM E2E ${locale} ${width} ${Date.now()}`;
  await page.goto(`${base}/${locale}/submit`);
  await page.getByRole('link',{name:zh?'独立开发者？提交我的网站与价格 →':'Independent developer? Submit my website and prices →'}).click();
  assert.ok(page.url().includes('/submit/website'));checks++;
  await page.getByLabel(zh?'网站 / 产品名称':'Website / product name',{exact:true}).fill(name);
  await page.getByLabel(zh?'网站地址（HTTPS）':'Website URL (HTTPS)',{exact:true}).fill('https://sim-e2e.example.com');
  await page.getByLabel(zh?'价格来源地址（HTTPS）':'Pricing source URL (HTTPS)',{exact:true}).fill('https://sim-e2e.example.com/pricing');
  await page.getByLabel(zh?'联系邮箱（仅管理员可见）':'Contact email (administrator only)',{exact:true}).fill('private-e2e@example.com');
  await page.getByRole('checkbox').check();
  await page.getByRole('button',{name:zh?'提交审核':'Submit for review',exact:true}).click();
  await page.getByRole('heading',{name:zh?'已提交，等待审核':'Received — awaiting review',exact:true}).waitFor();checks++;
  const before=await page.request.get(api+'/api/websites');assert.ok(!(await before.text()).includes(name));checks++;
  await page.goto(`${base}/${locale}/admin`);
  await page.getByLabel(zh?'管理员密钥':'Administrator key',{exact:true}).fill('wrong');
  await page.getByRole('button',{name:zh?'加载审核列表':'Load review queue',exact:true}).click();
  await page.getByRole('alert').waitFor();assert.match(await page.getByRole('alert').innerText(),/administrator key/);checks++;
  await page.getByLabel(zh?'管理员密钥':'Administrator key',{exact:true}).fill(key);
  await page.getByRole('button',{name:zh?'加载审核列表':'Load review queue',exact:true}).click();
  await page.getByRole('button').filter({hasText:name}).click();
  await page.getByText('private-e2e@example.com',{exact:false}).waitFor();
  await page.getByRole('button',{name:zh?'添加套餐':'Add plan',exact:true}).click();
  await page.getByLabel(zh?'套餐名称':'Plan name',{exact:true}).fill('SIM monthly');
  await page.getByLabel(zh?'购买金额（空表示未知）':'Purchase amount (empty = unknown)',{exact:true}).fill('99.123456789012');
  await page.getByLabel(zh?'购买周期':'Billing cycle',{exact:true}).selectOption('monthly');
  await page.getByRole('checkbox',{name:'pay-as-you-go',exact:true}).uncheck();
  await page.getByRole('checkbox',{name:'monthly',exact:true}).check();
  await page.getByRole('button',{name:zh?'保存草稿':'Save draft',exact:true}).click();
  await page.getByRole('status').filter({hasText:zh?'审核草稿已保存':'Review saved'}).waitFor();checks++;
  const saved=await page.request.get(api+'/api/websites');assert.ok(!(await saved.text()).includes(name));checks++;
  await page.getByRole('checkbox',{name:zh?'我已核对价格来源、渠道身份关系、币种、套餐权益与使用限制，同意发布当前版本。':'I verified pricing sources, channel relationship, currencies, entitlements and limits, and approve publishing this version.',exact:true}).check();
  await page.getByRole('button',{name:zh?'发布核对后的价格':'Publish verified prices',exact:true}).click();
  await page.getByRole('status').filter({hasText:zh?'已发布新价格版本':'New price version published'}).waitFor();checks++;
  await page.goto(`${base}/${locale}/websites`);
  const card=page.getByRole('article').filter({hasText:name});await card.waitFor();
  assert.match(await card.innerText(),/99\.123456789012 USD/);assert.ok(!(await page.locator('main').innerText()).includes('private-e2e@example.com'));checks++;
  const snapshot=await page.request.get(api+'/api/websites');const json=await snapshot.json();assert.ok(!JSON.stringify(json).includes('private-e2e@example.com'));checks++;
  await page.getByLabel(zh?'渠道类型':'Channel type',{exact:true}).selectOption('official');assert.equal(await page.getByRole('article').filter({hasText:name}).count(),0);checks++;
  await page.getByLabel(zh?'渠道类型':'Channel type',{exact:true}).selectOption('all');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));checks++;
  await page.screenshot({path:`/tmp/oph-website-prices-${locale}-${width}.png`,fullPage:true});
  await context.close();
 }
 assert.deepEqual(errors,[]);console.log(`${checks} website submission/browser checks passed; no page errors.`);
}finally{await browser.close();}
