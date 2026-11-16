import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { webcrypto } from 'node:crypto';
import { validateWebsiteDraft,emptyWebsiteDraft,emptyWebsitePlan,emptyWebsiteComponent,type WebsiteDraft } from '../src/shared/websiteSubmission';
import { handleWebsites } from '../src/worker/routes/websites';
import type { Env } from '../src/shared/types';
vi.stubGlobal('crypto',webcrypto);
function sample():WebsiteDraft {const plan=emptyWebsitePlan();return {...emptyWebsiteDraft(),name:'SIM developer',website:'https://sim.example.com',pricingUrl:'https://sim.example.com/pricing',plans:[{...plan,name:'SIM standard',amount:'99',billing:'package',pricingModels:['usage-based-package','credit-based'],currency:'CNY',creditAmount:'1200',creditPool:'SIM-pool',stackable:true,components:[{...emptyWebsiteComponent(),creditsPerUnit:'20',modelName:'SIM-image'}]}]};}
let folder:string,file:string,env:Env;
const python=`import sqlite3,json,sys
c=sqlite3.connect(sys.argv[1]);c.row_factory=sqlite3.Row;c.execute('PRAGMA foreign_keys=ON')
x=json.load(sys.stdin)
try:
 c.execute('BEGIN')
 out=[]
 for s in x:
  q=c.execute(s['sql'],s['values']); rows=[dict(r) for r in q.fetchall()] if q.description else []
  out.append({'results':rows,'meta':{'changes':q.rowcount}})
 c.commit();print(json.dumps(out))
except Exception as e:
 c.rollback();print(str(e),file=sys.stderr);sys.exit(1)
`;
function execute(sql:string,values:unknown[]=[]){return JSON.parse(execFileSync('python3',['-c',python,file],{input:JSON.stringify([{sql,values}]),encoding:'utf8',stdio:['pipe','pipe','pipe']}))[0];}
class Statement {
 constructor(readonly sql:string,readonly values:unknown[]=[]){ }
 bind(...values:unknown[]){return new Statement(this.sql,values);}
 async all(){return execute(this.sql,this.values);}
 async first(){return execute(this.sql,this.values).results[0]||null;}
 async run(){return execute(this.sql,this.values);}
}
beforeEach(()=>{
 folder=mkdtempSync(join(tmpdir(),'oph-websites-'));file=join(folder,'test.sqlite');
 execFileSync('python3',['-c',`import sqlite3,pathlib,sys\nc=sqlite3.connect(sys.argv[1])\nfor p in sorted(pathlib.Path('migrations').glob('*.sql')):c.executescript(p.read_text())\nc.close()`,file]);
 env={ADMIN_KEY:'test-only-real-admin-key',DB:{prepare:(sql:string)=>new Statement(sql),batch:async(s:Statement[])=>JSON.parse(execFileSync('python3',['-c',python,file],{input:JSON.stringify(s),encoding:'utf8',stdio:['pipe','pipe','pipe']}))}} as unknown as Env;
});
afterEach(()=>{rmSync(folder,{recursive:true,force:true});});
async function call(path:string,method='GET',data?:unknown,key?:string){const r=await handleWebsites(new Request('https://test.example.com/api/websites'+path,{method,headers:{'Content-Type':'application/json',...(key?{'X-Admin-Key':key}:{})},body:data===undefined?undefined:JSON.stringify(data)}),env,{});return {status:r.status,body:await r.json() as any};}
async function submit(draft=sample(),id='test-submission-00000001'){return call('/submissions','POST',{requestId:id,draft,contactEmail:'private@example.com',consent:true});}
async function review(action='publish',draft=sample(),version=1){return call('/admin/submissions/test-submission-00000001','PUT',{action,draft,version,confirmed:true,notes:'source checked'},env.ADMIN_KEY);}

describe('developer submissions and channel price versions',()=>{
 it('preserves legacy prices, foreign keys and schema after additive migration',()=>{
  expect(execute('SELECT count(*) AS n FROM models').results[0].n).toBeGreaterThan(0);
  expect(execute('PRAGMA foreign_key_check').results).toEqual([]);
  expect(execute('SELECT count(*) AS n FROM channel_listings').results[0].n).toBe(0);
 });
 it('keeps incomplete submitted prices private and never treats null as free',async()=>{
  const draft=sample();draft.plans[0].amount=null;draft.plans[0].components=[];
  expect((await submit(draft)).status).toBe(200);
  expect((await call('')).body.data.listings).toEqual([]);
  expect((await review('publish',draft)).status).toBe(400);
  expect(execute('SELECT status FROM website_submissions').results[0].status).toBe('pending');
 });
 it('requires administrator authentication and rejects default keys',async()=>{
  expect((await call('/admin/submissions')).status).toBe(401);
  env.ADMIN_KEY='dev-admin-key';expect((await call('/admin/submissions','GET',undefined,'dev-admin-key')).status).toBe(401);
 });
 it('edits prices before approval and publishes a privacy-filtered immutable version',async()=>{
  await submit();const edited=sample();edited.plans[0].amount='89.123456789012';
  expect((await review('save',edited)).status).toBe(200);
  expect((await call('')).body.data.listings).toHaveLength(0);
  expect((await review('publish',edited,2)).status).toBe(200);
  const publicResult=(await call('')).body.data.listings[0];
  expect(publicResult.plans[0].amount).toBe('89.123456789012');expect(publicResult.plans[0].sourceUrl).toBe(edited.pricingUrl);
  expect(JSON.stringify(publicResult)).not.toContain('private@example.com');expect(JSON.stringify(publicResult)).not.toContain('source checked');
  const row=execute('SELECT * FROM website_submissions').results[0];expect(JSON.parse(row.original_json).plans[0].amount).toBe('99');
  expect(()=>execute("UPDATE website_submissions SET original_json='{}'")).toThrow();
  expect(()=>execute("UPDATE listing_price_versions SET public_json='{}'")).toThrow();
 });
 it('corrects published prices with a new version and retains old amounts',async()=>{
  await submit();await review();const edited=sample();edited.relationship='third_party';edited.plans[0].amount='79';await review('publish',edited,2);
  expect(execute('SELECT count(*) AS n FROM listing_price_versions').results[0].n).toBe(2);
  expect(execute('SELECT amount_decimal FROM listing_pricing_plans ORDER BY rowid').results.map((x:any)=>x.amount_decimal)).toEqual(['99','79']);
  expect((await call('')).body.data.listings).toHaveLength(1);
  expect((await call('')).body.data.listings[0].relationship).toBe('third_party');
 });
 it('rejects stale and repeated reviews without duplicate publication',async()=>{
  await submit();await review();expect((await review()).status).toBe(409);
  expect(execute('SELECT count(*) AS n FROM listing_price_versions').results[0].n).toBe(1);
  const s=env.DB.prepare('INSERT INTO website_review_logs(id,submission_id,base_version,action,actor,notes,snapshot_json,created_at) VALUES(?,?,?,?,?,?,?,?)').bind('stale','test-submission-00000001',1,'save','administrator','','{}','now');
  await expect(env.DB.batch([s])).rejects.toThrow();
 });
 it('rolls back a failed publication without exposing a partial price',async()=>{
  await submit();const batch=env.DB.batch.bind(env.DB);
  env.DB.batch=(async (s:any[])=>batch([...s,env.DB.prepare('INSERT INTO nonexistent_test_table(id) VALUES(1)')])) as typeof env.DB.batch;
  const spy=vi.spyOn(console,'error').mockImplementation(()=>{});
  expect((await review()).status).toBe(503);spy.mockRestore();
  expect(execute('SELECT count(*) AS n FROM channels').results[0].n).toBe(0);
  expect(execute('SELECT count(*) AS n FROM listing_price_versions').results[0].n).toBe(0);
  expect(execute('SELECT count(*) AS n FROM website_review_logs').results[0].n).toBe(0);
  expect(execute('SELECT status,version FROM website_submissions').results[0]).toEqual({status:'pending',version:1});
 });
 it('is idempotent for identical retries and refuses changed reuse',async()=>{
  expect((await submit()).status).toBe(200);expect((await submit()).status).toBe(200);
  const changed=sample();changed.name='other';expect((await submit(changed)).status).toBe(409);
  expect(execute('SELECT count(*) AS n FROM website_submissions').results[0].n).toBe(1);
 });
 it('records reasons and audit history without publishing rejected submissions',async()=>{
  await submit();expect((await review('request_changes')).status).toBe(200);expect((await review('reject',sample(),2)).status).toBe(200);
  const info=await call('/admin/submissions/test-submission-00000001','GET',undefined,env.ADMIN_KEY);expect(info.body.data.logs).toHaveLength(2);
  expect(info.body.data.submission.status).toBe('rejected');expect((await call('')).body.data.listings).toHaveLength(0);
 });
 it('requires explicit publication confirmation and refuses invalid pricing dimensions',async()=>{
  await submit();expect((await call('/admin/submissions/test-submission-00000001','PUT',{action:'publish',draft:sample(),version:1},env.ADMIN_KEY)).status).toBe(400);
  const draft=sample();draft.plans[0].components[0].unit='per_1m_input_tokens';expect(()=>validateWebsiteDraft(draft)).toThrow('Unit does not match');
 });
 it('validates URLs, decimals, consent and credit pool semantics',async()=>{
  const d=sample();d.website='javascript:alert(1)';expect((await submit(d)).status).toBe(400);
  d.website='https://127.0.0.1';expect(()=>validateWebsiteDraft(d)).toThrow();
  d.website='https://sim.example.com';d.plans[0].amount='NaN';expect(()=>validateWebsiteDraft(d)).toThrow();
  d.plans[0].amount='99';d.plans[0].creditPool='';expect(()=>validateWebsiteDraft(d)).toThrow('Credit pool');
  expect((await call('/submissions','POST',{draft:sample(),requestId:'test-000000000000',contactEmail:'a@example.com',consent:false})).status).toBe(400);
 });
 it('supports five product categories and explicit free, subscription and usage prices',()=>{
  for(const [category,unit] of [['image','per_image'],['video','per_second'],['voice','per_character'],['music','per_song'],['llm-api','per_1m_input_tokens']] as const){const d=sample();d.category=category;d.plans[0].components[0].unit=unit;expect(validateWebsiteDraft(d,true).category).toBe(category);}
  const d=sample();d.plans[0]={...emptyWebsitePlan(),name:'Free',billing:'free',pricingModels:['free'],amount:'0'};expect(validateWebsiteDraft(d,true).plans[0].amount).toBe('0');
  d.plans[0].amount=null;expect(()=>validateWebsiteDraft(d,true)).toThrow();
 });
 it('rate limits new submissions but not retries and rejects oversized payloads',async()=>{
  for(let i=0;i<5;i++)expect((await submit(sample(),`test-submission-0000000${i}`)).status).toBe(200);
  expect((await submit(sample(),'test-submission-00000009')).status).toBe(429);
  expect((await call('/submissions','POST',{data:'a'.repeat(66000)})).status).toBe(400);
 });
});
