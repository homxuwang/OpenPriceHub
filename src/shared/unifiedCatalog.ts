import type { WebsitePlan } from './websiteSubmission';
import type { Tool } from './types';
export interface UnifiedProduct {id:string;slug:string;name:string;category:'image'|'video'|'voice'|'music'|'llm-api';website:string;description:string;descriptionZh?:string;providerId:string|null;modelIds:string[]}
export interface UnifiedPlan extends WebsitePlan {id:string;offerId:string;verifiedAt:string|null;stale:boolean;precision:'decimal-text'|'legacy-number';legacyConditions?:unknown}
export interface UnifiedCatalog {revision:string;storage:'database';products:UnifiedProduct[];providers:{id:string;name:string}[];models:{id:string;name:string;productId:string|null}[];channels:{id:string;name:string;website:string;relationship:string}[];offers:{id:string;productId:string;channelId:string;modelId:string|null;planIds:string[]}[];plans:UnifiedPlan[];alternatives:{originalId:string;alternativeId:string;reason:string}[]}
export interface UnifiedRepository {load(signal?:AbortSignal):Promise<UnifiedCatalog>}
export class UnifiedApiRepository implements UnifiedRepository {
 constructor(private readonly fetcher:typeof fetch=(...args)=>globalThis.fetch(...args)){}
 async load(signal?:AbortSignal){const r=await this.fetcher('/api/unified/catalog',{signal,cache:'no-store'});if(!r.ok)throw Error(`Catalog HTTP ${r.status}`);const b=await r.json();if(!b.success||!b.data||!Array.isArray(b.data.products)||!Array.isArray(b.data.plans))throw Error('Invalid unified catalog');return b.data as UnifiedCatalog;}
}
export function unifiedTools(c:UnifiedCatalog):Tool[]{return c.products.map(p=>{
 const offerIds=c.offers.filter(o=>o.productId===p.id).map(o=>o.id),plans=c.plans.filter(x=>offerIds.includes(x.offerId)),current=plans.filter(x=>!x.stale),first=current[0];
 const label=first?(first.amount!==null?`${first.amount} ${first.currency} / ${first.billing}`:first.components.find(x=>x.rate!==null)?`${first.components.find(x=>x.rate!==null)!.rate} ${first.currency} / ${first.components.find(x=>x.rate!==null)!.unit}`:'—'):'—';
 const pricingModels=[...new Set(current.flatMap(p=>p.pricingModels.map(m=>m==='monthly'||m==='annual'?'subscription':m==='credit-based'?'credit':m==='free'?'free':'usage')))] as Tool['pricingModel'][];
 const channels=c.offers.filter(o=>o.productId===p.id).map(o=>c.channels.find(ch=>ch.id===o.channelId)?.name||'');
 const searchTerms=[...p.modelIds.map(id=>c.models.find(m=>m.id===id)?.name||''),...channels];
 return {pricingModels,searchTerms,id:p.id,slug:p.slug,name:p.name,toolCategory:p.category,tagline:p.descriptionZh||p.description,taglineEn:p.description,url:p.website,pricingModel:first?.pricingModels.includes('credit-based')?'credit':first?.billing==='monthly'||first?.billing==='annual'?'subscription':'usage',fromPrice:null,fromCurrency:first?.currency||'USD',priceDisplay:label,live:true,freePlan:current.some(x=>x.billing==='free'&&x.amount==='0'),commercialUse:'unclear',watermark:'unknown',regions:[],audiences:[],tags:[],bestFor:[],notIdealFor:[],confidence:current.length?'verified':plans.length?'outdated':'pending',lastUpdated:current.map(x=>x.verifiedAt||'').sort().at(-1)||'',plans:[],popularity:0};
 });}
