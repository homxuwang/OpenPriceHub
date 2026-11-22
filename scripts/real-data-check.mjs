// All writes target an isolated localhost Worker with temporary D1 state.
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.TEST_URL||'http://127.0.0.1:3001',api=process.env.OPERATIONS_TEST_API||'http://127.0.0.1:8788',key='real-data-e2e-test-key';
assert.equal(new URL(api).hostname,'127.0.0.1');assert.equal(new URL(api).port,'8788');
const browser=await chromium.launch({args:['--no-sandbox']});const errors=[];let checks=0;
try{
 for(const lang of ['zh','en'])for(const width of [1440,390]){
  const zh=lang==='zh',context=await browser.newContext({viewport:{width,height:950}}),page=await context.newPage(),tag=`${lang}-${width}-${Date.now()}`,name=`SIM live ${tag}`,dev=`dev-${tag}@example.com`,admin=`admin-${tag}@example.com`,password='isolated-test-password-123';
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/**',async route=>{const u=new URL(route.request().url());const response=await route.fetch({url:api+u.pathname+u.search});await route.fulfill({response});});
  for(const [email,role]of [[dev,'developer'],[admin,'admin']]){
   const r=await context.request.post(api+'/api/accounts/admin/users',{headers:{'X-Admin-Key':key},data:{email,password,role}});assert.equal(r.status(),200);checks++;
  }
  const login=async email=>{await page.goto(`${base}/${lang}/account`);await page.getByLabel('Email',{exact:true}).fill(email);await page.getByLabel(zh?'密码（至少 12 位）':'Password (12+ characters)',{exact:true}).fill(password);await page.getByRole('button',{name:zh?'登录':'Sign in',exact:true}).click();await page.getByRole('button',{name:zh?'退出':'Sign out',exact:true}).waitFor();};
  await login(dev);checks++;
  await page.getByRole('link',{name:zh?'提交新网站':'Submit website',exact:true}).click();
  await page.getByLabel(zh?'网站 / 产品名称':'Website / product name',{exact:true}).fill(name);
  await page.getByLabel(zh?'网站地址（HTTPS）':'Website URL (HTTPS)',{exact:true}).fill('https://sim-live.example.com');
  await page.getByLabel(zh?'价格来源地址（HTTPS）':'Pricing source URL (HTTPS)',{exact:true}).fill('https://sim-live.example.com/pricing');
  await page.getByLabel(zh?'联系邮箱（仅管理员可见）':'Contact email (administrator only)',{exact:true}).fill(dev);
  await page.getByRole('checkbox').check();await page.getByRole('button',{name:zh?'提交审核':'Submit for review',exact:true}).click();await page.getByRole('heading',{name:zh?'已提交，等待审核':'Received — awaiting review',exact:true}).waitFor();checks++;
  await page.goto(`${base}/${lang}/account`);await page.getByRole('button').filter({hasText:name}).waitFor();checks++;
  await page.getByRole('button',{name:zh?'退出':'Sign out',exact:true}).click();await page.getByRole('button',{name:zh?'登录':'Sign in',exact:true}).waitFor();await login(admin);checks++;
  await page.goto(`${base}/${lang}/admin`);await page.getByRole('button',{name:zh?'使用账户会话加载':'Load using account session',exact:true}).click();await page.getByRole('button').filter({hasText:name}).click();
  await page.getByRole('button',{name:zh?'添加套餐':'Add plan',exact:true}).click();
  await page.getByLabel(zh?'套餐名称':'Plan name',{exact:true}).fill('SIM monthly');await page.getByLabel(zh?'购买金额（空表示未知）':'Purchase amount (empty = unknown)',{exact:true}).fill('29.99');
  await page.getByLabel(zh?'购买周期':'Billing cycle',{exact:true}).selectOption('monthly');await page.getByRole('checkbox',{name:'pay-as-you-go',exact:true}).uncheck();await page.getByRole('checkbox',{name:'monthly',exact:true}).check();
  await page.getByRole('checkbox',{name:zh?'我已核对价格来源、渠道身份关系、币种、套餐权益与使用限制，同意发布当前版本。':'I verified pricing sources, channel relationship, currencies, entitlements and limits, and approve publishing this version.',exact:true}).check();await page.getByRole('button',{name:zh?'发布核对后的价格':'Publish verified prices',exact:true}).click();await page.getByRole('status').filter({hasText:zh?'已发布新价格版本':'New price version published'}).waitFor();checks++;
  await page.goto(`${base}/${lang}/tools?q=${encodeURIComponent(name)}`);await page.getByRole('link',{name,exact:true}).waitFor();assert.match(await page.locator('main').innerText(),/29\.99 USD \/ monthly/);assert.ok(!(await page.locator('main').innerText()).includes(dev));checks++;
  const published=await context.request.get(api+'/api/unified/catalog');const c=(await published.json()).data,p=c.products.find(p=>p.name===name);assert.ok(p);assert.ok(c.plans.some(plan=>plan.amount==='29.99'));checks++;
  await page.goto(`${base}/${lang}/tools/${p.slug}`);await page.getByRole('heading',{level:1,name,exact:true}).waitFor();assert.match(await page.locator('main').innerText(),/29\.99 USD/);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));checks++;
  await page.goto(`${base}/${lang}/compare?products=${p.slug}`);await page.getByRole('heading',{name,exact:true}).waitFor();assert.match(await page.locator('main').innerText(),/29\.99 USD/);checks++;
  await page.goto(`${base}/${lang}/admin/operations`);await page.getByRole('button',{name:zh?'加载管理数据':'Load operations',exact:true}).click();await page.getByRole('heading',{name:zh?'多管理员账户':'Administrator accounts',exact:true}).waitFor();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));checks++;
  await page.screenshot({path:`/tmp/oph-real-operations-${lang}-${width}.png`,fullPage:true});
  await page.goto(`${base}/${lang}/calculator`);await page.getByRole('button',{name:zh?/简单快速比价/:/^Quick comparison/}).click();await page.getByLabel('Rate mode',{exact:true}).selectOption('automatic');await page.waitForFunction(()=>document.querySelector('[aria-label=\"Rate mode\"]')?.value==='automatic');assert.match(await page.getByLabel('Rate source',{exact:true}).inputValue(),/frankfurter/);checks++;
  await context.close();
 }
 assert.deepEqual(errors,[]);console.log(`${checks} real-data/account browser checks passed; no page errors.`);
}finally{await browser.close();}
