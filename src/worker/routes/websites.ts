import { administrator,principal,sameOrigin } from '../services/auth';
import type { D1PreparedStatement } from '@cloudflare/workers-types';
import type { Env } from '../../shared/types';
import { validateWebsiteDraft, type WebsiteReviewRecord } from '../../shared/websiteSubmission';
import { successResponse, errorResponse } from '../utils/response';

interface SubmissionRow {id:string;original_json:string;draft_json:string;contact_email:string;status:WebsiteReviewRecord['status'];version:number;listing_id:string|null;admin_notes:string;created_at:string;updated_at:string}
const record=(s:SubmissionRow):WebsiteReviewRecord=>({id:s.id,original:JSON.parse(s.original_json),draft:JSON.parse(s.draft_json),contactEmail:s.contact_email,status:s.status,version:s.version,listingId:s.listing_id,adminNotes:s.admin_notes,createdAt:s.created_at,updatedAt:s.updated_at});
async function body(request:Request):Promise<any>{
 if(!request.headers.get('Content-Type')?.includes('application/json'))throw new Error('JSON content type required');
 const reader=request.body?.getReader();if(!reader)throw new Error('Request body required');
 const chunks:Uint8Array[]=[];let size=0;
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>65536){await reader.cancel();throw new Error('Maximum payload is 64 KB');}chunks.push(value);}
 const result=new Uint8Array(size);let offset=0;for(const c of chunks){result.set(c,offset);offset+=c.length;}
 try{return JSON.parse(new TextDecoder().decode(result));}catch{throw new Error('Invalid JSON');}
}
export async function handleWebsites(request:Request,env:Env,baseHeaders:Record<string,string>):Promise<Response>{
 const path=new URL(request.url).pathname,headers={...baseHeaders,'Cache-Control':'no-store'};
 try{
  if(path.startsWith('/api/websites/admin')){
   const actor=await administrator(request,env,false);
   if(!actor)return errorResponse('Valid administrator key required',401,headers);
   if(path==='/api/websites/admin/submissions'&&request.method==='GET'){
    const rows=await env.DB.prepare('SELECT * FROM website_submissions ORDER BY updated_at DESC,id LIMIT 200').all<SubmissionRow>();
    return successResponse({submissions:rows.results.map(record)},undefined,headers);
   }
   const match=path.match(/^\/api\/websites\/admin\/submissions\/([a-zA-Z0-9-]+)$/);
   if(match&&request.method==='GET'){
    const row=await env.DB.prepare('SELECT * FROM website_submissions WHERE id=?').bind(match[1]).first<SubmissionRow>();
    if(!row)return errorResponse('Submission not found',404,headers);
    const logs=await env.DB.prepare('SELECT action,actor,notes,base_version,created_at FROM website_review_logs WHERE submission_id=? ORDER BY base_version DESC').bind(row.id).all();
    return successResponse({submission:record(row),logs:logs.results},undefined,headers);
   }
   if(match&&request.method==='PUT'){
    const input=await body(request);
    if(input.action==='publish'&&!await administrator(request,env))return errorResponse('Publishing requires administrator role',403,headers);
    if(!['save','request_changes','reject','publish'].includes(input.action)||!Number.isSafeInteger(input.version))return errorResponse('Action and current version required',400,headers);
    const row=await env.DB.prepare('SELECT * FROM website_submissions WHERE id=?').bind(match[1]).first<SubmissionRow>();
    if(!row)return errorResponse('Submission not found',404,headers);
    if(row.version!==input.version)return errorResponse('Record changed. Reload before editing.',409,headers);
    if(row.status==='approved'&&['reject','request_changes'].includes(input.action))return errorResponse('Published prices must be corrected with a new publication, not rejected.',409,headers);
    const draft=validateWebsiteDraft(input.draft,input.action==='publish');
    const notes=typeof input.notes==='string'?input.notes.trim():'';
    if(notes.length>4000)return errorResponse('Notes too long',400,headers);
    if(['reject','request_changes'].includes(input.action)&&!notes)return errorResponse('Review reason required',400,headers);
    if(input.action==='publish'&&input.confirmed!==true)return errorResponse('Confirm official/third-party relationship, price source and billing terms before publishing',400,headers);
    const now=new Date().toISOString(),db=env.DB,statements:D1PreparedStatement[]=[];
    statements.push(db.prepare('INSERT INTO website_review_logs(id,submission_id,base_version,action,actor,notes,snapshot_json,created_at) VALUES(?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),row.id,row.version,input.action,actor.id,notes,JSON.stringify(draft),now));
    let listingId=row.listing_id;
    if(input.action==='publish'){
     const listing=listingId?await db.prepare('SELECT channel_id FROM channel_listings WHERE id=?').bind(listingId).first<{channel_id:string}>():null;
     const channelId=listing?.channel_id||crypto.randomUUID();listingId=listingId||crypto.randomUUID();
     const versionId=crypto.randomUUID();
     statements.push(db.prepare('INSERT INTO channels(id,name,website,relationship,created_at) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,website=excluded.website,relationship=excluded.relationship').bind(channelId,draft.name,draft.website,draft.relationship,now));
     if(!row.listing_id)statements.push(db.prepare('INSERT INTO channel_listings(id,channel_id,category,created_at) VALUES(?,?,?,?)').bind(listingId,channelId,draft.category,now));
     statements.push(db.prepare('INSERT INTO listing_price_versions(id,listing_id,submission_id,revision,public_json,verified_at,created_at) VALUES(?,?,?,?,?,?,?)').bind(versionId,listingId,row.id,row.version,JSON.stringify(draft),now,now));
     for(const plan of draft.plans){
      const planId=crypto.randomUUID();
      statements.push(db.prepare('INSERT INTO listing_pricing_plans(id,version_id,name,currency,amount_decimal,billing_cycle,pricing_models,source_url,free_allowance,restrictions,credit_pool,credit_amount_decimal,stackable) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(planId,versionId,plan.name,plan.currency,plan.amount,plan.billing,JSON.stringify(plan.pricingModels),plan.sourceUrl,plan.freeAllowance,plan.restrictions,plan.creditPool,plan.creditAmount,plan.stackable===null?null:Number(plan.stackable)));
      for(const c of plan.components)statements.push(db.prepare('INSERT INTO listing_price_components(id,plan_id,unit,rate_decimal,included_decimal,overage_decimal,credits_per_unit_decimal,model_name,resolution,quality,duration_seconds_decimal) VALUES(?,?,?,?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),planId,c.unit,c.rate,c.included,c.overage,c.creditsPerUnit,c.modelName,c.resolution,c.quality,c.durationSeconds));
     }
     statements.push(db.prepare('UPDATE channel_listings SET active_version_id=?,category=? WHERE id=?').bind(versionId,draft.category,listingId));
    }
    const status=input.action==='publish'?'approved':input.action==='reject'?'rejected':input.action==='request_changes'?'changes_requested':row.status;
    statements.push(db.prepare('UPDATE website_submissions SET draft_json=?,status=?,version=version+1,listing_id=?,admin_notes=?,updated_at=? WHERE id=?').bind(JSON.stringify(draft),status,listingId,notes,now,row.id));
    try{await db.batch(statements);}catch(error){if(/stale_review|UNIQUE constraint failed: website_review_logs/.test(String(error)))return errorResponse('Record changed. Reload before editing.',409,headers);throw error;}
    return successResponse({id:row.id,status,version:row.version+1,listingId},'Review saved',headers);
   }
   return errorResponse('Not found',404,headers);
  }
  if(path==='/api/websites/submissions'&&request.method==='POST'){
   if(!sameOrigin(request,env))return errorResponse('Origin not allowed',403,headers);
   const owner=await principal(request,env);
   const input=await body(request);if(input.company)return errorResponse('Invalid submission',400,headers);
   if(typeof input.requestId!=='string'||!/^[-a-zA-Z0-9]{16,80}$/.test(input.requestId))return errorResponse('Request ID required',400,headers);
   const draft=validateWebsiteDraft(input.draft),email=String(input.contactEmail||'').trim();
   if(email.length>254||!/^\S+@\S+\.\S+$/.test(email)||input.consent!==true)return errorResponse('Valid contact email and publication consent required',400,headers);
   const original=JSON.stringify(draft),existing=await env.DB.prepare('SELECT original_json,contact_email FROM website_submissions WHERE id=?').bind(input.requestId).first<{original_json:string;contact_email:string}>();
   if(existing){if(existing.original_json!==original||existing.contact_email!==email)return errorResponse('Request ID already used',409,headers);return successResponse({id:input.requestId,status:'received'},'Already received',headers);}
   const now=new Date(),stamp=now.toISOString();
   const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(`${now.toISOString().slice(0,13)}:${request.headers.get('CF-Connecting-IP')||'local'}`));
   const bucket=Array.from(new Uint8Array(hash),n=>n.toString(16).padStart(2,'0')).join('');
   try{await env.DB.batch([
    env.DB.prepare('DELETE FROM website_submission_limits WHERE expires_at<?').bind(stamp),
    env.DB.prepare('INSERT INTO website_submission_limits(bucket,count,expires_at) VALUES(?,1,?) ON CONFLICT(bucket) DO UPDATE SET count=count+1').bind(bucket,new Date(now.getTime()+7200000).toISOString()),
    env.DB.prepare('INSERT INTO website_submissions(id,original_json,draft_json,contact_email,created_at,updated_at,owner_user_id) VALUES(?,?,?,?,?,?,?)').bind(input.requestId,original,original,email,stamp,stamp,owner?.id==='bootstrap'?null:owner?.id||null)
   ]);}catch(error){if(String(error).includes('CHECK constraint failed'))return errorResponse('Too many submissions; try again next hour',429,headers);if(String(error).includes('UNIQUE constraint failed'))return errorResponse('Request already processed; retry to confirm',409,headers);throw error;}
   return successResponse({id:input.requestId,status:'pending'},'Received for administrator review; not published',headers);
  }
  if(path==='/api/websites'&&request.method==='GET'){
   const rows=await env.DB.prepare('SELECT l.id,v.id AS revision,v.verified_at,v.public_json FROM channel_listings l JOIN listing_price_versions v ON v.id=l.active_version_id ORDER BY v.created_at DESC,l.id LIMIT 200').all<{id:string;revision:string;verified_at:string;public_json:string}>();
   return successResponse({listings:rows.results.map(r=>({id:r.id,revision:r.revision,verifiedAt:r.verified_at,...JSON.parse(r.public_json)}))},undefined,headers);
  }
  return errorResponse('Not found',404,headers);
 }catch(error){
  const message=String(error);
  if(/no such table/.test(message))return errorResponse('Website submission database is not initialized. Administrator must apply migration 0005 before using this feature.',503,headers);
  if(/Invalid |required|requires|must be|does not match|Maximum payload|Add at least|JSON content|Request body|Decimal text|Overage|Credit pool|Credit-based|Purchase amount|Publish requires|Free plan/.test(message))return errorResponse(message.replace(/^Error: /,''),400,headers);
  console.error('Website API failed',message);return errorResponse('Website service unavailable. No publication was committed.',503,headers);
 }
}
