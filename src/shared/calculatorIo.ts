import { normalizeManualState,type ManualCompareState,type ManualPriceItem,unitTypesForCategory } from './manualCompare';
import { normalizeDetailedState,createEmptyDetailedState,type DetailedCompareState } from './detailedCompare';
import { MANUAL_UNITS,type ManualUnitDefinition } from './manualUnits';
import { D } from './discovery/decimal';
import { exactValue,fromExact } from './creditPurchase';
import { fxValue } from './calculatorFx';
export type CalculatorMode='quick'|'detailed';
export interface ImportPreview<T> { data:T; fileVersion:number; mode:CalculatorMode; counts:Record<string,number>; warnings:string[] }
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const text=(v:unknown)=>typeof v==='string'&&v.length<=10000;
const finite=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)&&v>=0;
const currency=(v:unknown)=>typeof v==='string'&&/^[A-Z]{3}$/.test(v);
function assert(ok:unknown,message:string):asserts ok {if(!ok)throw Error(message);}
function decimal(v:unknown,nullable=false) {if(nullable&&v===null)return;assert(typeof v==='string','Invalid decimal / 十进制格式错误');D.parse(v);}
function optionalStrings(v:Record<string,unknown>,keys:string[]) {for(const k of keys)if(v[k]!==undefined)assert(text(v[k]),`Invalid ${k} / 文本字段无效`);}
function ids(rows:unknown):asserts rows is Record<string,unknown>[] {assert(Array.isArray(rows)&&rows.length<=5000,'Invalid or oversized collection / 数据列表无效或过大');const seen=new Set();for(const r of rows){assert(object(r)&&text(r.id)&&!!r.id&&!seen.has(r.id),'Missing or duplicate ID / 缺少或重复的标识');seen.add(r.id);}}
function units(v:unknown,warnings:string[],category?:string) {
 assert(Array.isArray(v)&&v.length<=100,'Invalid pricing components / 计价分项无效');
 for(const u of v){assert(object(u)&&MANUAL_UNITS.includes(u.unitType as typeof MANUAL_UNITS[number])&&(u.value===null||finite(u.value)),'Invalid pricing component / 单价字段无效');
  if(u.exactValue!==undefined)decimal(u.exactValue,true);if(u.included!==undefined)decimal(u.included);if(u.overageRate!==undefined)decimal(u.overageRate,true);
  if(u.tierMode!==undefined)assert(['graduated','volume'].includes(String(u.tierMode)),'Invalid tier mode / 阶梯方式无效');
  if(u.tiers!==undefined){assert(Array.isArray(u.tiers)&&u.tiers.length<=100,'Invalid tiers / 阶梯规则无效');let prev=D.parse('0');for(let i=0;i<u.tiers.length;i++){const t=u.tiers[i];assert(object(t),'Invalid tier / 阶梯无效');decimal(t.rate,true);if(t.rate===null)warnings.push('Missing tier rate: quote unavailable / 缺少阶梯单价，无法报价');if(t.upTo===null)assert(i===u.tiers.length-1,'Unbounded tier must be last / 无限阶梯必须最后一档');else{decimal(t.upTo);const bound=D.parse(t.upTo as string);assert(bound.cmp(prev)>0,'Tier bounds must increase / 阶梯上限必须递增');prev=bound;}}}
  if(category&&!unitTypesForCategory(category as ManualPriceItem['category']).includes(u.unitType as ManualUnitDefinition['unitType']))warnings.push('Unsupported category/unit combination will not be quoted / 类别与计价单位不匹配，导入后无法报价');
 }
}
function common(record:Record<string,unknown>) {
 optionalStrings(record,['parameters','comparisonScenario','creditPool','notes']);
 if(record.selectedUnit!==undefined)assert(MANUAL_UNITS.includes(record.selectedUnit as typeof MANUAL_UNITS[number]),'Invalid selected unit / 所选单位无效');
 if(record.billingTerms!==undefined){const b=record.billingTerms;assert(object(b)&&['usage','monthly','annual','free'].includes(String(b.kind)),'Invalid billing terms / 计费方式无效');decimal(b.fixedFee,true);decimal(b.minimumSpend,true);if(b.allowancePeriod!==undefined)assert(['month','year'].includes(String(b.allowancePeriod)),'Invalid allowance period / 额度周期无效');}
 if(record.purchaseTerms!==undefined){const t=record.purchaseTerms;assert(object(t)&&[true,false,null].includes(t.stackable as boolean|null)&&(t.maxPackages===null||(Number.isSafeInteger(t.maxPackages)&&Number(t.maxPackages)>0)),'Invalid package purchase terms / 套餐购买条件无效');for(const key of ['freeCredits','overagePerCredit','minimumSpend'])if(t[key]!==undefined)decimal(t[key],true);}
 for(const k of ['priceExact','creditAmountExact','planPriceExact'])if(record[k]!==undefined)decimal(record[k]);
}
export function exportCalculator(mode:CalculatorMode,data:ManualCompareState|DetailedCompareState) {
 return {format:'openpricehub-calculator',version:2,mode,exportedAt:new Date().toISOString(),data};
}
export function previewCalculatorImport<T extends CalculatorMode>(value:unknown,mode:T):ImportPreview<T extends 'quick'?ManualCompareState:DetailedCompareState> {
 assert(object(value),'Invalid JSON object / JSON 文件无效');let raw=value,fileVersion=1;
 if(value.format!==undefined){assert(value.format==='openpricehub-calculator'&&value.version===2,'Unsupported format/version / 不支持的文件格式或版本');assert(value.mode===mode,'Wrong calculator mode / 请在对应的快速或详细模式导入');assert(object(value.data),'Missing data / 缺少数据');raw=value.data;fileVersion=2;}
 assert(raw.version===1,'Unsupported data version / 不支持的数据版本');
 assert(object(raw.scenario)&&object(raw.rates)&&currency(raw.targetCurrency),'Missing scenario or rates / 缺少场景或汇率');
 const required=['textInputTokens','textOutputTokens','imageCount','videoSeconds','audioMinutes'];
 for(const k of required)assert(finite(raw.scenario[k]),'Invalid usage / 使用量无效');
 for(const [k,v]of Object.entries(raw.scenario)){if(k==='usagePeriod')assert(['request','month','year'].includes(String(v)),'Invalid usage period / 使用范围无效');else assert(finite(v),'Invalid usage / 使用量无效');}
 for(const [k,v]of Object.entries(raw.rates))assert(currency(k)&&finite(v)&&Number(v)>0,'Invalid exchange rate / 汇率或币种无效');
 if(raw.ratesExact!==undefined){assert(object(raw.ratesExact),'Invalid exact rates / 汇率格式无效');for(const [k,v]of Object.entries(raw.ratesExact)){assert(currency(k)&&Object.hasOwn(raw.rates,k),'Rate currency missing / 汇率币种缺失');decimal(v);assert(Number(v)===raw.rates[k],'Conflicting numeric/exact rate / 数值与精确汇率不一致');assert(D.parse(v as string).n>0n,'Rate must be positive / 汇率必须大于零');}}
 if(raw.rateRatios!==undefined){assert(object(raw.rateRatios),'Invalid rate ratios / 精确汇率无效');for(const [k,v]of Object.entries(raw.rateRatios)){assert(currency(k)&&Object.hasOwn(raw.rates,k)&&object(v)&&typeof v.numerator==='string'&&typeof v.denominator==='string'&&/^\d{1,1000}$/.test(v.numerator)&&/^[1-9]\d{0,999}$/.test(v.denominator),'Invalid rate fraction / 精确汇率分数无效');const ratio=fromExact(v as unknown as import('./creditPurchase').ExactValue);assert(ratio.n>0n,'Rate must be positive / 汇率必须大于零');if(object(raw.ratesExact)&&raw.ratesExact[k]!==undefined)assert(ratio.text()===D.parse(raw.ratesExact[k] as string).text(),'Rate display mismatch / 汇率显示与精确值不一致');}}
 if(raw.rateMeta!==undefined){const m=raw.rateMeta;assert(object(m)&&m.mode==='manual'&&currency(m.baseCurrency)&&text(m.source)&&text(m.updatedAt),'Invalid rate metadata / 汇率来源信息无效');assert(m.updatedAt===''||Number.isFinite(Date.parse(m.updatedAt as string)),'Invalid rate timestamp / 汇率时间无效');const baseValue=object(raw.ratesExact)&&raw.ratesExact[m.baseCurrency as string]!==undefined?raw.ratesExact[m.baseCurrency as string]:String(raw.rates[m.baseCurrency as string]);assert(typeof baseValue==='string'&&D.parse(baseValue).cmp(D.parse('1'))===0,'Base rate must equal 1 / 基准汇率必须为一');}
 const warnings:string[]=[];let normalized:ManualCompareState|DetailedCompareState|null,counts:Record<string,number>;
 if(mode==='quick'){
  ids(raw.items);for(const item of raw.items){assert(text(item.platformName)&&text(item.modelName)&&text(item.planName)&&currency(item.currency)&&['image','video','tts','music','text','audio'].includes(String(item.category))&&['plan_credit_based','direct_price_based'].includes(String(item.pricingMode))&&finite(item.planPrice)&&finite(item.creditAmount),'Invalid quick record / 快速记录字段无效');common(item);units(item.unitDefinitions,warnings,item.category as string);if(!item.parameters)warnings.push('Unconfirmed parameters are excluded from rankings / 参数未确认的项目不参加排名');}
  normalized=normalizeManualState(raw);counts={rules:raw.items.length};
 }else{
  for(const key of ['platforms','plans','models','rules'])ids(raw[key]);
  const platforms=raw.platforms as Record<string,unknown>[],plans=raw.plans as Record<string,unknown>[],models=raw.models as Record<string,unknown>[],rules=raw.rules as Record<string,unknown>[];
  for(const p of platforms)assert(text(p.name)&&currency(p.defaultCurrency)&&text(p.notes),'Invalid platform / 网站字段无效');
  for(const p of models)assert(text(p.name)&&['image','video','tts','music','text','audio'].includes(String(p.category)),'Invalid model / 模型字段无效');
  for(const p of plans){assert(platforms.some(x=>x.id===p.platformId)&&text(p.name)&&currency(p.currency)&&finite(p.price)&&finite(p.creditAmount)&&['monthly','yearly','one_time','custom'].includes(String(p.billingCycle))&&text(p.notes),'Invalid plan or relation / 套餐字段或关系无效');common(p);}
  for(const r of rules){assert(platforms.some(x=>x.id===r.platformId)&&models.some(x=>x.id===r.modelId)&&currency(r.currency)&&['plan_credit_based','direct_price_based'].includes(String(r.pricingMode))&&text(r.notes),'Invalid rule or relation / 价格规则字段或关系无效');common(r);units(r.unitDefinitions,warnings,String(models.find(x=>x.id===r.modelId)!.category));if(!r.parameters)warnings.push('Unconfirmed parameters are excluded from rankings / 参数未确认的项目不参加排名');}
  normalized=normalizeDetailedState(raw);counts={platforms:platforms.length,plans:plans.length,models:models.length,rules:rules.length};
 }
 assert(normalized,'Invalid data relationships or rates / 数据关联或汇率校验失败');
 if(fileVersion===1)warnings.push('Legacy v1 accepted; unknown purchase terms remain unconfirmed / 已兼容旧版，未知购买条件保持未确认');
 if(!normalized.rateMeta?.updatedAt)warnings.push('No recorded exchange-rate timestamp / 未记录汇率时间');
 return {data:normalized,fileVersion,mode,counts,warnings:[...new Set(warnings)]} as ImportPreview<T extends 'quick'?ManualCompareState:DetailedCompareState>;
}
export function quickToDetailed(quick:ManualCompareState,existing:DetailedCompareState,id=()=>crypto.randomUUID()):DetailedCompareState {
 const result=structuredClone(existing),empty=!result.platforms.length&&!result.models.length&&!result.rules.length;
 if(empty){result.rates=structuredClone(quick.rates);result.rateRatios=quick.rateRatios?structuredClone(quick.rateRatios):undefined;result.ratesExact=quick.ratesExact?structuredClone(quick.ratesExact):undefined;result.rateMeta=quick.rateMeta?structuredClone(quick.rateMeta):undefined;result.scenario=structuredClone(quick.scenario);result.targetCurrency=quick.targetCurrency;}
 else{
  const missing=Object.keys(quick.rates).filter(c=>!Object.hasOwn(result.rates,c));
  if(missing.length){const bridge=Object.keys(quick.rates).find(c=>Object.hasOwn(result.rates,c));if(!bridge)throw Error('No shared currency to merge rates / 无共同币种，无法安全合并汇率');for(const c of missing){const ratio=fxValue(quick,c).div(fxValue(quick,bridge)).mul(fxValue(result,bridge));const rate=ratio.text();result.rateRatios={...result.rateRatios,[c]:exactValue(ratio)};result.rates[c]=Number(rate);result.ratesExact={...result.ratesExact,[c]:rate};}result.rateMeta={mode:'manual',baseCurrency:result.rateMeta?.baseCurrency??'CNY',source:(result.rateMeta?.source??'Manual')+'; imported '+missing.join(',')+' from '+(quick.rateMeta?.source??'quick manual rates'),updatedAt:new Date().toISOString()};}
 }
 for(const item of quick.items){const platformId='p-'+id(),modelId='m-'+id(),planId='plan-'+id();
  result.platforms.push({id:platformId,name:item.platformName,defaultCurrency:item.currency,notes:'Saved from quick comparison / 来自快速模式'});
  result.models.push({id:modelId,name:item.modelName,category:item.category});
  const pool=item.creditPool||'pool-'+id();
  if(item.pricingMode==='plan_credit_based')result.plans.push({id:planId,platformId,name:item.planName||'Quick plan',price:item.planPrice,priceExact:item.planPriceExact,currency:item.currency,creditAmount:item.creditAmount,creditAmountExact:item.creditAmountExact,billingCycle:item.purchaseCycle??'custom',creditPool:pool,purchaseTerms:item.purchaseTerms,notes:''});
  result.rules.push({id:'r-'+id(),platformId,modelId,pricingMode:item.pricingMode,currency:item.currency,unitDefinitions:structuredClone(item.unitDefinitions),parameters:item.parameters,comparisonScenario:item.comparisonScenario,selectedUnit:item.selectedUnit,creditPool:pool,planIds:item.pricingMode==='plan_credit_based'?[planId]:undefined,billingTerms:item.billingTerms,notes:'Saved from quick comparison / 来自快速模式'});
 }
 return result;
}
export function readDetailedForTransfer():DetailedCompareState {
 const raw=localStorage.getItem('oph.detailed-compare.v1');if(!raw)return createEmptyDetailedState();const result=normalizeDetailedState(JSON.parse(raw));if(!result)throw Error('Existing detailed records cannot be read; export a backup first / 现有详细数据无法读取，请先备份');return result;
}
