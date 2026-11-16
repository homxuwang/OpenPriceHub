import { describe, expect, it } from 'vitest';
import { calculateManualComparison, DEFAULT_MANUAL_STATE, normalizeManualState, type ManualPriceItem, type ManualCategory } from '../src/shared/manualCompare';
import { buildDetailedComparisonRows, createDetailedSampleState, normalizeDetailedState } from '../src/shared/detailedCompare';
import { groupComparisons } from '../src/shared/manualComparisonGroups';
const scenario = { ...DEFAULT_MANUAL_STATE.scenario, imageCount: 100, ttsMinutes: 2, musicMinutes: 3 };
const terms = { stackable: true, maxPackages: null };
function fixture(): ManualPriceItem { return { id: 'sim', platformName: 'SIM Provider', modelName: 'SIM Model', category: 'image', parameters: 'standard', pricingMode: 'plan_credit_based', planName: 'SIM 99 / 1200', planPrice: 99, creditAmount: 1200, currency: 'CNY', unitDefinitions: [{ unitType: 'per_image', value: 20 }], purchaseTerms: { ...terms }, purchaseCycle: 'one_time', creditPool: 'sim-pool' }; }
const calculate = (patch: Partial<ManualPriceItem> = {}, usage = scenario) => calculateManualComparison({ ...fixture(), ...patch }, usage, { CNY: 1, USD: 7.2 }, 'CNY');
describe('calculator P1 whole-package purchase', () => {
  it('99/1200, 20 credits/image, 100 images gives exactly 2000 credits, 2 packages, 198 paid, 400 left', () => {
    const r = calculate();
    expect(r.convertedUnitCost).toBe(1.65); expect(r.scenarioCost).toBe(165);
    expect(r.purchase).toMatchObject({ requiredCredits: '2000', packageCount: '2', sourceAmount: '198', amount: '198', remainingCredits: '400', consumedAmount: '165', reason: null });
  });
  it('cash ranking differs from consumed-cost ranking for two valid plans', () => {
    const a = calculate(), b = calculate({ id: 'other', planPrice: 39, creditAmount: 400 });
    expect(groupComparisons([a, b], 'same_unit', 'scenario')[0].rows[0].id).toBe('sim');
    expect(groupComparisons([a, b], 'same_unit', 'purchase')[0].rows.map(x => x.purchase.amount)).toEqual(['195', '198']);
    expect(b.purchase.remainingCredits).toBe('0');
  });
  it.each([[60, '1', '99', '0'], [61, '2', '198', '1180'], [0, '0', '0', '0']])('rounds whole packages for %s images', (images, packages, amount, remaining) => {
    const r = calculate({}, { ...scenario, imageCount: images });
    expect(r.purchase.packageCount).toBe(packages); expect(r.purchase.amount).toBe(amount); expect(r.purchase.remainingCredits).toBe(remaining);
  });
  it('does not infer combinability for legacy data', () => {
    const r = calculate({ purchaseTerms: undefined });
    expect(r.purchase.reason).toBe('terms-unconfirmed'); expect(r.purchase.amount).toBeNull(); expect(r.purchase.remainingCredits).toBeNull(); expect(r.scenarioCost).toBe(165);
  });
  it('blocks non-combinable quota shortages, but quotes one sufficient package', () => {
    expect(calculate({ purchaseTerms: { stackable: false, maxPackages: null } }).purchase.reason).toBe('insufficient-quota');
    expect(calculate({ purchaseTerms: { stackable: false, maxPackages: null } }, { ...scenario, imageCount: 50 }).purchase.amount).toBe('99');
  });
  it('respects package-count limits rather than quoting an impossible purchase', () => {
    const blocked = calculate({ purchaseTerms: { stackable: true, maxPackages: 1 } });
    expect(blocked.comparisonKey).toBeNull(); expect(blocked.purchase.reason).toBe('package-limit'); expect(blocked.purchase.amount).toBeNull(); expect(blocked.purchase.packageCount).toBeNull();
    expect(calculate({ purchaseTerms: { stackable: true, maxPackages: 2 } }).purchase.amount).toBe('198');
  });
  it.each([0, -1, 1.5, Infinity])('blocks invalid package limit %s', maxPackages => {
    expect(calculate({ purchaseTerms: { stackable: true, maxPackages } }).purchase.reason).toBe('invalid-package-limit');
  });
  it('does not buy an extra package due to binary floating point 0.1 * 3', () => {
    const r = calculate({ planPrice: 10, creditAmount: 0.3, unitDefinitions: [{ unitType: 'per_image', value: 0.1 }] }, { ...scenario, imageCount: 3 });
    expect(r.purchase.requiredCredits).toBe('0.3'); expect(r.purchase.packageCount).toBe('1'); expect(r.purchase.amount).toBe('10'); expect(r.purchase.remainingCredits).toBe('0');
  });
  it('handles small decimal rates from legacy numeric forms without exponent arithmetic', () => {
    const r = calculate({ planPrice: 1e-7, creditAmount: 0.3, unitDefinitions: [{ unitType: 'per_image', value: 0.1 }] }, { ...scenario, imageCount: 3 });
    expect(r.purchase.amount).toBe('0.0000001'); expect(r.unitCosts[0].convertedExact).toBe('0.000000033333');
  });
  it('converts purchase and consumed costs independently, retaining source currency amount', () => {
    const r = calculate({ currency: 'USD' });
    expect(r.purchase.amount).toBe('1425.6'); expect(r.purchase.sourceAmount).toBe('198'); expect(r.purchase.consumedAmount).toBe('1188'); expect(r.purchase.requiredCredits).toBe('2000');
    const changed = calculateManualComparison({ ...fixture(), currency: 'USD' }, scenario, { CNY: 1, USD: 8 }, 'CNY');
    expect(changed.purchase.amount).toBe('1584'); expect(changed.purchase.consumedAmount).toBe('1320');
  });
  it.each([{ planPrice: 0 }, { creditAmount: 0 }, { unitDefinitions: [{ unitType: 'per_image' as const, value: null }] }])('missing prices do not become free purchases', patch => {
    expect(calculate(patch).purchase.amount).toBeNull();
  });
  it.each(['image', 'video', 'tts', 'music', 'text'] as ManualCategory[])('supports a real-shaped simulated %s workload', category => {
    const units: ManualPriceItem['unitDefinitions'] = category === 'image' ? [{ unitType: 'per_image', value: 20 }] : category === 'text' ? [{ unitType: 'per_1k_input_tokens', value: 10 }, { unitType: 'per_1k_output_tokens', value: 20 }] : [{ unitType: category === 'video' ? 'per_second' : 'per_minute', value: 20 }];
    const r = calculate({ category, unitDefinitions: units });
    expect(r.purchase.reason).toBeNull(); expect(r.purchase.amount).not.toBeNull(); expect(r.purchase.requiredCredits).not.toBeNull();
  });
  it('adds credit usage from input/output workloads instead of assuming either rate is the total', () => {
    const r = calculate({ category: 'text', planPrice: 10, creditAmount: 25, unitDefinitions: [{ unitType: 'per_1k_input_tokens', value: 10 }, { unitType: 'per_1k_output_tokens', value: 20 }] }, { ...scenario, textInputTokens: 2000, textOutputTokens: 500 });
    expect(r.purchase.requiredCredits).toBe('30'); expect(r.purchase.packageCount).toBe('2'); expect(r.purchase.amount).toBe('20'); expect(r.purchase.remainingCredits).toBe('20');
  });
  it('converts seconds/minutes exactly before the package ceiling', () => {
    const r = calculate({ category: 'video', planPrice: 5, creditAmount: 0.1, unitDefinitions: [{ unitType: 'per_minute', value: 6 }] }, { ...scenario, videoSeconds: 1 });
    expect(r.purchase.requiredCredits).toBe('0.1'); expect(r.purchase.packageCount).toBe('1'); expect(r.purchase.amount).toBe('5');
  });
  it('direct usage has the same purchase and consumed cost but no imaginary package/credits', () => {
    const r = calculate({ pricingMode: 'direct_price_based', unitDefinitions: [{ unitType: 'per_image', value: 0.1 }] });
    expect(r.purchase.amount).toBe('10'); expect(r.purchase.consumedAmount).toBe('10'); expect(r.purchase.packageCount).toBeNull(); expect(r.purchase.requiredCredits).toBeNull();
  });
  it('keeps annual, monthly and unconfirmed commitments out of a mixed cash ranking', () => {
    const a = calculate({ purchaseCycle: 'monthly' }), b = calculate({ id: 'b', purchaseCycle: 'yearly' }), unknown = calculate({ id: 'unknown', purchaseCycle: undefined });
    expect(groupComparisons([a, b, unknown], 'same_usage', 'purchase')).toHaveLength(3);
    expect(unknown.purchase.amount).toBe('198'); expect(unknown.purchaseComparisonKey).toBeNull();
  });
  it('JSON roundtrips terms and pool identity while preserving unknown legacy terms', () => {
    const state = { ...DEFAULT_MANUAL_STATE, items: [fixture()] };
    expect(normalizeManualState(JSON.parse(JSON.stringify(state)))?.items[0].purchaseTerms).toEqual(terms);
    delete state.items[0].purchaseTerms;
    expect(normalizeManualState(JSON.parse(JSON.stringify(state)))?.items[0].purchaseTerms).toBeUndefined();
  });
});
describe('detailed purchase eligibility', () => {
  const rows = (s = createDetailedSampleState()) => buildDetailedComparisonRows(s, { platformIds: s.platforms.map(p => p.id), modelIds: ['model-image'], scenario, targetCurrency: 'CNY' });
  it('calculates each eligible plan independently, never combines their credit balances', () => {
    const r = rows().filter(r => r.planId);
    expect(r.find(r => r.planId === 'plan-pro')?.purchase).toMatchObject({ amount: '198', requiredCredits: '2000', remainingCredits: '400' });
    expect(r.find(r => r.planId === 'plan-demo')?.purchase).toMatchObject({ amount: '195', remainingCredits: '0' });
  });
  it('blocks a wrong credit pool and unconfirmed plan mapping', () => {
    const s = createDetailedSampleState(); s.rules[0].creditPool = 'other-pool';
    expect(rows(s).find(r => r.planId === 'plan-pro')?.purchase.reason).toBe('credit-pool');
    s.rules[0].creditPool = 'SIM image credits'; delete s.rules[0].planIds;
    expect(rows(s).find(r => r.planId === 'plan-pro')?.purchase.reason).toBe('plan-unconfirmed');
  });
  it('roundtrips new detailed fields and rejects a plan eligibility link to the wrong platform', () => {
    const s = createDetailedSampleState(); expect(normalizeDetailedState(JSON.parse(JSON.stringify(s)))?.plans[0].purchaseTerms).toEqual(terms);
    s.rules[0].planIds = ['nonexistent-plan']; expect(normalizeDetailedState(s)).toBeNull();
  });
});
