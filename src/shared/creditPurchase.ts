import { D, zero } from './discovery/decimal';
export interface CreditPurchaseTerms {
  /** True explicitly confirms combining packages in the current usage window without other restrictions. */
  stackable: boolean | null;
  maxPackages: number | null;
  freeCredits?: string | null;
  overagePerCredit?: string | null;
  minimumSpend?: string | null;
}
export type PurchaseCycle = 'monthly' | 'yearly' | 'one_time' | 'custom';
export interface ExactValue { numerator: string; denominator: string }
export interface PurchaseResult {
  kind: 'credits' | 'usage'; reason: string | null;
  requiredCredits: string | null; packageCount: string | null; remainingCredits: string | null;
  sourceAmount: string | null; amount: string | null;
  consumedSourceAmount: string | null; consumedAmount: string | null;
  amountExact: ExactValue | null; consumedExact: ExactValue | null;
  pool: string; cycle: PurchaseCycle | null;
}
export const exactValue = (d: D): ExactValue => ({ numerator: String(d.n), denominator: String(d.d) });
export const fromExact = (v: ExactValue) => new D(BigInt(v.numerator), BigInt(v.denominator));
// Legacy forms store JSON numbers. Expand their decimal representation without binary arithmetic.
export function decimalNumber(value: number): D {
  if (!Number.isFinite(value) || value < 0) throw new Error('Invalid number');
  let text = String(value);
  if (/e/i.test(text)) {
    const [coefficient, exponent] = text.toLowerCase().split('e');
    const [whole, fraction = ''] = coefficient.split('.');
    const digits = whole + fraction, point = whole.length + Number(exponent);
    text = point <= 0 ? '0.' + '0'.repeat(-point) + digits : point >= digits.length ? digits + '0'.repeat(point - digits.length) : digits.slice(0, point) + '.' + digits.slice(point);
  }
  return D.parse(text);
}
export function emptyPurchase(kind: 'credits' | 'usage', reason: string | null, pool = '', cycle: PurchaseCycle | null = null): PurchaseResult {
  return { kind, reason, pool, cycle, requiredCredits: null, packageCount: null, remainingCredits: null, sourceAmount: null, amount: null, consumedSourceAmount: null, consumedAmount: null, amountExact: null, consumedExact: null };
}
export function calculateCreditPurchase(price: D, allowance: D, needed: D, conversion: D, terms: CreditPurchaseTerms | undefined, pool: string, cycle: PurchaseCycle | null, consumed: D): PurchaseResult {
  const base = { ...emptyPurchase('credits', null, pool, cycle), requiredCredits: needed.text(), consumedSourceAmount: consumed.text(), consumedAmount: consumed.mul(conversion).text(), consumedExact: exactValue(consumed.mul(conversion)) };
  if (allowance.cmp(zero()) <= 0 || price.cmp(zero()) <= 0) return { ...base, reason: 'missing-price' };
  if (!terms || typeof terms.stackable !== 'boolean') return { ...base, reason: 'terms-unconfirmed' };
  if (terms.maxPackages !== null && (!Number.isSafeInteger(terms.maxPackages) || terms.maxPackages < 1)) return { ...base, reason: 'invalid-package-limit' };
  try {
    const free=terms.freeCredits==null?zero():D.parse(terms.freeCredits);
    const paidNeeded=needed.cmp(free)>0?needed.sub(free):zero();
    const minimum=terms.minimumSpend==null?zero():D.parse(terms.minimumSpend);
    const overage=terms.overagePerCredit==null?null:D.parse(terms.overagePerCredit);
    if(overage&&terms.stackable)return {...base,reason:'ambiguous-purchase'};
    let count=paidNeeded.div(allowance).ceil(),consumed=paidNeeded.mul(price).div(allowance),amount=price.mul(count),remaining=count.mul(allowance).add(free).sub(needed);
    if(!terms.stackable&&count.cmp(D.parse('1'))>0){
      if(!overage)return {...base,reason:'insufficient-quota'};
      count=D.parse('1');const premium=paidNeeded.sub(allowance).mul(overage);amount=price.add(premium);consumed=amount;remaining=zero();
    }
    if(terms.maxPackages!==null&&count.cmp(decimalNumber(terms.maxPackages))>0)return {...base,reason:'package-limit'};
    if(count.n>0n&&amount.cmp(minimum)<0)amount=minimum;
    const converted=amount.mul(conversion),used=consumed.mul(conversion);
    return {...base,reason:null,packageCount:count.text(),remainingCredits:remaining.text(),sourceAmount:amount.text(),amount:converted.text(),amountExact:exactValue(converted),consumedSourceAmount:consumed.text(),consumedAmount:used.text(),consumedExact:exactValue(used)};
  } catch {return {...base,reason:'invalid-price'};}

}
/** Display legacy numeric inputs in decimal notation without changing the stored contract. */
export function legacyDecimalText(value:number):string {try{return decimalNumber(value).text();}catch{return String(value);}}
