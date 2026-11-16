import {DEFAULT_MANUAL_STATE,type ManualCompareState,type ManualPriceItem} from './manualCompare';
import {createEmptyDetailedState} from './detailedCompare';
import {quickToDetailed} from './calculatorIo';
/** All identities, rates and FX values below are fictional demonstration data. */
export function completeQuickSample():ManualCompareState {
 const base=(id:string,patch:Partial<ManualPriceItem>):ManualPriceItem=>({id,platformName:'SIM '+id,modelName:'SIM Image',category:'image',pricingMode:'direct_price_based',planName:'',planPrice:0,creditAmount:0,currency:'CNY',parameters:'1024x1024; standard',comparisonScenario:'SIM text to image',unitDefinitions:[],...patch});
 return {...structuredClone(DEFAULT_MANUAL_STATE),rateMeta:{mode:'manual',baseCurrency:'CNY',source:'SIM manual rates / 模拟手动汇率',updatedAt:''},scenario:{...DEFAULT_MANUAL_STATE.scenario,usagePeriod:'month',imageCount:150,videoCount:10,videoSecondsPerVideo:5,videoSeconds:50,ttsCharacters:10000,ttsMinutes:10,musicSongs:10,musicSecondsPerSong:90,musicMinutes:15,musicGenerations:10,textInputTokens:1000000,textOutputTokens:500000,textCachedTokens:250000,creditCount:1000},items:[
 base('image-tiers',{unitDefinitions:[{unitType:'per_image',value:null,tiers:[{upTo:'100',rate:'0.1'},{upTo:null,rate:'0.05'}],tierMode:'graduated'}]}),
 base('image-credits',{pricingMode:'plan_credit_based',planName:'SIM 99 / 1200',planPrice:99,creditAmount:1200,creditPool:'SIM image pool',purchaseCycle:'one_time',purchaseTerms:{stackable:true,maxPackages:null},unitDefinitions:[{unitType:'per_image',value:20}]}),
 base('video-seconds',{category:'video',modelName:'SIM Video',parameters:'720p; standard',comparisonScenario:'SIM text to video',unitDefinitions:[{unitType:'per_second',value:0.2}]}),
 base('video-count',{category:'video',modelName:'SIM Video',parameters:'720p; standard',comparisonScenario:'SIM text to video',unitDefinitions:[{unitType:'per_video',value:1}]}),
 base('tts-characters',{category:'tts',modelName:'SIM TTS',parameters:'standard voice',comparisonScenario:'SIM TTS',unitDefinitions:[{unitType:'per_character',value:0.01,included:'2000',overageRate:'0.01'}],billingTerms:{kind:'monthly',fixedFee:'10',minimumSpend:null}}),
 base('music-songs',{category:'music',modelName:'SIM Music',parameters:'90 seconds/song',comparisonScenario:'SIM music',unitDefinitions:[{unitType:'per_song',value:2}]}),
 base('api-tokens',{category:'text',modelName:'SIM LLM',parameters:'SIM v1',comparisonScenario:'SIM text',currency:'USD',unitDefinitions:[{unitType:'per_1m_input_tokens',value:3},{unitType:'per_1m_output_tokens',value:9},{unitType:'per_1m_cached_tokens',value:0.5}]}),
 base('image-minimum',{unitDefinitions:[{unitType:'per_image',value:0.02}],billingTerms:{kind:'usage',fixedFee:'0',minimumSpend:'20'}}),
 base('image-free',{unitDefinitions:[{unitType:'per_image',value:null,included:'10',overageRate:null}],billingTerms:{kind:'free',fixedFee:'0',minimumSpend:null}}),
 base('image-annual',{unitDefinitions:[{unitType:'per_image',value:null,included:'200',overageRate:'0.2'}],billingTerms:{kind:'annual',fixedFee:'120',minimumSpend:null}}),
 ]};
}
export function completeDetailedSample(){return quickToDetailed(completeQuickSample(),createEmptyDetailedState());}
