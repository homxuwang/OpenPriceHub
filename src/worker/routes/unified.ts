import type { Env } from '../../shared/types';
import type { Catalog } from '../../shared/catalog/types';
import { decimalNumber } from '../../shared/creditPurchase';
import type { UnifiedCatalog,UnifiedPlan } from '../../shared/unifiedCatalog';
import { emptyWebsitePlan } from '../../shared/websiteSubmission';
import { digest,administrator,readJson,audit } from '../services/auth';
import { successResponse,errorResponse } from '../utils/response';
export async function loadUnified(env:Env):Promise<UnifiedCatalog>{
 const snapshot=await env.DB.prepare('SELECT id,catalog_json FROM catalog_revisions ORDER BY rowid DESC LIMIT 1').first<{id:string;catalog_json:string}>();
 const c:Catalog=snapshot?JSON.parse(snapshot.catalog_json):{version:1,updatedAt:'',sources:[],products:[],alternatives:[]};
 const rows=(await env.DB.prepare('SELECT l.id,l.product_id,l.model_id,l.product_model_id,l.channel_id,v.id AS revision,v.verified_at,v.public_json FROM channel_listings l JOIN listing_price_versions v ON v.id=l.active_version_id ORDER BY l.id').all<{id:string;product_id:string|null;model_id:string|null;product_model_id:string|null;channel_id:string;revision:string;verified_at:string;public_json:string}>()).results;
 const result:UnifiedCatalog={revision:'',storage:'database',products:[],providers:[],models:[],channels:[],offers:[],plans:[],alternatives:c.alternatives.filter(a=>a.status==='verified').map(a=>({originalId:'catalog:'+a.original,alternativeId:'catalog:'+a.alternative,reason:a.reason}))};
 const isStale=(date:string|null)=>!date||!Number.isFinite(Date.parse(date))||Date.now()-Date.parse(date)>7*86400000||Date.parse(date)>Date.now()+86400000;
 for(const p of c.products){
  const id='catalog:'+p.id,channelId='official:'+p.id,offerId='catalog-offer:'+p.id;
  if(!result.providers.some(x=>x.id===p.provider))result.providers.push({id:p.provider,name:p.provider});
  const modelIds=p.models.map((name,i)=>{const mid=`catalog-model:${p.id}-model-${i}`;result.models.push({id:mid,name,productId:id});return mid;});
  result.products.push({id,slug:p.slug,name:p.name,category:p.category,website:p.website,description:p.summary,descriptionZh:p.summaryZh,providerId:p.provider,modelIds});
  result.channels.push({id:channelId,name:p.provider,website:p.website,relationship:'official'});
  const planIds:string[]=[];
  for(const plan of p.plans){
   const planId='catalog-plan:'+plan.id;planIds.push(planId);
   const unitMap:Record<string,string>={image:'per_image',second:'per_second',video:'per_video',characters:'per_character',minute:'per_minute',song:'per_song',generation:'per_generation',credit:'per_credit'};
   result.plans.push({...emptyWebsitePlan(),id:planId,offerId,name:plan.name,currency:plan.currency,amount:plan.amount===null?null:String(plan.amount),billing:plan.billing==='pay-as-you-go'?'usage':plan.billing==='package'?'package':plan.billing,pricingModels:plan.pricingModels,sourceUrl:c.sources.find(s=>plan.sourceIds.includes(s.id))?.url||p.website,freeAllowance:plan.freeAllowance,restrictions:plan.limits.join('\n'),verifiedAt:plan.verifiedAt,stale:plan.status!=='verified'||isStale(plan.verifiedAt),precision:'legacy-number',legacyConditions:plan,components:plan.components.map(x=>({unit:unitMap[x.unit],rate:x.rate===null?null:decimalNumber(x.rate).div(decimalNumber(x.unitSize)).text(),included:x.included===null?null:String(x.included),overage:null,creditsPerUnit:x.creditsPerUnit===null?null:String(x.creditsPerUnit),modelName:x.model,resolution:x.resolution,quality:x.quality,durationSeconds:x.durations.length===1?String(x.durations[0]):null}))});
  }
  result.offers.push({id:offerId,productId:id,channelId,modelId:null,planIds});
 }
 const legacyModels=(await env.DB.prepare('SELECT id,name FROM models ORDER BY id').all<{id:string;name:string}>()).results;
 for(const m of legacyModels)result.models.push({id:'legacy-model:'+m.id,name:m.name,productId:null});
 for(const row of rows){
  const p=JSON.parse(row.public_json),productId=row.product_id&&result.products.some(p=>p.id==='catalog:'+row.product_id)?'catalog:'+row.product_id:'listing:'+row.id,offerId='listing-offer:'+row.id;
  if(!result.products.some(p=>p.id===productId))result.products.push({id:productId,slug:'channel-'+row.id,name:p.name,category:p.category,website:p.website,description:p.description,providerId:null,modelIds:[]});
  const channelId='channel:'+row.channel_id;result.channels.push({id:channelId,name:p.name,website:p.website,relationship:p.relationship});
  const modelId=row.model_id?'legacy-model:'+row.model_id:row.product_model_id?'catalog-model:'+row.product_model_id:null;
  const product=result.products.find(p=>p.id===productId)!;if(modelId&&!product.modelIds.includes(modelId))product.modelIds.push(modelId);
  const planIds:string[]=[];p.plans.forEach((plan:UnifiedPlan,i:number)=>{const id=`listing-plan:${row.revision}:${i}`;planIds.push(id);result.plans.push({...plan,id,offerId,verifiedAt:row.verified_at,stale:isStale(row.verified_at),precision:'decimal-text'});});
  result.offers.push({id:offerId,productId,channelId,modelId,planIds});
 }
 result.channels=[...new Map(result.channels.map(x=>[x.id,x])).values()];
 result.revision=await digest(JSON.stringify({snapshot:snapshot?.id||null,rows:rows.map(r=>[r.id,r.revision,r.product_id,r.model_id,r.product_model_id])}));return result;
}
export async function handleUnified(request:Request,env:Env,headers:Record<string,string>){
 const path=new URL(request.url).pathname;
 if(path==='/api/unified/catalog'&&request.method==='GET')return successResponse(await loadUnified(env),undefined,{...headers,'Cache-Control':'no-cache'});
 if(path==='/api/unified/admin/link'&&request.method==='PUT'){
  const actor=await administrator(request,env);if(!actor)return errorResponse('Administrator required',401,headers);
  const x=await readJson(request);const listing=await env.DB.prepare('SELECT id,category FROM channel_listings WHERE id=?').bind(x.listingId).first<{id:string;category:string}>();if(!listing)return errorResponse('Listing not found',404,headers);
  for(const [field,table] of [['productId','products'],['modelId','models'],['productModelId','product_models']] as const)if(x[field]!=null&&!await env.DB.prepare(`SELECT id FROM ${table} WHERE id=?`).bind(x[field]).first())return errorResponse('Unknown explicit entity ID',400,headers);
  if(x.modelId&&x.productModelId)return errorResponse('Select one canonical model namespace',400,headers);
  if(x.productId){const p=await env.DB.prepare('SELECT category_id FROM products WHERE id=?').bind(x.productId).first<{category_id:string}>();if(p?.category_id!==listing.category)return errorResponse('Product category mismatch',400,headers);}
  if(x.modelId){const m=await env.DB.prepare('SELECT category FROM models WHERE id=?').bind(x.modelId).first<{category:string}>();const allowed=listing.category==='llm-api'?'text':['voice','music'].includes(listing.category)?'audio':listing.category;if(m?.category!==allowed)return errorResponse('Model category mismatch',400,headers);}
  if(x.productModelId&&x.productId){const m=await env.DB.prepare('SELECT product_id FROM product_models WHERE id=?').bind(x.productModelId).first<{product_id:string}>();if(m?.product_id!==x.productId)return errorResponse('Model/product relation mismatch',400,headers);}
  await env.DB.prepare('UPDATE channel_listings SET product_id=?,model_id=?,product_model_id=? WHERE id=?').bind(x.productId||null,x.modelId||null,x.productModelId||null,x.listingId).run();await audit(env,actor.id,'link-listing',x.listingId);return successResponse({},undefined,headers);
 }
 return errorResponse('Not found',404,headers);
}
