import { beforeEach,afterEach,describe,it,expect,vi } from 'vitest';
import { mkdtempSync,writeFileSync,readFileSync,chmodSync,rmSync,existsSync,symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
// @ts-expect-error deployment tools intentionally run as dependency-free Node ES modules
import { validateSettings,loadSettings,publicWrangler,childEnv,sanitize,migrationFiles,scanFiles,assertPrivateFilesIgnored,planSteps } from '../scripts/lib/cloudflare-config.mjs';
const secret={CLOUDFLARE_API_TOKEN:randomBytes(24).toString('hex'),ADMIN_KEY:randomBytes(24).toString('hex')};
const config={schemaVersion:1,target:'production',accountId:'a'.repeat(32),workerName:'openpricehub-test',siteUrl:'https://openpricehub-test.example.com',database:{name:'oph-test-db',id:'11111111-1111-4111-8111-111111111111'},kvNamespaceId:null,workersDev:true,customDomain:null,includeSeedData:false};
let folder:string;
beforeEach(()=>{folder=mkdtempSync(join(tmpdir(),'oph-cf-test-'));});
afterEach(()=>{rmSync(folder,{recursive:true,force:true});vi.restoreAllMocks();});
function valid(){return validateSettings(structuredClone(config),{...secret});}
describe('private configuration-driven Cloudflare deployment',()=>{
 it('accepts complete settings and excludes all credentials from generated Wrangler config',()=>{
  const s=valid(),w=publicWrangler(s.config,folder),json=JSON.stringify(w);
  expect(w.vars).toEqual({SITE_URL:config.siteUrl});expect(json).not.toContain(secret.ADMIN_KEY);expect(json).not.toContain(secret.CLOUDFLARE_API_TOKEN);expect(json).not.toContain('ADMIN_KEY');expect(w.kv_namespaces).toBeUndefined();
 });
 it('supports optional KV and an explicitly configured custom domain',()=>{
  const c={...config,kvNamespaceId:'b'.repeat(32),workersDev:false,customDomain:'openpricehub-test.example.com'};
  const w=publicWrangler(validateSettings(c,secret).config,folder);expect(w.routes[0].custom_domain).toBe(true);expect(w.kv_namespaces[0].binding).toBe('KV');
 });
 it.each(['accountId','workerName','siteUrl','schemaVersion','database','target','includeSeedData'])('rejects missing/invalid required setting %s without echoing values',field=>{
  const c={...config,[field]:'@@-invalid-@@'};try{validateSettings(c,secret);throw new Error('unexpected-success');}catch(e){expect(String(e)).not.toContain('@@-invalid-@@');expect(String(e)).not.toContain(secret.ADMIN_KEY);expect(String(e)).not.toContain('unexpected-success');}
 });
 it('rejects unknown secret names and weak or reused administrator keys',()=>{
  expect(()=>validateSettings(config,{...secret,VITE_ADMIN_KEY:'unsafe'})).toThrow();expect(()=>validateSettings(config,{...secret,ADMIN_KEY:'your-secret-admin-key'})).toThrow();expect(()=>validateSettings(config,{...secret,ADMIN_KEY:secret.CLOUDFLARE_API_TOKEN})).toThrow();
 });
 it('requires HTTPS, no URL credentials, and coherent domain settings',()=>{
  for(const siteUrl of ['http://example.com','https://user:password@example.com','https://example.com/path','https://example.com/?key=value'])expect(()=>validateSettings({...config,siteUrl},secret)).toThrow();
  expect(()=>validateSettings({...config,workersDev:false},secret)).toThrow();expect(()=>validateSettings({...config,customDomain:'other.example.com'},secret)).toThrow();
 });
 it('never passes deployment credentials or inherited VITE secrets into build/check tools',()=>{
  const parent={PATH:'/usr/bin',HOME:'/tmp/home',VITE_ADMIN_KEY:secret.ADMIN_KEY,CLOUDFLARE_API_TOKEN:secret.CLOUDFLARE_API_TOKEN,NODE_OPTIONS:'--require malicious-module',DEBUG:'*'};
  for(const kind of ['build','check']){
   const env=childEnv(kind,valid(),folder,parent);expect(env.PATH).toBe('/usr/bin');expect(env.VITE_SITE_URL).toBe(config.siteUrl);expect(env.OPH_BUILD_ENV_DIR).toBe(join(folder,'empty-env'));expect(env.OPH_DEPLOY_BUILD).toBe('1');expect(JSON.stringify(env)).not.toContain(secret.ADMIN_KEY);expect(JSON.stringify(env)).not.toContain(secret.CLOUDFLARE_API_TOKEN);expect(env.NODE_OPTIONS).toBeUndefined();expect(env.DEBUG).toBeUndefined();
  }
 });
 it('passes the API token only to Wrangler env and never ADMIN_KEY',()=>{
  const env=childEnv('wrangler',valid(),folder,{});expect(env.CLOUDFLARE_API_TOKEN).toBe(secret.CLOUDFLARE_API_TOKEN);expect(env.ADMIN_KEY).toBeUndefined();expect(JSON.stringify(env)).not.toContain(secret.ADMIN_KEY);expect(env.WRANGLER_SEND_METRICS).toBe('false');
 });
 it('redacts plain, URL-encoded and base64 configured secrets',()=>{
  const input=Object.values(secret).flatMap(v=>[v,encodeURIComponent(v),Buffer.from(v).toString('base64')]).join(' ');
  const output=sanitize(input,secret);for(const v of Object.values(secret))expect(output).not.toContain(v);expect(output).toContain('[REDACTED]');
 });
 it('detects configured secrets in publishable files and suppresses file details',()=>{
  const path=join(folder,'asset.js');writeFileSync(path,`export const accidental=${JSON.stringify(secret.ADMIN_KEY)}`);
  expect(()=>scanFiles([path],secret)).toThrow('configured secret');try{scanFiles([path],secret);}catch(e){expect(String(e)).not.toContain(path);expect(String(e)).not.toContain(secret.ADMIN_KEY);}
 });
 it('accepts clean assets and detects encoded secrets',()=>{
  const path=join(folder,'asset.js');writeFileSync(path,'public site');expect(()=>scanFiles([path],secret)).not.toThrow();writeFileSync(path,Buffer.from(secret.ADMIN_KEY).toString('base64'));expect(()=>scanFiles([path],secret)).toThrow();
 });
 it('rejects overly broad file permissions and malformed JSON without printing content',()=>{
  const a=join(folder,'config.json'),b=join(folder,'secrets.json');writeFileSync(a,JSON.stringify(config),{mode:0o600});writeFileSync(b,JSON.stringify(secret),{mode:0o600});expect(loadSettings(a,b).config.workerName).toBe(config.workerName);
  if(process.platform!=='win32'){chmodSync(b,0o644);expect(()=>loadSettings(a,b)).toThrow('mode 600');chmodSync(b,0o600);}
  writeFileSync(b,secret.ADMIN_KEY);expect(()=>loadSettings(a,b)).toThrow('content suppressed');
 });
 it('rejects symlinked secret files',()=>{
  const a=join(folder,'config.json'),b=join(folder,'secrets.json'),link=join(folder,'link.json');writeFileSync(a,JSON.stringify(config),{mode:0o600});writeFileSync(b,JSON.stringify(secret),{mode:0o600});symlinkSync(b,link);expect(()=>loadSettings(a,link)).toThrow('symlink');
 });
 it('selects schema migrations by default and includes seeds only on explicit opt-in',()=>{
  expect(migrationFiles()).toEqual(['0001_init.sql','0003_product_catalog.sql','0005_channel_prices_and_developer_submissions.sql','0006_accounts_and_operations.sql','0007_candidate_and_audit_guards.sql']);expect(migrationFiles(true)).toContain('0002_seed.sql');expect(migrationFiles(true)).toContain('0004_verified_catalog_seed.sql');
 });
 it('requires ignored and untracked local files, even if forced into Git',()=>{
  execFileSync('git',['init','-q',folder]);writeFileSync(join(folder,'.gitignore'),'*.local.json\n');const path=join(folder,'secrets.local.json');writeFileSync(path,'private');expect(()=>assertPrivateFilesIgnored([path],folder)).not.toThrow();execFileSync('git',['-C',folder,'add','-f','secrets.local.json']);expect(()=>assertPrivateFilesIgnored([path],folder)).toThrow('tracked');
 });
 it('plans checks before deployment and backup before any migration',()=>{
  const steps=planSteps('deploy');expect(steps.findIndex((x:string)=>x.includes('backup'))).toBeLessThan(steps.findIndex((x:string)=>x.includes('Apply pending')));expect(steps.findIndex((x:string)=>x.includes('Scan assets'))).toBeLessThan(steps.findIndex((x:string)=>x.includes('backup')));expect(steps.findIndex((x:string)=>x.includes('stdin'))).toBeLessThan(steps.indexOf('Deploy Worker and assets'));
 });
 it('CLI defaults to an offline plan and writes no runtime config or backups',()=>{
  const a=join(folder,'config.json'),b=join(folder,'secrets.json');writeFileSync(a,JSON.stringify(config),{mode:0o600});writeFileSync(b,JSON.stringify(secret),{mode:0o600});
  const result=execFileSync(process.execPath,['scripts/cloudflare.mjs','deploy','--config',a,'--secrets',b],{encoding:'utf8'});
  expect(result).toContain('Plan only');expect(result).not.toContain(secret.ADMIN_KEY);expect(result).not.toContain(secret.CLOUDFLARE_API_TOKEN);expect(existsSync(join(folder,'wrangler.json'))).toBe(false);
 });
 it('rejects shell-like arguments instead of treating secrets/config files as code',()=>{
  try{execFileSync(process.execPath,['scripts/cloudflare.mjs','deploy','--token','$(whoami)'],{encoding:'utf8',stdio:['pipe','pipe','pipe']});throw new Error('unexpected-success');}catch(e:any){expect(String(e.stderr)).toContain('Unknown argument');expect(String(e.stderr)).not.toContain('$(whoami)');}
 });
 it('legacy setup/deploy wrappers and CI contain no credential interpolation or remote auto-deploy',()=>{
  const setup=readFileSync('scripts/setup.sh','utf8'),windows=readFileSync('scripts/setup.bat','utf8'),ci=readFileSync('.github/workflows/deploy.yml','utf8'),wrangler=readFileSync('wrangler.toml','utf8');
  expect(setup).not.toContain('openssl');expect(setup).not.toContain('ADMIN_KEY=');expect(windows).not.toContain('wrangler login');expect(ci).not.toContain('secrets.CLOUDFLARE');expect(ci).not.toContain('migrate:remote');expect(wrangler).not.toMatch(/ADMIN_KEY\s*=/);
 });
});
