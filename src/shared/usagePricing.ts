import { D, zero } from './discovery/decimal';
import { decimalNumber } from './creditPurchase';
import type { BillingTerms, ManualUnitDefinition } from './manualUnits';
export class PricingError extends Error {}
export function unitRate(unit: ManualUnitDefinition): D | null {
  try {if (unit.exactValue !== undefined) return unit.exactValue === null ? null : D.parse(unit.exactValue);return unit.value === null ? null : decimalNumber(unit.value);}
  catch {throw new PricingError('invalid-price');}
}
export const unitSize = (u: string) => D.parse(u.startsWith('per_1m_') ? '1000000' : u.startsWith('per_1k_') ? '1000' : '1');
export function componentCharge(unit: ManualUnitDefinition, quantity: D, terms?: BillingTerms): D {
  if(unit.overageRate!=null&&unit.included===undefined)throw new PricingError('allowance-missing');
  if(unit.overageRate!=null&&unit.tiers?.length)throw new PricingError('ambiguous-price');
  if (terms && terms.kind !== 'usage' && unit.included === undefined) throw new PricingError('allowance-missing');
  const included = unit.included === undefined ? zero() : D.parse(unit.included);
  let chargeable = quantity.cmp(included) > 0 ? quantity.sub(included) : zero();
  const size = unitSize(unit.unitType);
  if (unit.tiers?.length) {
    if (unit.tiers.length > 100) throw new PricingError('tier-rule');
    let previous = zero(), result = zero(), covered = false;
    for (let i = 0; i < unit.tiers.length; i++) {
      const tier = unit.tiers[i], end = tier.upTo === null ? null : D.parse(tier.upTo);
      if ((end && end.cmp(previous) <= 0) || (!end && i !== unit.tiers.length - 1) || tier.rate === null) throw new PricingError('tier-rule');
      const rate = D.parse(tier.rate);
      if (!covered) {
        const within = end === null || chargeable.cmp(end) <= 0;
        if (unit.tierMode === 'volume') { if (within) { result = chargeable.mul(rate).div(size); covered = true; } }
        else {
          const sliceEnd = within ? chargeable : end!;
          if (sliceEnd.cmp(previous) > 0) result = result.add(sliceEnd.sub(previous).mul(rate).div(size));
          if (within) covered = true;
        }
      }
      if (end) previous = end;
    }
    if (!covered) throw new PricingError('quota');
    return result;
  }
  if (chargeable.cmp(zero()) === 0 && unit.included !== undefined) return zero();
  const rate = unit.included !== undefined ? unit.overageRate == null ? null : D.parse(unit.overageRate) : unitRate(unit);
  if (rate === null) throw new PricingError(unit.included !== undefined ? 'quota' : 'missing-price');
  return chargeable.mul(rate).div(size);
}
