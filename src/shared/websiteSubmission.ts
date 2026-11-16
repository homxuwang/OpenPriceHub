import { D } from './discovery/decimal';
import { UNIT_LABELS as MANUAL_UNIT_LABELS } from './manualUnits';

export const WEBSITE_CATEGORIES = ['image','video','voice','music','llm-api'] as const;
export const CHANNEL_RELATIONSHIPS = ['official','third_party','independent'] as const;
export const WEBSITE_PRICING_MODELS = ['free','monthly','annual','pay-as-you-go','credit-based','usage-based-package','freemium','one-time'] as const;
export const WEBSITE_UNITS = Object.keys(MANUAL_UNIT_LABELS.zh);
export interface WebsiteComponent {
  unit: string; rate: string|null; included: string|null; overage: string|null;
  creditsPerUnit: string|null; modelName:string; resolution:string; quality:string; durationSeconds:string|null;
}
export interface WebsitePlan {
  name:string; currency:string; amount:string|null;
  billing:'free'|'monthly'|'annual'|'usage'|'package'|'one-time'; pricingModels:string[];
  sourceUrl:string; freeAllowance:string; restrictions:string; creditPool:string;
  creditAmount:string|null; stackable:boolean|null; components:WebsiteComponent[];
}
export interface WebsiteDraft {
  name:string; website:string; relationship:typeof CHANNEL_RELATIONSHIPS[number];
  category:typeof WEBSITE_CATEGORIES[number]; description:string; pricingUrl:string;
  plans:WebsitePlan[];
}
export interface WebsiteReviewRecord {
  id:string; original:WebsiteDraft; draft:WebsiteDraft; contactEmail:string;
  status:'pending'|'changes_requested'|'approved'|'rejected'; version:number;
  listingId:string|null; adminNotes:string; createdAt:string; updatedAt:string;
}
export const emptyWebsitePlan = ():WebsitePlan=>({name:'',currency:'USD',amount:null,billing:'usage',pricingModels:['pay-as-you-go'],sourceUrl:'',freeAllowance:'',restrictions:'',creditPool:'',creditAmount:null,stackable:null,components:[]});
export const emptyWebsiteDraft = ():WebsiteDraft=>({name:'',website:'',relationship:'independent',category:'image',description:'',pricingUrl:'',plans:[]});
export const emptyWebsiteComponent = ():WebsiteComponent=>({unit:'per_image',rate:null,included:null,overage:null,creditsPerUnit:null,modelName:'',resolution:'',quality:'',durationSeconds:null});
function field(value:unknown,name:string,max=500,required=false):string {
  if(typeof value!=='string'||value.length>max||(required&&!value.trim()))throw new Error(`Invalid ${name}`);
  return value.trim();
}
export function publicHttps(value:unknown,name:string):string {
 const text=field(value,name,2000,true);let u:URL;try{u=new URL(text);}catch{throw new Error(`Invalid ${name}`);}
 // URLs are stored/displayed only; this API never fetches submitter URLs.
 if(u.protocol!=='https:'||u.username||u.password||!u.hostname.includes('.')||u.hostname==='localhost'||u.hostname.endsWith('.local')||u.hostname.endsWith('.localhost')||u.hostname.endsWith('.internal')||/^\d+\.\d+\.\d+\.\d+$/.test(u.hostname)||u.hostname.startsWith('['))throw new Error(`Public HTTPS URL required: ${name}`);
 return u.href;
}
function decimal(value:unknown,name:string):string|null {
 if(value===null||value==='')return null;
 if(typeof value!=='string')throw new Error(`Decimal text required: ${name}`);
 try{return D.parse(value).text();}catch{throw new Error(`Invalid decimal: ${name}`);}
}
export function validateWebsiteDraft(input:unknown,publish=false):WebsiteDraft {
 const x=input as WebsiteDraft;
 if(!x||typeof x!=='object'||!WEBSITE_CATEGORIES.includes(x.category)||!CHANNEL_RELATIONSHIPS.includes(x.relationship)||!Array.isArray(x.plans)||x.plans.length>10)throw new Error('Invalid website/category/plans');
 const d:WebsiteDraft={name:field(x.name,'name',200,true),website:publicHttps(x.website,'website'),relationship:x.relationship,category:x.category,description:field(x.description,'description',4000),pricingUrl:publicHttps(x.pricingUrl,'pricing URL'),plans:[]};
 const unitsByCategory:Record<string,string[]>={image:['per_image','per_credit'],video:['per_video','per_second','per_credit'],voice:['per_character','per_minute','per_credit'],music:['per_song','per_generation','per_minute','per_second','per_credit'],'llm-api':WEBSITE_UNITS.filter(u=>u.includes('tokens')||u==='per_credit')};
 if(x.plans.reduce((n,p)=>n+(Array.isArray(p?.components)?p.components.length:0),0)>60)throw new Error('Invalid component count (maximum 60)');
 d.plans=x.plans.map(p=>{
  if(!p||!['free','monthly','annual','usage','package','one-time'].includes(p.billing)||!Array.isArray(p.pricingModels)||!p.pricingModels.length||p.pricingModels.some(m=>!WEBSITE_PRICING_MODELS.includes(m as typeof WEBSITE_PRICING_MODELS[number]))||!Array.isArray(p.components)||p.components.length>30||!/^([A-Z]{3})$/.test(p.currency)||![true,false,null].includes(p.stackable))throw new Error('Invalid plan');
  const plan:WebsitePlan={name:field(p.name,'plan name',200,true),currency:p.currency,amount:decimal(p.amount,'plan amount'),billing:p.billing,pricingModels:[...new Set(p.pricingModels)],sourceUrl:publicHttps(p.sourceUrl||d.pricingUrl,'plan source'),freeAllowance:field(p.freeAllowance,'free allowance',2000),restrictions:field(p.restrictions,'restrictions',4000),creditPool:field(p.creditPool,'credit pool',200),creditAmount:decimal(p.creditAmount,'credit amount'),stackable:p.stackable,components:[]};
  plan.components=p.components.map(c=>{
   if(!c||!unitsByCategory[d.category].includes(c.unit))throw new Error('Unit does not match category');
   const v:WebsiteComponent={unit:c.unit,rate:decimal(c.rate,'rate'),included:decimal(c.included,'included'),overage:decimal(c.overage,'overage'),creditsPerUnit:decimal(c.creditsPerUnit,'credits per unit'),modelName:field(c.modelName,'model',200),resolution:field(c.resolution,'resolution',100),quality:field(c.quality,'quality',100),durationSeconds:decimal(c.durationSeconds,'duration')};
   if(v.durationSeconds==='0'||v.creditsPerUnit==='0')throw new Error('Consumption/duration must be positive');
   if(v.overage!==null&&v.included===null)throw new Error('Overage requires explicit included quantity');
   return v;
  });
  if(plan.creditAmount==='0')throw new Error('Credit amount must be positive');
  if(plan.creditAmount!==null&&!plan.creditPool)throw new Error('Credit pool required');
  const requiredModel:Record<string,string>={free:'free',monthly:'monthly',annual:'annual',usage:'pay-as-you-go',package:'usage-based-package','one-time':'one-time'};
  if(!plan.pricingModels.includes(requiredModel[plan.billing]))throw new Error('Invalid billing cycle / pricing model combination');
  if(publish){
   if(plan.amount===null&&!plan.components.some(c=>c.rate!==null))throw new Error('Publish requires a known price (zero must be explicit)');
   if(plan.billing==='free'&&plan.amount!=='0')throw new Error('Free plan requires explicit zero amount');
   if(['monthly','annual','package','one-time'].includes(plan.billing)&&plan.amount===null)throw new Error('Purchase amount required');
   if(plan.pricingModels.includes('credit-based')&&(plan.creditAmount===null||!plan.creditPool))throw new Error('Credit-based plan requires explicit credit pool and amount');
  }
  return plan;
 });
 if(publish&&!d.plans.length)throw new Error('Add at least one priced plan before publication');
 return d;
}
