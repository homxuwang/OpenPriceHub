import { readFileSync, readdirSync, statSync, lstatSync } from 'node:fs';
import { resolve, relative, isAbsolute, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
export const ROOT=resolve(fileURLToPath(new URL('../../',import.meta.url)));
export const DEFAULT_CONFIG=join(ROOT,'config/cloudflare.local.json');
export const DEFAULT_SECRETS=join(ROOT,'config/cloudflare.secrets.local.json');
const fail=key=>{throw new Error(`Invalid or missing configuration field: ${key}`);};
function keys(object,allowed,field){if(!object||typeof object!=='object'||Array.isArray(object)||Object.keys(object).some(k=>!allowed.includes(k)))fail(field);}
export function validateSettings(raw,secret){
 keys(raw,['schemaVersion','target','accountId','workerName','siteUrl','database','kvNamespaceId','workersDev','customDomain','includeSeedData','cronSchedules','automaticFx'],'config');
 keys(secret,['CLOUDFLARE_API_TOKEN','ADMIN_KEY'],'secrets');
 if(raw.cronSchedules!==undefined&&(!Array.isArray(raw.cronSchedules)||raw.cronSchedules.length>2||raw.cronSchedules.some(x=>!['0 1 * * *','0 1,13 * * *'].includes(x))))fail('cronSchedules (daily/twice-daily UTC)');
 if(raw.automaticFx!==undefined&&typeof raw.automaticFx!=='boolean')fail('automaticFx');
 if(raw.schemaVersion!==1)fail('schemaVersion');
 if(!['production','staging'].includes(raw.target))fail('target');
 if(!/^[a-f0-9]{32}$/i.test(raw.accountId||''))fail('accountId');
 if(!/^[a-z0-9][a-z0-9-]{1,61}$/.test(raw.workerName||''))fail('workerName');
 keys(raw.database,['name','id'],'database');
 if(!/^[a-zA-Z0-9][a-zA-Z0-9_-]{1,62}$/.test(raw.database.name||''))fail('database.name');
 if(!/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(raw.database.id||''))fail('database.id');
 if(raw.kvNamespaceId!==null&&!/^[a-f0-9]{32}$/i.test(raw.kvNamespaceId||''))fail('kvNamespaceId');
 if(typeof raw.workersDev!=='boolean'||typeof raw.includeSeedData!=='boolean')fail('workersDev/includeSeedData');
 let site;try{site=new URL(raw.siteUrl);}catch{fail('siteUrl');}
 if(site.protocol!=='https:'||site.username||site.password||site.pathname!=='/'||site.search||site.hash||!site.hostname.includes('.')||/YOUR_|FILL_/i.test(site.href))fail('siteUrl');
 if(raw.customDomain!==null&&(typeof raw.customDomain!=='string'||!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(raw.customDomain)||raw.customDomain!==site.hostname))fail('customDomain');
 if(!raw.workersDev&&!raw.customDomain)fail('customDomain required when workersDev=false');
 if(typeof secret.CLOUDFLARE_API_TOKEN!=='string'||!/^[a-zA-Z0-9_-]{20,256}$/.test(secret.CLOUDFLARE_API_TOKEN)||/^your|replace|fill/i.test(secret.CLOUDFLARE_API_TOKEN))fail('CLOUDFLARE_API_TOKEN');
 if(typeof secret.ADMIN_KEY!=='string'||!/^[a-zA-Z0-9_-]{32,256}$/.test(secret.ADMIN_KEY)||/^your|dev-admin|replace|fill/i.test(secret.ADMIN_KEY))fail('ADMIN_KEY (32+ random characters)');
 if(secret.ADMIN_KEY===secret.CLOUDFLARE_API_TOKEN)fail('ADMIN_KEY must differ from API token');
 return {config:{...raw,siteUrl:site.origin},secrets:{...secret}};
}
export function loadSettings(configPath=DEFAULT_CONFIG,secretsPath=DEFAULT_SECRETS){
 for(const p of [configPath,secretsPath]){
  try{if(lstatSync(p).isSymbolicLink())throw new Error('symbolic link');}catch{throw new Error('Configuration missing or symlink: use npm run cf:init, then fill the local JSON files.');}
  if(process.platform!=='win32'&&(statSync(p).mode&0o077))throw new Error('Local configuration files must have mode 600 (chmod 600 config/*.local.json).');
 }
 let raw,secret;try{raw=JSON.parse(readFileSync(configPath,'utf8'));secret=JSON.parse(readFileSync(secretsPath,'utf8'));}catch{throw new Error('Invalid local JSON configuration (content suppressed).');}
 return validateSettings(raw,secret);
}
export function sanitize(text,secrets){
 let out=String(text);
 for(const value of Object.values(secrets||{}).filter(v=>typeof v==='string'&&v.length>=8))for(const form of [value,encodeURIComponent(value),Buffer.from(value).toString('base64')])out=out.split(form).join('[REDACTED]');
 return out;
}
export function publicWrangler(config,runtime){
 const w={name:config.workerName,main:join(ROOT,'src/worker/index.ts'),compatibility_date:'2024-01-01',compatibility_flags:['nodejs_compat'],account_id:config.accountId,workers_dev:config.workersDev,
  assets:{directory:join(ROOT,'dist'),binding:'ASSETS',not_found_handling:'single-page-application',run_worker_first:true},
  vars:{SITE_URL:config.siteUrl,...(config.automaticFx?{FX_SYNC_ENABLED:'true'}:{})},
  d1_databases:[{binding:'DB',database_name:config.database.name,database_id:config.database.id,migrations_dir:join(runtime,'migrations')}],
  send_metrics:false};
 if(config.cronSchedules?.length)w.triggers={crons:config.cronSchedules};
 if(config.kvNamespaceId)w.kv_namespaces=[{binding:'KV',id:config.kvNamespaceId}];
 if(config.customDomain)w.routes=[{pattern:config.customDomain,custom_domain:true}];
 return w;
}
export function childEnv(kind,settings,runtime,parent=process.env){
 const env={};
 for(const key of ['PATH','Path','HOME','USERPROFILE','SYSTEMROOT','SystemRoot','COMSPEC','PATHEXT','TEMP','TMP','TMPDIR','APPDATA','LOCALAPPDATA','LANG','LC_ALL'])if(parent[key]!==undefined)env[key]=parent[key];
 Object.assign(env,{CI:'true',NO_COLOR:'1',WRANGLER_SEND_METRICS:'false',WRANGLER_LOG:'error',WRANGLER_LOG_PATH:join(runtime,'logs'),CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV:'false'});
 if(kind==='wrangler')Object.assign(env,{CLOUDFLARE_ACCOUNT_ID:settings.config.accountId,CLOUDFLARE_API_TOKEN:settings.secrets.CLOUDFLARE_API_TOKEN});
 if(kind==='build'||kind==='check')Object.assign(env,{VITE_SITE_URL:settings.config.siteUrl,OPH_BUILD_ENV_DIR:join(runtime,'empty-env'),OPH_DEPLOY_BUILD:'1'});
 return env;
}
const SEEDS=new Set(['0002_seed.sql','0004_verified_catalog_seed.sql']);
export function migrationFiles(includeSeeds=false,root=ROOT){
 return readdirSync(join(root,'migrations')).filter(f=>/^\d+_[\w-]+\.sql$/.test(f)&&(includeSeeds||!SEEDS.has(f))).sort();
}
export function assertPrivateFilesIgnored(files,root=ROOT){
 for(const f of files){
  const rel=relative(root,resolve(f));if(rel.startsWith('..')||isAbsolute(rel))continue;
  const tracked=spawnSync('git',['ls-files','--error-unmatch','--',rel],{cwd:root,encoding:'utf8'});
  const ignored=spawnSync('git',['check-ignore','--quiet','--',rel],{cwd:root});
  if(tracked.status===0||ignored.status!==0)throw new Error('Local secret/configuration file is tracked or not ignored. Remove it from Git tracking before proceeding (file contents suppressed).');
 }
}
export function scanFiles(files,secrets){
 const needles=Object.values(secrets).filter(v=>typeof v==='string'&&v.length>=8).flatMap(v=>[v,encodeURIComponent(v),Buffer.from(v).toString('base64')]);
 for(const f of files){
  let data;try{if(!statSync(f).isFile())continue;data=readFileSync(f);}catch{continue;}
  if(needles.some(v=>data.includes(Buffer.from(v))))throw new Error('A configured secret was found in publishable/tracked content. Remove it before continuing (path and contents suppressed).');
 }
}
export function repositoryFiles(root=ROOT){
 const result=spawnSync('git',['ls-files','-z','--cached','--others','--exclude-standard'],{cwd:root,maxBuffer:16*1024*1024});
 if(result.status!==0)throw new Error('Git file safety check failed. Run from a Git checkout.');
 return [...new Set(result.stdout.toString().split('\0').filter(Boolean))].map(p=>join(root,p));
}
export function walkFiles(path){
 return readdirSync(path,{withFileTypes:true}).flatMap(e=>{const p=join(path,e.name);if(e.isSymbolicLink())throw new Error('Publishable files must not be symlinks');return e.isDirectory()?walkFiles(p):[p];});
}
export function planSteps(command){
 if(command==='backup')return ['Export remote D1 to a private local backup'];
 const database=['Export remote D1 backup','Record pre-migration table counts','Adopt existing legacy migration journal','Apply pending versioned migrations','Verify foreign keys, integrity and legacy row counts'];
 if(command==='migrate')return database;
 if(command==='deploy')return ['Run typecheck and tests without deployment secrets','Build frontend using public settings only','Scan assets for configured secrets','Dry-run Worker bundle and scan output',...database,'Upload ADMIN_KEY using stdin to Workers Secrets','Deploy Worker and assets','Verify HTTPS website and required public APIs'];
 throw new Error('Unknown remote command');
}
