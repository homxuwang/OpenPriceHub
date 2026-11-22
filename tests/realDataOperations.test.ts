import { beforeEach,afterEach,it,expect,vi } from 'vitest';
import { webcrypto } from 'node:crypto';
import { database } from './helpers/d1';
import { handleAccounts } from '../src/worker/routes/accounts';
import { handleWebsites } from '../src/worker/routes/websites';
import { handlePlatforms } from '../src/worker/routes/platforms';
import { handleModels } from '../src/worker/routes/models';
import { principal,digest } from '../src/worker/services/auth';
import { loadUnified,handleUnified } from '../src/worker/routes/unified';
import { checkSources,syncFx,readFx,safeSource } from '../src/worker/services/operations';
import { handleOperations } from '../src/worker/routes/operations';
import { emptyWebsiteDraft,emptyWebsitePlan } from '../src/shared/websiteSubmission';
vi.stubGlobal('crypto',webcrypto);
let db:ReturnType<typeof database>;
beforeEach(()=>{db=database();});afterEach(()=>db.close());
function request(path:string,method='GET',body?:unknown,cookie?:string,key?:string){return new Request('https://test.example.com/api/'+path,{method,headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{}),...(key?{'X-Admin-Key':key}:{})},body:body===undefined?undefined:JSON.stringify(body)});}
async function account(path:string,method='GET',body?:unknown,cookie?:string,key?:string,fetcher?:typeof fetch){const r=await handleAccounts(request('accounts/'+path,method,body,cookie,key),db.env,{},fetcher);return {status:r.status,body:await r.json() as any,cookie:r.headers.get('Set-Cookie')?.split(';')[0]};}
async function user(role='developer',email='sim@example.com'){
 if(role==='developer')await account('register','POST',{email,password:'test-password-12345'});else await account('admin/users','POST',{email,password:'test-password-12345',role},undefined,db.env.ADMIN_KEY);
 const result=await account('login','POST',{email,password:'test-password-12345'});expect(result.status).toBe(200);return result.cookie!;
}
const draft=()=>({...emptyWebsiteDraft(),name:'SIM tested site',website:'https://sim.example.com',pricingUrl:'https://sim.example.com/pricing',plans:[{...emptyWebsitePlan(),name:'SIM monthly',billing:'monthly' as const,pricingModels:['monthly'],amount:'12.123456789012'}]});
async function submit(cookie?:string,id='sim-test-submission-00001'){
 return handleWebsites(request('websites/submissions','POST',{requestId:id,contactEmail:'sim@example.com',consent:true,draft:draft()},cookie),db.env,{});
}
async function publish(cookie?:string,version=1){return handleWebsites(request('websites/admin/submissions/sim-test-submission-00001','PUT',{action:'publish',version,draft:draft(),confirmed:true},cookie,cookie?undefined:db.env.ADMIN_KEY),db.env,{});}
const dns=(url:RequestInfo|URL)=>new URL(String(url)).hostname==='cloudflare-dns.com';
it('denies every unauthenticated legacy write before touching the database',async()=>{
 for(const handler of [handlePlatforms,handleModels])for(const method of ['POST','PUT','DELETE']){
  const r=await handler(request(handler===handleModels?'models/a':'platforms/a',method,{}),db.env,{});expect(r.status).toBe(401);
 }
 expect(db.sql('SELECT count(*) AS n FROM models')[0].n).toBe(6);
});
it('stores password hashes and opaque session digests; logout revokes sessions',async()=>{
 const cookie=await user();const row=db.sql('SELECT * FROM users')[0];expect(row.password_hash).not.toBe('test-password-12345');expect(row.password_hash).toHaveLength(64);expect(db.sql('SELECT token_hash FROM auth_sessions')[0].token_hash).not.toBe(cookie.slice(12));
 expect((await principal(request('accounts/me','GET',undefined,cookie),db.env))?.role).toBe('developer');
 await account('logout','POST',{},cookie);expect(await principal(request('accounts/me','GET',undefined,cookie),db.env)).toBeNull();
});
it('does not let developers assign themselves administrator roles or use legacy writes',async()=>{
 const cookie=await user();expect((await account('admin/users','POST',{email:'other@example.com',password:'password-1234567',role:'admin'},cookie)).status).toBe(403);
 expect((await handleModels(request('models','POST',{name:'bad',category:'image'},cookie),db.env,{})).status).toBe(401);
});
it('supports multiple admins and reviewers; reviewers cannot publish',async()=>{
 const reviewer=await user('reviewer');await submit();expect((await publish(reviewer)).status).toBe(403);
 const admin=await user('admin','admin@example.com');expect((await publish(admin)).status).toBe(200);
 expect(db.sql('SELECT actor FROM website_review_logs')[0].actor).toBe(db.sql("SELECT id FROM users WHERE role='admin'")[0].id);
});
it('disabling an account immediately revokes its existing sessions',async()=>{
 const cookie=await user('admin'),id=db.sql('SELECT id FROM users')[0].id;
 expect((await account('admin/disable','POST',{id},undefined,db.env.ADMIN_KEY)).status).toBe(200);
 expect(await principal(request('accounts/me','GET',undefined,cookie),db.env)).toBeNull();
});
it('rejects cross-origin authenticated mutations',async()=>{
 const r=request('accounts/admin/users','POST',{email:'a@example.com',password:'test-password-12345',role:'admin'},undefined,db.env.ADMIN_KEY);r.headers.set('Origin','https://evil.example.com');expect((await handleAccounts(r,db.env,{})).status).toBe(403);
});
it('developer ownership is bound to account ID, never the submitted contact email',async()=>{
 await submit();const cookie=await user();expect((await account('submissions','GET',undefined,cookie)).body.data.submissions).toEqual([]);
});
it('requires DNS ownership before self-service resubmission and keeps public prices unchanged',async()=>{
 const cookie=await user();await submit(cookie);await publish();const before=db.sql('SELECT public_json FROM listing_price_versions')[0].public_json;
 expect((await account('submissions/sim-test-submission-00001','PUT',{version:2,draft:draft()},cookie)).status).toBe(403);
 await account('domains','POST',{hostname:'sim.example.com'},cookie);const claim=db.sql('SELECT * FROM domain_claims')[0];
 const fetcher=vi.fn(async()=>new Response(JSON.stringify({Status:0,Answer:[{type:16,data:JSON.stringify(claim.token)}]}))) as unknown as typeof fetch;
 expect((await account('domains/verify','POST',{hostname:'sim.example.com'},cookie,undefined,fetcher)).status).toBe(200);
 expect((await account('submissions/sim-test-submission-00001','PUT',{version:2,draft:{...draft(),name:'SIM changed'}},cookie)).status).toBe(200);
 expect(db.sql('SELECT public_json FROM listing_price_versions')[0].public_json).toBe(before);expect(db.sql('SELECT status FROM website_submissions')[0].status).toBe('pending');
});
it('DNS TXT must match the account-specific token; expired challenges cannot verify',async()=>{
 const cookie=await user();await account('domains','POST',{hostname:'sim.example.com'},cookie);
 const fetcher=vi.fn(async()=>new Response(JSON.stringify({Status:0,Answer:[{type:16,data:'"wrong"'}]}))) as unknown as typeof fetch;
 expect((await account('domains/verify','POST',{hostname:'sim.example.com'},cookie,undefined,fetcher)).status).toBe(409);
 db.sql("UPDATE domain_claims SET expires_at='2000-01-01'");expect((await account('domains/verify','POST',{hostname:'sim.example.com'},cookie,undefined,fetcher)).status).toBe(400);
});
it('unifies old catalog and approved channel plans without matching model names',async()=>{
 await submit();await publish();const c=await loadUnified(db.env);const offer=c.offers.find(o=>o.id.startsWith('listing-offer:'))!;
 expect(c.products).toHaveLength(11);expect(offer.modelId).toBeNull();expect(c.plans.find(p=>p.offerId===offer.id)!.amount).toBe('12.123456789012');
 expect(c.plans.filter(p=>p.precision==='legacy-number').every(p=>p.stale)).toBe(true);
 const before=c.revision;const listing=db.sql('SELECT id FROM channel_listings')[0].id;
 const r=await handleUnified(request('unified/admin/link','PUT',{listingId:listing,productId:db.sql("SELECT id FROM products WHERE category_id='image' LIMIT 1")[0].id,modelId:db.sql("SELECT id FROM models WHERE category='image' LIMIT 1")[0].id},undefined,db.env.ADMIN_KEY),db.env,{});expect(r.status).toBe(200);
 const after=await loadUnified(db.env);expect(after.products).toHaveLength(10);expect(after.revision).not.toBe(before);
});
it('refuses direct access to unpublished submissions from the unified catalog',async()=>{
 await submit();expect((await loadUnified(db.env)).products).toHaveLength(10);
});
it('source page monitoring stores changes and no price candidate or publication',async()=>{
 db.sql("INSERT INTO source_monitors(id,url,adapter,interval_hours,enabled) VALUES('s','https://official.example.com/pricing','page-watch',24,1)");
 const fetcher=vi.fn(async(url:RequestInfo|URL)=>dns(url)?new Response(JSON.stringify({Status:0,Answer:[{type:1,data:'93.184.216.34'}]})):new Response('<html>SIM changed page</html>')) as unknown as typeof fetch;
 expect((await checkSources(db.env,fetcher))[0].status).toBe('page_changed');expect(db.sql('SELECT count(*) AS n FROM source_candidates')[0].n).toBe(0);expect(await checkSources(db.env,fetcher)).toEqual([]);
});
it('structured collection creates a review candidate and never publishes automatically',async()=>{
 await submit();await publish();db.sql("INSERT INTO source_monitors(id,url,adapter,submission_id,interval_hours,enabled) VALUES('s','https://official.example.com/pricing.json','website-json-v1','sim-test-submission-00001',12,1)");
 const changed=draft();changed.plans[0].amount='9';const fetcher=vi.fn(async(url:RequestInfo|URL)=>dns(url)?new Response(JSON.stringify({Status:0,Answer:[{type:1,data:'93.184.216.34'}]})):new Response(JSON.stringify(changed))) as unknown as typeof fetch;
 expect((await checkSources(db.env,fetcher))[0].status).toBe('candidate_pending');expect(db.sql('SELECT count(*) AS n FROM listing_price_versions')[0].n).toBe(1);
 const id=db.sql('SELECT id FROM source_candidates')[0].id;
 expect((await handleOperations(request('operations/admin/candidate','POST',{id,action:'apply'},undefined,db.env.ADMIN_KEY),db.env,{},fetcher)).status).toBe(200);
 expect(JSON.parse(db.sql('SELECT draft_json FROM website_submissions')[0].draft_json).plans[0].amount).toBe('9');expect(db.sql('SELECT count(*) AS n FROM listing_price_versions')[0].n).toBe(1);
});
it('private resolved source addresses are rejected before source fetching',async()=>{
 const fetcher=vi.fn(async()=>new Response(JSON.stringify({Status:0,Answer:[{type:1,data:'127.0.0.1'}]}))) as unknown as typeof fetch;await expect(safeSource('https://evil.example.com',fetcher)).rejects.toThrow('Private');
});
it('FX keeps provider date, inverts units correctly, rebases exactly and retains valid snapshot on failure',async()=>{
 const today=new Date().toISOString().slice(0,10),fetcher=vi.fn(async()=>new Response(JSON.stringify({base:'USD',date:today,rates:{CNY:7.2,EUR:0.9}}))) as unknown as typeof fetch;
 await syncFx(db.env,fetcher);const fx=await readFx(db.env,'CNY');expect(fx.ratesExact.USD).toBe('7.2');expect(fx.ratesExact.EUR).toBe('8');expect(fx.rateMeta.mode).toBe('automatic');expect(fx.rateMeta.updatedAt).toBe(today+'T00:00:00Z');
 expect((await readFx(db.env,'EUR')).ratesExact.USD).toBe('0.9');expect(await syncFx(db.env,fetcher)).toEqual({skipped:true});
 db.sql("UPDATE fx_snapshots SET checked_at='2000-01-01'");await expect(syncFx(db.env,vi.fn(async()=>new Response('{}',{status:500})) as unknown as typeof fetch)).rejects.toThrow();expect((await readFx(db.env)).ratesExact.USD).toBe('7.2');
});
it('session expiry and malformed tokens fail closed',async()=>{
 const cookie=await user();db.sql("UPDATE auth_sessions SET expires_at='2000-01-01'");expect(await principal(request('accounts/me','GET',undefined,cookie),db.env)).toBeNull();expect(await digest('token')).toHaveLength(64);
});
it('password changes revoke sessions and require the new password',async()=>{
 const cookie=await user();expect((await account('password','POST',{currentPassword:'test-password-12345',newPassword:'changed-test-password-456'},cookie)).status).toBe(200);expect(await principal(request('accounts/me','GET',undefined,cookie),db.env)).toBeNull();
 expect((await account('login','POST',{email:'sim@example.com',password:'test-password-12345'})).status).toBe(401);expect((await account('login','POST',{email:'sim@example.com',password:'changed-test-password-456'})).status).toBe(200);
});
it('a failed structured parse never advances the successful content hash',async()=>{
 await submit();db.sql("INSERT INTO source_monitors(id,url,adapter,submission_id,interval_hours,enabled) VALUES('s','https://official.example.com/pricing.json','website-json-v1','sim-test-submission-00001',12,1)");
 const bad=vi.fn(async(url:RequestInfo|URL)=>dns(url)?new Response(JSON.stringify({Status:0,Answer:[{type:1,data:'93.184.216.34'}]})):new Response('{invalid')) as unknown as typeof fetch;
 expect((await checkSources(db.env,bad))[0].status).toBe('failed');expect(db.sql('SELECT last_hash FROM source_monitors')[0].last_hash).toBeNull();
 const good=vi.fn(async(url:RequestInfo|URL)=>dns(url)?new Response(JSON.stringify({Status:0,Answer:[{type:1,data:'93.184.216.34'}]})):new Response(JSON.stringify({...draft(),name:'SIM recollected'}))) as unknown as typeof fetch;
 expect((await checkSources(db.env,good,true))[0].status).toBe('candidate_pending');
});
it('stale source candidates cannot overwrite a newer administrator draft',async()=>{
 await submit();db.sql("INSERT INTO source_monitors(id,url,adapter,submission_id,interval_hours,enabled) VALUES('s','https://official.example.com/pricing.json','website-json-v1','sim-test-submission-00001',12,1)");
 db.sql("INSERT INTO source_candidates(id,source_id,submission_id,base_version,payload_json,created_at) VALUES('c','s','sim-test-submission-00001',1,?,?)",[JSON.stringify(draft()),new Date().toISOString()]);
 db.sql('UPDATE website_submissions SET version=2');const spy=vi.spyOn(console,'error').mockImplementation(()=>{});
 const r=await handleOperations(request('operations/admin/candidate','POST',{id:'c',action:'apply'},undefined,db.env.ADMIN_KEY),db.env,{});spy.mockRestore();expect(r.status).toBe(409);expect(db.sql('SELECT version FROM website_submissions')[0].version).toBe(2);expect(db.sql('SELECT status FROM source_candidates')[0].status).toBe('pending');
});
it('reviewed candidate final states and audit records are immutable',async()=>{
 await submit();db.sql("INSERT INTO source_monitors(id,url,adapter,interval_hours) VALUES('s','https://official.example.com','page-watch',24)");
 db.sql("INSERT INTO source_candidates(id,source_id,submission_id,base_version,payload_json,created_at) VALUES('c','s','sim-test-submission-00001',1,'{}','now')");db.sql("UPDATE source_candidates SET status='rejected' WHERE id='c'");
 expect(()=>db.sql("UPDATE source_candidates SET status='applied' WHERE id='c'")).toThrow();
 db.sql("INSERT INTO operations_audit(id,actor,action,target,created_at) VALUES('a','admin','test','test','now')");expect(()=>db.sql("DELETE FROM operations_audit WHERE id='a'")).toThrow();
});
it('rejects malformed or expired reference rates without labeling them automatic',async()=>{
 const bad=vi.fn(async()=>new Response(JSON.stringify({base:'USD',date:'2026-99-99',rates:{CNY:7.2}}))) as unknown as typeof fetch;await expect(syncFx(db.env,bad)).rejects.toThrow('Invalid');expect(db.sql('SELECT count(*) AS n FROM fx_snapshots')[0].n).toBe(0);
 db.sql("INSERT INTO fx_snapshots(id,base_currency,rate_date,rates_json,source_url,checked_at) VALUES('old','USD','2000-01-01','{\"USD\":\"1\",\"CNY\":\"7\"}','https://example.com','2000-01-01')");await expect(readFx(db.env)).rejects.toThrow('expired');
});
it('does not fetch a source while another check holds its lease',async()=>{
 db.sql("INSERT INTO source_monitors(id,url,adapter,interval_hours,enabled,lease_until) VALUES('s','https://official.example.com','page-watch',24,1,?)",[new Date(Date.now()+60000).toISOString()]);
 const fetcher=vi.fn() as unknown as typeof fetch;expect(await checkSources(db.env,fetcher,true)).toEqual([]);expect(fetcher).not.toHaveBeenCalled();
});
it('rejects category-incompatible explicit product mappings',async()=>{
 await submit();await publish();const listing=db.sql('SELECT id FROM channel_listings')[0].id,video=db.sql("SELECT id FROM products WHERE category_id='video' LIMIT 1")[0].id;
 expect((await handleUnified(request('unified/admin/link','PUT',{listingId:listing,productId:video},undefined,db.env.ADMIN_KEY),db.env,{})).status).toBe(400);
});
it('unified API repository calls browser fetch with the correct global context',async()=>{
 const {UnifiedApiRepository}=await import('../src/shared/unifiedCatalog');
 const original=globalThis.fetch;
 globalThis.fetch=(function(this:unknown){expect(this).toBe(globalThis);return Promise.resolve(new Response(JSON.stringify({success:true,data:{products:[],plans:[]}})));}) as typeof fetch;
 try{expect((await new UnifiedApiRepository().load()).products).toEqual([]);}finally{globalThis.fetch=original;}
});
