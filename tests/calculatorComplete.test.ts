import {describe,it,expect} from 'vitest';
import {calculateManualComparison,createManualSampleState,DEFAULT_MANUAL_STATE,type ManualPriceItem,type ManualCompareState} from '../src/shared/manualCompare';
import {createEmptyDetailedState,createDetailedSampleState} from '../src/shared/detailedCompare';
import {exportCalculator,previewCalculatorImport,quickToDetailed} from '../src/shared/calculatorIo';
import {fxValue,rebaseFx} from '../src/shared/calculatorFx';
import {legacyDecimalText} from '../src/shared/creditPurchase';
import {groupComparisons} from '../src/shared/manualComparisonGroups';
import type {ManualUnitDefinition} from '../src/shared/manualUnits';
const scenario={...DEFAULT_MANUAL_STATE.scenario,imageCount:10,textInputTokens:1000,textOutputTokens:0,ttsCharacters:1000,musicSongs:2,musicGenerations:3,videoCount:2,creditCount:50};
function item(patch:Partial<ManualPriceItem>={}):ManualPriceItem{return {id:'sim',platformName:'SIM Provider',modelName:'SIM Model',category:'image',pricingMode:'direct_price_based',planName:'',planPrice:0,creditAmount:0,currency:'CNY',parameters:'standard',unitDefinitions:[{unitType:'per_image',value:0.1}],...patch};}
const quote=(patch:Partial<ManualPriceItem>={},usage=scenario)=>calculateManualComparison(item(patch),usage,{CNY:1,USD:7.2},'CNY');
const component=(u:Partial<ManualUnitDefinition>)=>[{unitType:'per_image' as const,value:null,...u}];
describe('P2 complete pricing',()=>{
 it.each([
 ['image','per_image',10,'1'],['video','per_video',2,'0.2'],['video','per_second',5,'0.5'],['tts','per_character',1000,'100'],['tts','per_minute',1,'0.1'],['music','per_song',2,'0.2'],['music','per_generation',3,'0.3'],
 ] as const)('%s %s prices actual quantities', (category,unitType,_quantity,cost)=>expect(quote({category,unitDefinitions:[{unitType,value:0.1}]}).purchase.amount).toBe(cost));
 it('normalizes 1K/1M only for equal-workload totals, never mixes raw unit rankings',()=>{
  const usage={...scenario,textInputTokens:1000000};
  const a=quote({category:'text',unitDefinitions:[{unitType:'per_1k_input_tokens',value:0.005}]},usage),b=quote({id:'b',category:'text',unitDefinitions:[{unitType:'per_1m_input_tokens',value:5}]},usage);
  expect(a.purchase.amount).toBe('5');expect(b.purchase.amount).toBe('5');expect(groupComparisons([a,b],'same_unit','unit')).toHaveLength(2);expect(groupComparisons([a,b],'same_usage','scenario')).toHaveLength(1);
 });
 it('prices non-cached input, output and cached input separately',()=>{
  const r=quote({category:'text',unitDefinitions:[{unitType:'per_1k_input_tokens',value:2},{unitType:'per_1k_output_tokens',value:4},{unitType:'per_1k_cached_tokens',value:0.5}]},{...scenario,textOutputTokens:500,textCachedTokens:300});expect(r.purchase.amount).toBe('4.15');
  expect(quote({category:'text',unitDefinitions:[{unitType:'per_1k_input_tokens',value:2}]},{...scenario,textCachedTokens:300}).purchase.amount).toBeNull();
 });
 it('blocks duplicate token units for the same charge dimension',()=>expect(quote({category:'text',unitDefinitions:[{unitType:'per_1k_input_tokens',value:1},{unitType:'per_1m_input_tokens',value:2}]}).comparisonIssue).toBe('ambiguous-unit'));
 it('prices credits only within a declared pool and does not compare different pools',()=>{
  const a=quote({creditPool:'pool-a',unitDefinitions:[{unitType:'per_credit',value:0.2}]}),b=quote({id:'b',creditPool:'pool-b',unitDefinitions:[{unitType:'per_credit',value:0.1}]});expect(a.purchase.amount).toBe('10');expect(groupComparisons([a,b],'same_usage','scenario')).toHaveLength(2);
 });
 it('free allowances require explicit entitlement; excess without a price is blocked',()=>{
  const p={billingTerms:{kind:'free' as const,fixedFee:'0',minimumSpend:null},unitDefinitions:component({included:'10'})};
  expect(quote(p).purchase.amount).toBe('0');expect(quote(p,{...scenario,imageCount:11}).comparisonIssue).toBe('quota');
  expect(quote({...p,unitDefinitions:component({})}).purchase.amount).toBeNull();
 });
 it('applies explicit overage after allowance',()=>expect(quote({unitDefinitions:component({included:'5',overageRate:'0.2'})}).purchase.amount).toBe('1'));
 it.each([['graduated','250'],['volume','150']] as const)('%s tiers use their declared algorithm', (tierMode,amount)=>{
  const r=quote({unitDefinitions:component({tierMode,tiers:[{upTo:'100',rate:'2'},{upTo:null,rate:'1'}]})},{...scenario,imageCount:150});expect(r.purchase.amount).toBe(amount);expect(r.convertedUnitCost).toBeNull();
 });
 it('tiers apply after free allowance',()=>expect(quote({unitDefinitions:component({included:'50',tiers:[{upTo:'100',rate:'2'},{upTo:null,rate:'1'}]})},{...scenario,imageCount:200}).purchase.amount).toBe('250'));
 it.each([
 [{upTo:'10',rate:'1'},{upTo:'9',rate:'1'}], [{upTo:null,rate:'1'},{upTo:'10',rate:'1'}], [{upTo:null,rate:null}],
 ])('invalid tiers fail closed',tiers=>expect(quote({unitDefinitions:component({tiers})}).purchase.amount).toBeNull());
 it('does not silently ignore an overage rate without its allowance',()=>expect(quote({unitDefinitions:component({value:1,overageRate:'2'})}).purchase.amount).toBeNull());
 it('does not silently choose between conflicting tier and overage rules',()=>expect(quote({unitDefinitions:component({included:'0',overageRate:'2',tiers:[{upTo:null,rate:'1'}]})}).comparisonIssue).toBe('ambiguous-price'));
 it('usage above a final bounded tier is not silently capped',()=>expect(quote({unitDefinitions:component({tiers:[{upTo:'5',rate:'1'}]})}).comparisonIssue).toBe('quota'));
 it('does not rank nonlinear subscriptions/allowances with scalar unit prices',()=>{const a=quote(),b=quote({id:'nonlinear',billingTerms:{kind:'usage',fixedFee:'0',minimumSpend:'20'}});const g=groupComparisons([a,b],'same_unit','unit');expect(g).toHaveLength(2);expect(g.find(group=>group.rows[0].id==='nonlinear')?.comparable).toBe(false);});
 it('handles a non-combinable subscription package with explicit cash overage',()=>{const p={pricingMode:'plan_credit_based' as const,planPrice:99,creditAmount:1200,purchaseTerms:{stackable:false,maxPackages:null,overagePerCredit:'0.1'},unitDefinitions:[{unitType:'per_image' as const,value:20}]};const q=quote(p,{...scenario,imageCount:100});expect(q.purchase.amount).toBe('179');expect(q.purchase.consumedAmount).toBe('179');expect(q.purchase.packageCount).toBe('1');expect(q.purchase.remainingCredits).toBe('0');});
 it('uses only explicitly declared same-pool free credits before buying packages',()=>{const p={pricingMode:'plan_credit_based' as const,planPrice:99,creditAmount:1200,purchaseTerms:{stackable:true,maxPackages:null,freeCredits:'100'},unitDefinitions:[{unitType:'per_image' as const,value:20}]};const q=quote(p,{...scenario,imageCount:100});expect(q.purchase.amount).toBe('198');expect(q.purchase.consumedAmount).toBe('156.75');expect(q.purchase.remainingCredits).toBe('500');});
 it('cash minimums do not manufacture credits and contradictory purchase strategies are blocked',()=>{const p={pricingMode:'plan_credit_based' as const,planPrice:99,creditAmount:1200,purchaseTerms:{stackable:false,maxPackages:null,overagePerCredit:'0.1',minimumSpend:'200'},unitDefinitions:[{unitType:'per_image' as const,value:20}]};const q=quote(p,{...scenario,imageCount:100});expect(q.purchase.amount).toBe('200');expect(q.purchase.remainingCredits).toBe('0');expect(quote({...p,purchaseTerms:{...p.purchaseTerms,stackable:true}},{...scenario,imageCount:100}).purchase.reason).toBe('ambiguous-purchase');});
 it('minimum charge affects purchase independently of usage consumption',()=>{
  const q=quote({billingTerms:{kind:'usage',fixedFee:'0',minimumSpend:'20'}});expect(q.purchase.consumedAmount).toBe('1');expect(q.purchase.amount).toBe('20');
 });
 it('monthly subscription includes fixed fee and overage only in monthly scope',()=>{
  const p={billingTerms:{kind:'monthly' as const,fixedFee:'10',minimumSpend:null},unitDefinitions:component({included:'100',overageRate:'0.5'})};
  expect(quote(p).comparisonIssue).toBe('billing-period');const q=quote(p,{...scenario,imageCount:120,usagePeriod:'month'});expect(q.purchase.amount).toBe('20');expect(q.purchase.consumedAmount).toBe('20');
 });
 it('annual prepayment distinguishes monthly estimate and annual explicitly declared allowance',()=>{
  const p={billingTerms:{kind:'annual' as const,fixedFee:'120',minimumSpend:null},unitDefinitions:component({included:'100',overageRate:'0.5'})};
  const month=quote(p,{...scenario,imageCount:120,usagePeriod:'month'});expect(month.purchase.amount).toBe('130');expect(month.purchase.consumedAmount).toBe('20');
  const year=quote({...p,billingTerms:{...p.billingTerms,allowancePeriod:'year'},unitDefinitions:component({included:'1000',overageRate:'0.5'})},{...scenario,imageCount:1200,usagePeriod:'year'});expect(year.purchase.amount).toBe('220');expect(quote(p,{...scenario,usagePeriod:'year'}).purchase.amount).toBeNull();
 });
 it('fixed fee only is possible with explicit zero-priced overage, not assumed unlimited quota',()=>expect(quote({billingTerms:{kind:'monthly',fixedFee:'10',minimumSpend:null},unitDefinitions:component({included:'0',overageRate:'0'})},{...scenario,usagePeriod:'month'}).purchase.amount).toBe('10'));
 it('does not infer subscription charges on top of a credit package',()=>expect(quote({pricingMode:'plan_credit_based',planPrice:10,creditAmount:100,billingTerms:{kind:'monthly',fixedFee:'10',minimumSpend:null}}).purchase.amount).toBeNull());
 it('preserves exact decimal input independently of legacy numeric approximations',()=>{
  const exact='123456789012345678901234567890';const q=quote({unitDefinitions:component({value:1,exactValue:exact})},{...scenario,imageCount:1});expect(q.purchase.amount).toBe(exact);
 });
 it('explicit video/song duration permits time totals; unrelated units remain separate',()=>{
  const usage={...scenario,musicSecondsPerSong:90,musicMinutes:999};const a=quote({category:'music',unitDefinitions:[{unitType:'per_song',value:3}]},usage),b=quote({id:'b',category:'music',unitDefinitions:[{unitType:'per_minute',value:2}]},usage);expect(a.purchase.amount).toBe('6');expect(b.purchase.amount).toBe('6');expect(groupComparisons([a,b],'same_usage','scenario')).toHaveLength(1);
  const noDuration={...usage,musicSecondsPerSong:0};expect(groupComparisons([quote({category:'music',unitDefinitions:[{unitType:'per_song',value:3}]},noDuration),quote({id:'b',category:'music',unitDefinitions:[{unitType:'per_minute',value:2}]},noDuration)],'same_usage','scenario')).toHaveLength(2);
 });
 it('different model parameter variants remain separate even at the same quantity',()=>expect(groupComparisons([quote({parameters:'1024'}),quote({id:'b',parameters:'2048'})],'same_usage','scenario')).toHaveLength(2));
});
describe('P3 manual exchange management',()=>{
 it('shows old scientific-notation prices as editable decimals',()=>expect(legacyDecimalText(1e-7)).toBe('0.0000001'));
 it('rebasing preserves exact conversion, including nonterminating rates',()=>{
  const s=createManualSampleState('a','b'),rebased=rebaseFx(s,'USD');expect(rebased.rateMeta?.baseCurrency).toBe('USD');expect(rebased.rates.USD).toBe(1);
  const before=calculateManualComparison(s.items[1],scenario,s.rates,'CNY');const after=calculateManualComparison(s.items[1],scenario,rebased.rates,'CNY',undefined,undefined,rebased.ratesExact,rebased.rateRatios);expect(after.purchase.amount).toBe(before.purchase.amount);
 });
 it('rebasing back to CNY preserves the original ratios',()=>{const s=createManualSampleState('a','b');const back=rebaseFx(rebaseFx(s,'USD'),'CNY');expect(fxValue(back,'USD').text()).toBe('7.2');});
 it('metadata and exact rates roundtrip through JSON',()=>{const s={...createManualSampleState('a','b'),...rebaseFx(createManualSampleState('a','b'),'USD')};const parsed=previewCalculatorImport(exportCalculator('quick',s),'quick');expect(parsed.data.rateMeta?.source).toBe('Manual entry');expect(parsed.data.rateRatios?.CNY).toEqual(s.rateRatios?.CNY);});
 it('rejects invalid base rates instead of inventing a fallback',()=>expect(()=>rebaseFx({rates:{CNY:1,USD:0}},'USD')).toThrow());
});
describe('P4 versioned imports and safe transfer',()=>{
 const quick=()=>({...createManualSampleState('a','b'),scenario});
 it('exports versioned v2 and accepts old version 1',()=>{const env=exportCalculator('quick',quick());expect(env.version).toBe(2);expect(previewCalculatorImport(env,'quick').counts.rules).toBe(2);expect(previewCalculatorImport(quick(),'quick').fileVersion).toBe(1);});
 it.each([undefined,0,3,999])('rejects unsupported legacy version %s',version=>expect(()=>previewCalculatorImport({...quick(),version},'quick')).toThrow());
 it('rejects unknown envelope versions and mismatched modes',()=>{expect(()=>previewCalculatorImport({...exportCalculator('quick',quick()),version:3},'quick')).toThrow();expect(()=>previewCalculatorImport(exportCalculator('quick',quick()),'detailed')).toThrow();});
 it('rejects duplicate IDs, orphaned relations and missing required data',()=>{
  const s=quick();s.items[1].id=s.items[0].id;expect(()=>previewCalculatorImport(s,'quick')).toThrow();
  const d=createDetailedSampleState();d.rules[0].platformId='missing';expect(()=>previewCalculatorImport(d,'detailed')).toThrow();expect(()=>previewCalculatorImport({version:1,items:[]},'quick')).toThrow();
 });
 it('does not coerce malformed prices to free values',()=>{const s=quick();(s.items[0] as unknown as {planPrice:string}).planPrice='';expect(()=>previewCalculatorImport(s,'quick')).toThrow();});
 it('can import missing prices as incomplete records, with no free quote',()=>{const s=quick();s.items[1].unitDefinitions[0].value=null;const p=previewCalculatorImport(s,'quick');expect(calculateManualComparison(p.data.items[1],scenario,p.data.rates,'CNY').purchase.amount).toBeNull();});
 it('rejects contradictory numeric and exact FX values',()=>{const s={...quick(),ratesExact:{USD:'8'}};expect(()=>previewCalculatorImport(s,'quick')).toThrow();});
 it('strictly rejects bad timestamps and unsafe rate metadata',()=>{const s={...quick(),rateMeta:{mode:'manual' as const,source:'manual',baseCurrency:'CNY',updatedAt:'not-a-date'}};expect(()=>previewCalculatorImport(s,'quick')).toThrow();});
 it('transfers prices, rules, usage and unknown assumptions to an empty archive',()=>{
  const q=quick();delete q.items[0].purchaseTerms;let n=0;const d=quickToDetailed(q,createEmptyDetailedState(),()=>String(++n));expect(d.platforms).toHaveLength(2);expect(d.models).toHaveLength(2);expect(d.rules).toHaveLength(2);expect(d.scenario.imageCount).toBe(10);expect(d.plans[0].purchaseTerms).toBeUndefined();expect(previewCalculatorImport(exportCalculator('detailed',d),'detailed').data.rules).toHaveLength(2);
 });
 it('appends without merging same-name identities or replacing existing records',()=>{
  const existing=createDetailedSampleState(),before=structuredClone(existing);let n=0;const d=quickToDetailed(quick(),existing,()=>String(++n));expect(d.platforms.slice(0,before.platforms.length)).toEqual(before.platforms);expect(d.models).toHaveLength(before.models.length+2);expect(existing).toEqual(before);expect(d.scenario).toEqual(before.scenario);
 });
 it('merges a new currency across different bases by an explicit common bridge',()=>{
  const q:ManualCompareState={...quick(),rates:{CNY:1,USD:7.2,CAD:5}},existing={...createDetailedSampleState(),...rebaseFx(createDetailedSampleState(),'USD')};let n=0;const d=quickToDetailed(q,existing,()=>String(++n));expect(fxValue(d,'CAD').div(fxValue(d,'CNY')).text()).toBe('5');expect(d.rateMeta?.source).toContain('imported CAD');
 });
 it('does not mutate the provided object while preparing a preview',()=>{const q=quick(),before=structuredClone(q);previewCalculatorImport(q,'quick');expect(q).toEqual(before);});
});
