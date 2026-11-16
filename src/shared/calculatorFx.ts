import { D } from './discovery/decimal';
import { decimalNumber,exactValue,fromExact,type ExactValue } from './creditPurchase';
export interface RateMetadata { mode: 'manual'; baseCurrency: string; source: string; updatedAt: string }
export interface FxState { rates: Record<string,number>; ratesExact?: Record<string,string>; rateRatios?: Record<string,ExactValue>; rateMeta?: RateMetadata }
export function fxValue(state: FxState, code: string): D {
  if(state.rateRatios?.[code]) {const result=fromExact(state.rateRatios[code]);if(result.n<=0n)throw Error('Invalid rate');return result;}
  const v = state.ratesExact?.[code] !== undefined ? D.parse(state.ratesExact[code]) : decimalNumber(state.rates[code]);
  if (v.n <= 0n) throw new Error('Invalid exchange rate'); return v;
}
export function rebaseFx(state: FxState, base: string): FxState {
  const divisor = fxValue(state, base), rates: Record<string,number> = {}, ratesExact: Record<string,string> = {},rateRatios:Record<string,ExactValue>={};
  for (const code of Object.keys(state.rates)) { const ratio=fxValue(state,code).div(divisor);rateRatios[code]=exactValue(ratio);const result=ratio.text(); if (D.parse(result).n <= 0n) throw new Error('Rate below supported precision'); ratesExact[code] = result; rates[code] = Number(result); }
  rates[base] = 1; ratesExact[base] = '1';
  return { rates, ratesExact,rateRatios, rateMeta: { mode:'manual',baseCurrency:base,source:state.rateMeta?.source ?? 'Manual entry',updatedAt:new Date().toISOString() } };
}
