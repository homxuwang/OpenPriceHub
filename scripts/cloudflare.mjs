#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync, mkdirSync, copyFileSync, rmSync, statSync, lstatSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { ROOT,DEFAULT_CONFIG,DEFAULT_SECRETS,loadSettings,sanitize,publicWrangler,childEnv,migrationFiles,assertPrivateFilesIgnored,scanFiles,repositoryFiles,walkFiles,planSteps } from './lib/cloudflare-config.mjs';

function privateDir(path){if(existsSync(path)&&lstatSync(path).isSymbolicLink())throw new Error('Private working directory must not be a symlink');mkdirSync(path,{recursive:true,mode:0o700});if(process.platform!=='win32'&&(statSync(path).mode&0o077))throw new Error('Private working directory must have mode 700');}
function save(path,value){writeFileSync(path,value,{mode:0o600,flag:'wx'});}
export function initialize(){
 mkdirSync(join(ROOT,'config'),{recursive:true});
 if(!existsSync(DEFAULT_CONFIG))save(DEFAULT_CONFIG,readFileSync(join(ROOT,'config/cloudflare.example.json')));
 if(!existsSync(DEFAULT_SECRETS))save(DEFAULT_SECRETS,JSON.stringify({CLOUDFLARE_API_TOKEN:'',ADMIN_KEY:randomBytes(32).toString('hex')},null,2)+'\n');
 assertPrivateFilesIgnored([DEFAULT_CONFIG,DEFAULT_SECRETS]);
 console.log('Local files ready (existing files unchanged):\n  config/cloudflare.local.json\n  config/cloudflare.secrets.local.json\nFill the account, resource IDs, HTTPS URL and API token. ADMIN_KEY is generated only for a new secrets file; its value is never printed.');
}
function argumentsFor(argv){
 const args=[...argv],command=args.shift()||'plan';let configPath=DEFAULT_CONFIG,secretsPath=DEFAULT_SECRETS,apply=false;
 while(args.length){const x=args.shift();if(x==='--apply')apply=true;else if(x==='--config'&&args.length)configPath=resolve(args.shift());else if(x==='--secrets'&&args.length)secretsPath=resolve(args.shift());else throw new Error('Unknown argument. Use: init | check | plan | backup | migrate | deploy [--apply] [--config FILE] [--secrets FILE]');}
 if(!['init','check','plan','backup','migrate','deploy'].includes(command))throw new Error('Unknown command');
 return {command,configPath,secretsPath,apply};
}
function jsonResults(output){
 try{const all=JSON.parse(output);if(!Array.isArray(all)||all.some(x=>x.success===false)||!Array.isArray(all[0]?.results))throw new Error();return all[0].results;}catch{throw new Error('D1 verification returned an unsupported response; migration/deployment stopped.');}
}
const tableQuery="SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name NOT LIKE 'd1_%' ORDER BY name";
export async function main(argv=process.argv.slice(2)){
 process.umask(0o077);
 const options=argumentsFor(argv);
 if(options.command==='init'){initialize();return;}
 assertPrivateFilesIgnored([options.configPath,options.secretsPath]);
 const settings=loadSettings(options.configPath,options.secretsPath),{config,secrets}=settings;
 const files=repositoryFiles();
 const privateTracked=files.filter(p=>/(^|[\/\\])(\.env(?:\..*)?|\.dev\.vars(?:\..*)?)$/.test(p)&&!p.endsWith('.example'));
 if(privateTracked.length||files.some(p=>/[\\/]config[\\/][^\\/]+\.local\.json$/.test(p)))throw new Error('Private environment files are tracked or unignored; remove them from Git tracking first.');
 scanFiles(files,secrets);
 const migrations=migrationFiles(config.includeSeedData);
 console.log(`Target: ${config.target}; Worker: ${config.workerName}; D1: ${config.database.name}; site: ${config.siteUrl}`);
 console.log(`Migrations selected: ${migrations.join(', ')}${config.includeSeedData?' (seed fixtures explicitly enabled)':' (seed fixtures excluded)'}`);
 if(options.command==='check'){console.log('Local configuration and configured-secret checks passed. No Cloudflare request was sent.');return;}
 const command=options.command==='plan'?'deploy':options.command;
 planSteps(command).forEach((s,i)=>console.log(`${i+1}. ${s}`));
 if(!options.apply||options.command==='plan'){console.log('Plan only. No build, upload or remote database operation executed. Run the desired command with --apply to execute.');return;}
 if(!existsSync(join(ROOT,'node_modules/wrangler/bin/wrangler.js')))throw new Error('Install locked dependencies with npm ci first.');
 const base=join(ROOT,'.cloudflare-local');privateDir(base);
 const runtime=join(base,`run-${Date.now()}-${randomBytes(4).toString('hex')}`);privateDir(runtime);privateDir(join(runtime,'empty-env'));privateDir(join(runtime,'migrations'));privateDir(join(runtime,'logs'));
 let backupPath;
 const wranglerPath=join(ROOT,'node_modules/wrangler/bin/wrangler.js');
 const wranglerConfig=join(runtime,'wrangler.json');
 save(wranglerConfig,JSON.stringify(publicWrangler(config,runtime),null,2));
 // An empty file beside the generated config prevents local development vars from being loaded.
 save(join(runtime,'.dev.vars'),'');
 for(const f of migrations)copyFileSync(join(ROOT,'migrations',f),join(runtime,'migrations',f));
 const run=(kind,args,{input,quiet=false}={})=>{
  const result=spawnSync(process.execPath,args,{cwd:ROOT,env:childEnv(kind,settings,runtime),input,encoding:'utf8',maxBuffer:64*1024*1024,windowsHide:true});
  if(result.error)throw new Error('Could not launch the local Node/Wrangler tool.');
  const stdout=sanitize(result.stdout||'',secrets),stderr=sanitize(result.stderr||'',secrets);
  if(!quiet&&stdout.trim())console.log(stdout.trim());
  if(stderr.trim())console.error(stderr.trim());
  if(result.status!==0)throw new Error(`A ${kind} step failed (exit ${result.status ?? 'signal'}); subsequent operations were not run.`);
  return stdout;
 };
 const wr=(args,extra)=>run('wrangler',[wranglerPath,...args,'--config',wranglerConfig],extra);
 const sql=query=>jsonResults(wr(['d1','execute','DB','--remote','--command',query,'--json'],{quiet:true}));
 const counts=()=>{
  const tables=sql(tableQuery).map(r=>r.name);
  if(tables.some(t=>!/^\w+$/.test(t)))throw new Error('Unsupported table name in D1; manual schema review required.');
  return Object.fromEntries(tables.map(t=>[t,sql(`SELECT COUNT(*) AS count FROM "${t}"`)[0].count]));
 };
 try{
  if(command==='deploy'){
   run('check',[join(ROOT,'node_modules/typescript/bin/tsc'),'--noEmit']);
   run('check',[join(ROOT,'node_modules/vitest/vitest.mjs'),'run']);
   // Clear old assets so stale ignored files cannot enter the new deployment.
   rmSync(join(ROOT,'dist'),{recursive:true,force:true});
   run('build',[join(ROOT,'node_modules/vite/bin/vite.js'),'build']);
   scanFiles(walkFiles(join(ROOT,'dist')),secrets);
   const bundle=join(runtime,'bundle');
   wr(['deploy','--dry-run','--outdir',bundle]);
   scanFiles(walkFiles(bundle),secrets);
  }
  const backups=join(ROOT,'backups');privateDir(backups);
  backupPath=join(backups,`${config.target}-${Date.now()}-${randomBytes(4).toString('hex')}.sql`);
  wr(['d1','export','DB','--remote','--output',backupPath]);
  if(!existsSync(backupPath)||statSync(backupPath).size===0)throw new Error('D1 export is missing or empty. Migration stopped.');
  if(process.platform!=='win32'&&(statSync(backupPath).mode&0o077))throw new Error('Backup permissions are too broad. Migration stopped.');
  console.log('Remote D1 backup saved privately under backups/.');
  if(command==='backup')return;
  const before=counts();
  save(join(backups,`${config.target}-${Date.now()}-before-counts.json`),JSON.stringify(before,null,2));
  // Avoid seeding a partially initialized legacy schema or mistaking it for an empty database.
  const legacy=['platforms','plans','models','rules','submissions'];
  const present=legacy.filter(t=>t in before);
  if(present.length>0&&present.length<legacy.length)throw new Error('Partial legacy schema detected. Backup exists; review schema before migration.');
  wr(['d1','execute','DB','--remote','--file',join(ROOT,'migrations/bootstrap/adopt_legacy.sql')]);
  wr(['d1','migrations','apply','DB','--remote']);
  if(sql('PRAGMA foreign_key_check').length)throw new Error('Foreign-key validation failed after migration.');
  const integrity=sql('PRAGMA quick_check');
  if(integrity.length!==1||Object.values(integrity[0])[0]!=='ok')throw new Error('D1 integrity validation failed.');
  const after=counts();
  for(const table of legacy)if(table in before&&after[table]!==before[table])throw new Error('Legacy row counts changed; inspect backup and migration result before continuing.');
  save(join(backups,`${config.target}-${Date.now()}-after-counts.json`),JSON.stringify(after,null,2));
  console.log('Migrations and compatibility checks passed. Existing legacy row counts preserved.');
  if(command==='deploy'){
   // Only the application secret is sent. API token remains a local process credential.
   wr(['secret','bulk'],{input:JSON.stringify({ADMIN_KEY:secrets.ADMIN_KEY}),quiet:true});
   wr(['deploy','--keep-vars']);
   for(const path of ['/zh','/api/websites','/api/models']){
    const res=await fetch(config.siteUrl+path,{redirect:'manual',signal:AbortSignal.timeout(20000)});
    if(!res.ok)throw new Error('Deployment uploaded, but HTTP verification failed. Review the configured site URL and deployment state.');
    if(path.startsWith('/api/')){let data;try{data=await res.json();}catch{throw new Error('Deployment API did not return JSON.');}if(data.success!==true)throw new Error('Deployment API verification failed.');}
   }
   console.log(`Deployment verified: ${config.siteUrl}/zh; administrator: ${config.siteUrl}/zh/admin`);
  }
 }finally{
  rmSync(runtime,{recursive:true,force:true});
  // Backups and row-count reports remain private for operator recovery, even on failures.
  if(backupPath&&existsSync(backupPath)&&statSync(backupPath).size>0)console.log('Backup retained locally. Worker/secrets/D1 changes are separate operations; no automatic destructive rollback is performed.');
 }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 main().catch(error=>{let secrets={};try{secrets=JSON.parse(readFileSync(DEFAULT_SECRETS,'utf8'));}catch{}
 console.error(sanitize(error instanceof Error?error.message:'Cloudflare operation failed',secrets));process.exitCode=1;});
}
