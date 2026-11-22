import type { Env } from '../../shared/types';
import { digest } from './auth';
import { validateWebsiteDraft,publicHttps } from '../../shared/websiteSubmission';
import { D } from '../../shared/discovery/decimal';
import { decimalNumber,exactValue } from '../../shared/creditPurchase';
export async function limitedText(response:Response,limit=262144){const reader=response.body?.getReader();if(!reader)return '';let n=0,text='';const decoder=new TextDecoder();while(true){const r=await reader.read();if(r.done)break;n+=r.value.length;if(n>limit){await reader.cancel();throw Error('Source response too large');}text+=decoder.decode(r.value,{stream:true});}return text+decoder.decode();}
function privateAddress(ip:string){return /^(127\.|10\.|192\.168\.|169\.254\.|0\.|172\.(1[6-9]|2\d|3[01])\.|224\.|::|fc|fd|fe80|ff)/i.test(ip)||ip.includes(':')&&ip.includes('.');}
export async function safeSource(url:string,fetcher:typeof fetch){
 const u=new URL(publicHttps(url,'source URL'));
 if([...u.searchParams.keys()].some(k=>/api.?key|token|secret|password|authorization/i.test(k)))throw Error('Do not put source credentials in public URLs');
 for(const type of ['A','AAAA']){
  const r=await fetcher(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(u.hostname)}&type=${type}`,{headers:{Accept:'application/dns-json'},signal:AbortSignal.timeout(10000),redirect:'manual'});
  if(!r.ok)throw Error('Source DNS unavailable');const b=await r.json() as {Status:number;Answer?:{type:number;data:string}[]};if(b.Status!==0)throw Error('Source DNS failed');if(b.Answer?.some(a=>[1,28].includes(a.type)&&privateAddress(a.data)))throw Error('Private source addresses are not allowed');
 }
 return u.href;
}
interface Monitor {id:string;url:string;adapter:string;submission_id:string|null;interval_hours:number;last_attempt_at:string|null;last_hash:string|null;etag:string|null;last_modified:string|null;lease_until:string|null}
export async function checkSources(env:Env,fetcher:typeof fetch=fetch,force=false){
 const sources=(await env.DB.prepare('SELECT * FROM source_monitors WHERE enabled=1 ORDER BY id LIMIT 30').all<Monitor>()).results;
 const results:{id:string;status:string}[]=[];
 for(const s of sources){
  const now=new Date(),stamp=now.toISOString();
  if(!force&&s.last_attempt_at&&Date.parse(s.last_attempt_at)+s.interval_hours*3600000>now.getTime())continue;
  const lease=await env.DB.prepare('UPDATE source_monitors SET lease_until=?,last_attempt_at=? WHERE id=? AND (lease_until IS NULL OR lease_until<?) AND (?=1 OR last_attempt_at IS NULL OR last_attempt_at<?)').bind(new Date(now.getTime()+120000).toISOString(),stamp,s.id,stamp,Number(force),new Date(now.getTime()-s.interval_hours*3600000).toISOString()).run();
  if(!lease.meta.changes)continue;
  let status='failed',hash=s.last_hash,error:string|null=null;
  try{
   const url=await safeSource(s.url,fetcher),headers:Record<string,string>={Accept:s.adapter==='page-watch'?'text/html':'application/json'};if(s.etag)headers['If-None-Match']=s.etag;if(s.last_modified)headers['If-Modified-Since']=s.last_modified;
   const response=await fetcher(url,{headers,redirect:'manual',signal:AbortSignal.timeout(15000)});
   if(response.status===304&&s.last_hash){status='unchanged';}
   else{
    if(!response.ok||response.status===304)throw Error('Source request failed');const text=await limitedText(response);hash=await digest(text);status=hash===s.last_hash?'unchanged':s.adapter==='page-watch'?'page_changed':'collected';
    if(s.adapter==='website-json-v1'&&hash!==s.last_hash){
     const draft=validateWebsiteDraft(JSON.parse(text)),target=s.submission_id?await env.DB.prepare('SELECT id,version,draft_json FROM website_submissions WHERE id=?').bind(s.submission_id).first<{id:string;version:number;draft_json:string}>():null;
     if(!target)throw Error('Structured source requires an explicitly assigned submission');
     if(JSON.stringify(draft)!==target.draft_json){await env.DB.prepare('INSERT OR IGNORE INTO source_candidates(id,source_id,submission_id,base_version,payload_json,created_at) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),s.id,target.id,target.version,JSON.stringify(draft),stamp).run();status='candidate_pending';}else status='unchanged';
    }
    await env.DB.prepare('UPDATE source_monitors SET etag=?,last_modified=? WHERE id=?').bind(response.headers.get('ETag'),response.headers.get('Last-Modified'),s.id).run();
   }
  }catch(e){error=e instanceof Error?e.message.slice(0,200):'Source check failed';}
  await env.DB.batch([env.DB.prepare('INSERT INTO source_checks(id,source_id,status,content_hash,error,created_at) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),s.id,error?'failed':status,error?s.last_hash:hash,error,stamp),env.DB.prepare('UPDATE source_monitors SET lease_until=NULL,last_error=?,last_hash=?,last_success_at=CASE WHEN ? IS NULL THEN ? ELSE last_success_at END WHERE id=?').bind(error,error?s.last_hash:hash,error,stamp,s.id)]);
  results.push({id:s.id,status:error?'failed':status});
 }
 return results;
}
export async function syncFx(env:Env,fetcher:typeof fetch=fetch){
 const row=await env.DB.prepare('SELECT checked_at FROM fx_snapshots ORDER BY rowid DESC LIMIT 1').first<{checked_at:string}>();if(row&&Date.now()-Date.parse(row.checked_at)<12*3600000)return {skipped:true};
 const url='https://api.frankfurter.dev/v1/latest?base=USD',response=await fetcher(url,{redirect:'manual',signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error('FX provider unavailable');
 const body=JSON.parse(await limitedText(response,65536));if(body.base!=='USD'||!/^\d{4}-\d\d-\d\d$/.test(body.date)||!Number.isFinite(Date.parse(body.date))||Date.parse(body.date)>Date.now()+86400000||Date.now()-Date.parse(body.date)>7*86400000||!body.rates||typeof body.rates!=='object')throw Error('Invalid or stale FX response');
 const rates:Record<string,string>={USD:'1'};for(const [code,rate] of Object.entries(body.rates)){if(!/^[A-Z]{3}$/.test(code)||typeof rate!=='number'||!Number.isFinite(rate)||rate<=0)throw Error('Invalid FX rate');rates[code]=decimalNumber(rate).text();if(D.parse(rates[code]).n<=0n)throw Error('Unsupported FX precision');}
 if(!rates.CNY)throw Error('Required currency missing');
 await env.DB.prepare('INSERT INTO fx_snapshots(id,base_currency,rate_date,rates_json,source_url,checked_at) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),'USD',body.date,JSON.stringify(rates),url,new Date().toISOString()).run();return {updated:true};
}
export async function readFx(env:Env,base='CNY'){
 if(!/^[A-Z]{3}$/.test(base))throw Error('Invalid base currency');
 const row=await env.DB.prepare('SELECT * FROM fx_snapshots ORDER BY rowid DESC LIMIT 1').first<{rates_json:string;rate_date:string;checked_at:string;source_url:string}>();if(!row)throw Error('No synchronized FX snapshot');
 if(!Number.isFinite(Date.parse(row.rate_date))||Date.now()-Date.parse(row.rate_date)>7*86400000)throw Error('FX snapshot expired');
 const source=JSON.parse(row.rates_json) as Record<string,string>;if(!source[base])throw Error('Base currency unavailable');
 // State uses: 1 unit of each currency = X units of base, inverse of provider quote.
 const rates:Record<string,number>={},ratesExact:Record<string,string>={},rateRatios:Record<string,{numerator:string;denominator:string}>={};
 for(const [code,rate] of Object.entries(source)){const v=D.parse(source[base]).div(D.parse(rate));rates[code]=Number(v.text());ratesExact[code]=v.text();rateRatios[code]=exactValue(v);}
 return {rates,ratesExact,rateRatios,rateMeta:{mode:'automatic' as const,baseCurrency:base,source:row.source_url,updatedAt:row.rate_date+'T00:00:00Z'},checkedAt:row.checked_at};
}
export async function scheduledOperations(env:Env,fetcher:typeof fetch=fetch){await env.DB.batch([env.DB.prepare('DELETE FROM auth_sessions WHERE expires_at<?').bind(new Date().toISOString()),env.DB.prepare('DELETE FROM auth_limits WHERE expires_at<?').bind(new Date().toISOString())]);const checks=await checkSources(env,fetcher);if(env.FX_SYNC_ENABLED==='true')try{await syncFx(env,fetcher);}catch{console.error('FX sync failed; previous snapshot retained');}return checks;}
