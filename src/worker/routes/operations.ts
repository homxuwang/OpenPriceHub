import type { Env } from '../../shared/types';
import { administrator,readJson,audit } from '../services/auth';
import { readFx,syncFx,checkSources } from '../services/operations';
import { publicHttps } from '../../shared/websiteSubmission';
import { successResponse,errorResponse } from '../utils/response';
export async function handleOperations(request:Request,env:Env,headers:Record<string,string>,fetcher:typeof fetch=fetch){
 const path=new URL(request.url).pathname;
 try{
  if(path==='/api/operations/fx'&&request.method==='GET')return successResponse(await readFx(env,new URL(request.url).searchParams.get('base')||'CNY'),undefined,{...headers,'Cache-Control':'no-cache'});
  const actor=await administrator(request,env);if(!actor)return errorResponse('Administrator required',401,headers);
  if(path==='/api/operations/admin'&&request.method==='GET')return successResponse({sources:(await env.DB.prepare('SELECT * FROM source_monitors ORDER BY id').all()).results,candidates:(await env.DB.prepare("SELECT * FROM source_candidates WHERE status='pending' ORDER BY created_at DESC LIMIT 100").all()).results,checks:(await env.DB.prepare('SELECT * FROM source_checks ORDER BY rowid DESC LIMIT 100').all()).results},undefined,headers);
  if(path==='/api/operations/admin/sources'&&request.method==='POST'){
   const x=await readJson(request);if(!['page-watch','website-json-v1'].includes(x.adapter)||![12,24].includes(x.intervalHours)||typeof x.enabled!=='boolean')return errorResponse('Invalid source configuration',400,headers);
   const url=publicHttps(x.url,'source');if(x.adapter==='website-json-v1'&&(!x.submissionId||!await env.DB.prepare('SELECT id FROM website_submissions WHERE id=?').bind(x.submissionId).first()))return errorResponse('Explicit target submission required',400,headers);
   const id=crypto.randomUUID();await env.DB.prepare('INSERT INTO source_monitors(id,url,adapter,submission_id,interval_hours,enabled) VALUES(?,?,?,?,?,?)').bind(id,url,x.adapter,x.submissionId||null,x.intervalHours,Number(x.enabled)).run();await audit(env,actor.id,'add-source',id);return successResponse({id},undefined,headers);
  }
  if(path==='/api/operations/admin/check'&&request.method==='POST')return successResponse({checks:await checkSources(env,fetcher,true)},undefined,headers);
  if(path==='/api/operations/admin/fx-sync'&&request.method==='POST')return successResponse(await syncFx(env,fetcher),undefined,headers);
  if(path==='/api/operations/admin/candidate'&&request.method==='POST'){
   const x=await readJson(request);if(!['apply','reject'].includes(x.action))return errorResponse('Invalid action',400,headers);
   const c=await env.DB.prepare("SELECT * FROM source_candidates WHERE id=? AND status='pending'").bind(x.id).first<{id:string;submission_id:string;base_version:number;payload_json:string}>();if(!c)return errorResponse('Candidate not pending',404,headers);
   if(x.action==='apply'){
    const now=new Date().toISOString();await env.DB.batch([env.DB.prepare('INSERT INTO website_review_logs(id,submission_id,base_version,action,actor,notes,snapshot_json,created_at) VALUES(?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),c.submission_id,c.base_version,'save',actor.id,'Source candidate applied to review draft; not published',c.payload_json,now),env.DB.prepare('UPDATE website_submissions SET draft_json=?,version=version+1,updated_at=? WHERE id=?').bind(c.payload_json,now,c.submission_id),env.DB.prepare("UPDATE source_candidates SET status='applied' WHERE id=?").bind(c.id)]);
   }else {const change=await env.DB.prepare("UPDATE source_candidates SET status='rejected' WHERE id=? AND status='pending'").bind(c.id).run();if(!change.meta.changes)return errorResponse('Candidate changed',409,headers);}
   await audit(env,actor.id,'source-candidate-'+x.action,c.id);return successResponse({published:false},'Candidate reviewed; publish prices separately in website review',headers);
  }
  if(path==='/api/operations/admin/disable-source'&&request.method==='POST'){const x=await readJson(request);await env.DB.prepare('UPDATE source_monitors SET enabled=0 WHERE id=?').bind(x.id).run();return successResponse({},undefined,headers);}
  return errorResponse('Not found',404,headers);
 }catch(e){console.error('Operations failed:',e instanceof Error?e.name:'unknown');if(path.includes('fx'))console.error('FX provider diagnostic:',e instanceof Error?e.message:'unknown');if(path.includes('fx'))return errorResponse('FX provider or synchronized snapshot unavailable; previous valid rates retained',503,headers);return errorResponse('Operation failed or candidate version changed; previous published data retained',409,headers);}
}
