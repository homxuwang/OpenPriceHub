import { componentCharge, unitRate, unitSize, PricingError } from './usagePricing';
import { tokenFamily } from './manualUnits';
import type { FxState } from './calculatorFx';
import { D, zero } from './discovery/decimal';
import { calculateCreditPurchase, decimalNumber, emptyPurchase, exactValue, fromExact, type CreditPurchaseTerms, type PurchaseCycle, type PurchaseResult, type ExactValue } from './creditPurchase';
import type { Scenario } from './types';
import type { ManualUnitDefinition as UnitDefinition, BillingTerms } from './manualUnits';

export type ManualCategory = 'text' | 'image' | 'video' | 'audio' | 'tts' | 'music';
export type ManualPricingMode = 'plan_credit_based' | 'direct_price_based';

export interface ManualPriceItem {
  id: string;
  platformName: string;
  modelName: string;
  category: ManualCategory;
  pricingMode: ManualPricingMode;
  comparisonScenario?: string;
  parameters?: string;
  selectedUnit?: UnitDefinition['unitType'];
  purchaseTerms?: CreditPurchaseTerms;
  purchaseCycle?: PurchaseCycle;
  creditPool?: string;
  planName: string;
  planPrice: number;
  creditAmount: number;
  currency: string;
  unitDefinitions: UnitDefinition[];
  billingTerms?: BillingTerms;
  planPriceExact?: string; creditAmountExact?: string;
}

export interface ManualCompareState extends FxState {
  version: 1;
  items: ManualPriceItem[];
  scenario: Scenario;
  targetCurrency: string;
  rates: Record<string, number>;
}

export interface ComparisonMetadata {
  comparisonKey: string | null;
  unitComparisonKey: string | null;
  comparisonIssue: string | null;
  comparisonScenario: string;
  parameters: string;
  purchaseComparisonKey: string | null;
  purchase: PurchaseResult;
  unitCostExact?: ExactValue | null;
  creditUnitCostExact?: string | null;
}
export interface ManualComparisonResult extends ComparisonMetadata {
  id: string;
  platformName: string;
  modelName: string;
  category: ManualCategory;
  pricingMode: ManualPricingMode;
  planName: string;
  sourceCurrency: string;
  targetCurrency: string;
  creditUnitCost: number | null;
  originalUnitCost: number | null;
  convertedUnitCost: number | null;
  scenarioCost: number | null;
  unitDefinitions: UnitDefinition[];
  unitCosts: Array<{
    unitType: UnitDefinition['unitType'];
    nonlinear?:boolean; originalExact?: string; convertedExact?: string; originalRatio?: ExactValue; convertedRatio?: ExactValue;
    usageAmount: number;
    originalUnitCost: number;
    convertedUnitCost: number;
  }>;
}

export const MANUAL_CURRENCIES = ['CNY', 'USD', 'HKD', 'EUR', 'GBP', 'JPY'] as const;

export const DEFAULT_MANUAL_STATE: ManualCompareState = {
  version: 1,
  items: [],
  scenario: {
    textInputTokens: 1000,
    textOutputTokens: 500,
    imageCount: 1,
    videoSeconds: 5,
    audioMinutes: 1,
    ttsMinutes: 1,
    musicMinutes: 1,
  },
  targetCurrency: 'CNY',
  rates: {
    CNY: 1,
    USD: 7.2,
    HKD: 0.92,
    EUR: 7.8,
    GBP: 9.2,
    JPY: 0.048,
  },
};

export function unitTypesForCategory(category: ManualCategory): UnitDefinition['unitType'][] {
  switch (category) {
    case 'text':
      return ['per_1k_input_tokens','per_1m_input_tokens','per_1k_output_tokens','per_1m_output_tokens','per_1k_cached_tokens','per_1m_cached_tokens','per_credit'];
    case 'image':
      return ['per_image','per_credit'];
    case 'video': return ['per_second','per_minute','per_video','per_credit'];
    case 'tts': return ['per_minute','per_character','per_second','per_credit'];
    case 'music': return ['per_minute','per_song','per_generation','per_second','per_credit'];
    case 'audio': return ['per_second','per_minute','per_credit'];
  }
}

export function createManualItem(
  id: string,
  index: number,
  category: ManualCategory = 'image',
): ManualPriceItem {
  return {
    id,
    platformName: `Platform ${index}`,
    modelName: `Model ${index}`,
    category,
    pricingMode: 'plan_credit_based',
    planName: '',
    planPrice: 0,
    creditAmount: 0,
    currency: 'CNY',
    unitDefinitions: unitTypesForCategory(category).map((unitType) => ({ unitType, value: null })),
  };
}

export function createManualSampleState(firstId: string, secondId: string): ManualCompareState {
  return {
    ...DEFAULT_MANUAL_STATE,
    scenario: { ...DEFAULT_MANUAL_STATE.scenario },
    rates: { ...DEFAULT_MANUAL_STATE.rates },
    items: [
      {
        id: firstId,
        platformName: 'Demo SaaS',
        modelName: 'SIM Image Model', parameters: '1024x1024; standard',
        category: 'image',
        pricingMode: 'plan_credit_based',
        purchaseTerms: { stackable: true, maxPackages: null }, purchaseCycle: 'one_time', creditPool: 'SIM image credits',
        planName: 'Pro 400',
        planPrice: 39,
        creditAmount: 400,
        currency: 'CNY',
        unitDefinitions: [{ unitType: 'per_image', value: 20 }],
      },
      {
        id: secondId,
        platformName: 'Direct API',
        modelName: 'SIM Image Model', parameters: '1024x1024; standard',
        category: 'image',
        pricingMode: 'direct_price_based',
        planName: '',
        planPrice: 0,
        creditAmount: 0,
        currency: 'USD',
        unitDefinitions: [{ unitType: 'per_image', value: 0.3 }],
      },
    ],
  };
}

export function normalizeManualState(value: unknown): ManualCompareState | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<ManualCompareState>;
  if (!Array.isArray(candidate.items) || !candidate.scenario || !candidate.rates) return null;
  if (typeof candidate.targetCurrency !== 'string') return null;

  const items = candidate.items.filter(isManualItem);
  if (items.length !== candidate.items.length) return null;

  const rates = Object.fromEntries(Object.entries(candidate.rates)
    .filter((entry): entry is [string, number] =>
      typeof entry[1] === 'number' && Number.isFinite(entry[1]) && entry[1] > 0));
  if (!rates[candidate.targetCurrency]) return null;

  return {
    version: 1,
    items,
    scenario: {
      textInputTokens: finiteNonNegative(candidate.scenario.textInputTokens),
      textOutputTokens: finiteNonNegative(candidate.scenario.textOutputTokens),
      imageCount: finiteNonNegative(candidate.scenario.imageCount),
      videoSeconds: finiteNonNegative(candidate.scenario.videoSeconds),
      audioMinutes: finiteNonNegative(candidate.scenario.audioMinutes),
      ttsMinutes: finiteNonNegative(candidate.scenario.ttsMinutes ?? 1),
      musicMinutes: finiteNonNegative(candidate.scenario.musicMinutes ?? 1),
      textCachedTokens: finiteNonNegative(candidate.scenario.textCachedTokens), ttsCharacters: finiteNonNegative(candidate.scenario.ttsCharacters),
      musicSongs: finiteNonNegative(candidate.scenario.musicSongs), musicGenerations: finiteNonNegative(candidate.scenario.musicGenerations), musicSecondsPerSong: finiteNonNegative(candidate.scenario.musicSecondsPerSong),
      videoCount: finiteNonNegative(candidate.scenario.videoCount ?? 1), videoSecondsPerVideo: finiteNonNegative(candidate.scenario.videoSecondsPerVideo), creditCount: finiteNonNegative(candidate.scenario.creditCount),
      usagePeriod: candidate.scenario.usagePeriod ?? 'request',
    },
    targetCurrency: candidate.targetCurrency,
    rates, ratesExact: candidate.ratesExact,rateRatios:candidate.rateRatios, rateMeta: candidate.rateMeta,
  };
}

export function calculateManualComparison(
  item: ManualPriceItem,
  scenario: Scenario,
  rates: Record<string, number>,
  targetCurrency: string,
  modelIdentity?: string,
  eligibilityIssue?: string,
  ratesExact?: Record<string,string>,
  rateRatios?:Record<string,ExactValue>,
): ManualComparisonResult {
  const fromRate = rates[item.currency];
  const toRate = rates[targetCurrency];
  let creditUnitCost: D | null = null;
  try {
    if (item.pricingMode === 'plan_credit_based' && item.planPrice > 0 && item.creditAmount > 0) creditUnitCost = (item.planPriceExact !== undefined ? D.parse(item.planPriceExact) : decimalNumber(item.planPrice)).div(item.creditAmountExact !== undefined ? D.parse(item.creditAmountExact) : decimalNumber(item.creditAmount));
  } catch { /* Missing/unsupported price is handled below, never converted to free. */ }

  const allowed = unitTypesForCategory(item.category);
  const populated = item.unitDefinitions.filter(u => u.value !== null || u.exactValue != null || u.included !== undefined || !!u.tiers?.length);
  const timeBased = item.category !== 'text' || item.selectedUnit === 'per_credit';
  const units = timeBased && item.selectedUnit ? populated.filter(u => u.unitType === item.selectedUnit) : populated;
  let issue: string | null = item.category==='text'&&item.selectedUnit&&item.selectedUnit!=='per_credit'?'unsupported-unit':null;
  if (populated.some(u => !allowed.includes(u.unitType))) issue = 'unsupported-unit';
  else if (!units.length) issue = 'missing-price';
  else if (new Set(units.map(u => u.unitType)).size !== units.length || (timeBased && units.length > 1) || new Set(units.map(u => tokenFamily(u.unitType))).size !== units.length || (units.some(u => u.unitType === 'per_credit') && units.length > 1)) issue = 'ambiguous-unit';
  else if (!Number.isFinite(fromRate) || !Number.isFinite(toRate) || fromRate <= 0 || toRate <= 0) issue = 'exchange-rate';
  const unitCosts: ManualComparisonResult['unitCosts'] = [];
  let scenarioOriginal = zero(), requiredCredits = zero(), conversion: D | null = null;
  try { conversion = (rateRatios?.[item.currency]?fromExact(rateRatios[item.currency]):ratesExact?.[item.currency] !== undefined ? D.parse(ratesExact[item.currency]) : decimalNumber(fromRate)).div(rateRatios?.[targetCurrency]?fromExact(rateRatios[targetCurrency]):ratesExact?.[targetCurrency] !== undefined ? D.parse(ratesExact[targetCurrency]) : decimalNumber(toRate)); } catch { issue ??= 'exchange-rate'; }
  for (const unit of units) {

    try {
      const unitValue = unitRate(unit);
      const original = item.pricingMode === 'plan_credit_based' ? creditUnitCost && unitValue ? creditUnitCost.mul(unitValue) : null : unitValue;
      if (original === null && unit.included === undefined && !unit.tiers?.length) { issue ??= 'missing-price'; continue; }
      if (!conversion) { issue ??= 'exchange-rate'; continue; }
      const converted = (original ?? zero()).mul(conversion);
      const quantity = exactScenarioMultiplier(unit.unitType, item.category, scenario);
      const charge = componentCharge(unit, quantity.mul(unitSize(unit.unitType)), item.billingTerms);
      if (item.pricingMode === 'plan_credit_based') { requiredCredits = requiredCredits.add(charge); if (!creditUnitCost) throw new PricingError('missing-price'); scenarioOriginal = scenarioOriginal.add(charge.mul(creditUnitCost)); } else scenarioOriginal = scenarioOriginal.add(charge);
      unitCosts.push({ nonlinear:unit.included!==undefined||!!unit.tiers?.length||!!item.billingTerms||item.purchaseTerms?.freeCredits!=null||item.purchaseTerms?.overagePerCredit!=null||item.purchaseTerms?.minimumSpend!=null, unitType: unit.unitType, originalExact: (original ?? zero()).text(), convertedExact: converted.text(), originalRatio: exactValue(original ?? zero()), convertedRatio: exactValue(converted), usageAmount: unit.value ?? 0, originalUnitCost: round(Number((original ?? zero()).text())), convertedUnitCost: round(Number(converted.text())) });
    } catch (error) { issue ??= error instanceof PricingError ? error.message : 'usage'; }
  }
  if (item.category === 'text' && !units.some(u => u.unitType === 'per_credit')) {
    for (const [family, count] of [['input', scenario.textInputTokens], ['output', scenario.textOutputTokens], ['cached', scenario.textCachedTokens ?? 0]] as const) {
      if (count > 0 && !units.some(u => tokenFamily(u.unitType) === family)) issue ??= 'missing-price';
    }
  }
  if (item.billingTerms && item.pricingMode === 'plan_credit_based') issue ??= 'unsupported-billing';
  let fixed = zero(), minimum = zero();
  if (item.billingTerms && !issue) {
    try {
      const terms = item.billingTerms, period = scenario.usagePeriod ?? 'request';
      if ((terms.kind === 'monthly' && period !== 'month') || (terms.kind === 'annual' && period !== (terms.allowancePeriod??'month'))) throw new PricingError('billing-period');
      if (terms.kind !== 'usage' && terms.fixedFee === null) throw new PricingError('missing-price');
      fixed = terms.fixedFee === null ? zero() : D.parse(terms.fixedFee);
      if (terms.kind === 'free' && (fixed.n !== 0n || (terms.minimumSpend !== null && D.parse(terms.minimumSpend).n !== 0n))) throw new PricingError('unsupported-billing');
      minimum = terms.minimumSpend === null ? zero() : D.parse(terms.minimumSpend);
    } catch (error) { issue ??= error instanceof PricingError ? error.message : 'usage'; }
  }
  const financialIssue = issue;
  const pool = item.creditPool?.trim() || item.planName || item.id;
  let purchase: PurchaseResult = emptyPurchase(item.pricingMode === 'plan_credit_based' ? 'credits' : 'usage', financialIssue, pool, item.purchaseCycle ?? null);
  if (!financialIssue && conversion && unitCosts.length) {
    if (item.pricingMode === 'direct_price_based') {
      const actual = scenarioOriginal.add(fixed), paid = actual.cmp(minimum) < 0 ? minimum : actual;
      const allocatedFixed = item.billingTerms?.kind === 'annual' && scenario.usagePeriod === 'month' ? fixed.div(D.parse('12')) : fixed;
      const used = scenarioOriginal.add(allocatedFixed);
      purchase = { ...emptyPurchase('usage', null, pool, item.billingTerms?.kind === 'annual' ? 'yearly' : item.billingTerms?.kind === 'monthly' ? 'monthly' : null), sourceAmount: paid.text(), amount: paid.mul(conversion).text(), amountExact: exactValue(paid.mul(conversion)), consumedSourceAmount: used.text(), consumedAmount: used.mul(conversion).text(), consumedExact: exactValue(used.mul(conversion)) };
    }
    else {
      purchase = calculateCreditPurchase(item.planPriceExact !== undefined ? D.parse(item.planPriceExact) : decimalNumber(item.planPrice), item.creditAmountExact !== undefined ? D.parse(item.creditAmountExact) : decimalNumber(item.creditAmount), requiredCredits, conversion, item.purchaseTerms, pool, item.purchaseCycle ?? null, scenarioOriginal);
      if (eligibilityIssue) purchase = { ...purchase, reason: eligibilityIssue, packageCount: null, remainingCredits: null, sourceAmount: null, amount: null, amountExact: null };
    }
  }
  if (eligibilityIssue) issue ??= eligibilityIssue;
  if (purchase.reason) issue ??= purchase.reason;
  const parameters = item.parameters?.trim() ?? '';
  const task = item.comparisonScenario?.trim() ?? '';
  const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
  if (item.category === 'audio') issue ??= 'unclassified-audio';
  if (!parameters) issue ??= 'parameters';
  if (!task && !item.modelName.trim()) issue ??= 'model';
  if (units.every(u => (scenarioMultiplier(u.unitType, item.category, scenario) ?? 0) === 0)) issue ??= 'zero-usage';
  if (units.some(u => u.unitType === 'per_credit') && !item.creditPool?.trim()) issue ??= 'credit-pool';
  const signature = [...units.map(u => u.unitType)].sort().join('+');
  const dimensions = units.map(u => u.unitType === 'per_credit' ? 'credits' : item.category === 'text' ? tokenFamily(u.unitType) : item.category === 'tts' && u.unitType === 'per_character' ? 'characters' : item.category === 'music' && u.unitType === 'per_song' ? scenario.musicSecondsPerSong ? 'music-duration' : 'songs' : item.category === 'music' && u.unitType === 'per_generation' ? 'generations' : item.category === 'music' ? scenario.musicSecondsPerSong ? 'music-duration' : 'time' : item.category === 'video' && u.unitType === 'per_video' ? scenario.videoSecondsPerVideo ? 'video-duration' : 'videos' : item.category === 'video' ? scenario.videoSecondsPerVideo ? 'video-duration' : 'time' : item.category).sort();
  const usageSignature = [scenario.textInputTokens,scenario.textOutputTokens,scenario.textCachedTokens ?? 0,scenario.imageCount,scenario.videoSeconds,scenario.audioMinutes,scenario.ttsMinutes ?? 0,scenario.ttsCharacters ?? 0,scenario.musicMinutes ?? 0,scenario.musicSongs ?? 0,scenario.musicGenerations ?? 0,scenario.musicSecondsPerSong ?? 0,scenario.videoCount ?? 1,scenario.videoSecondsPerVideo ?? 0,scenario.creditCount ?? 0];
  const comparisonKey = issue ? null : JSON.stringify([units.some(u => u.unitType === 'per_credit') ? pool : '', scenario.usagePeriod ?? 'request', dimensions, usageSignature, item.category, task ? 'scenario:' + normalize(task) : 'model:' + normalize(modelIdentity ?? item.modelName), normalize(parameters), targetCurrency]);
  const single = !financialIssue && unitCosts.length === 1 && !unitCosts[0].nonlinear ? unitCosts[0] : null;
  return {
    id: item.id, platformName: item.platformName, modelName: item.modelName, category: item.category,
    pricingMode: item.pricingMode, planName: item.planName, sourceCurrency: item.currency, targetCurrency,
    creditUnitCost: creditUnitCost === null ? null : round(Number(creditUnitCost.text())),
    originalUnitCost: single?.originalUnitCost ?? null,
    convertedUnitCost: single?.convertedUnitCost ?? null,
    scenarioCost: financialIssue || !unitCosts.length || !conversion ? null : round(Number(purchase.consumedAmount)),
    unitDefinitions: item.unitDefinitions, unitCosts,
    comparisonKey, unitComparisonKey: comparisonKey ? JSON.stringify([comparisonKey, signature]) : null,
    comparisonIssue: issue, comparisonScenario: task, parameters, purchase,
    unitCostExact: single?.convertedRatio ?? null, creditUnitCostExact: creditUnitCost?.text() ?? null,
    purchaseComparisonKey: comparisonKey && purchase.amount !== null && !purchase.reason && (item.pricingMode === 'direct_price_based' || ['monthly', 'yearly', 'one_time'].includes(item.purchaseCycle ?? '')) ? JSON.stringify([comparisonKey, item.pricingMode === 'direct_price_based' ? item.billingTerms?.kind === 'annual' ? 'yearly' : item.billingTerms?.kind === 'monthly' ? 'monthly' : 'current-request' : item.purchaseCycle === 'one_time' ? 'current-request' : item.purchaseCycle]) : null,
  };
}

function isManualItem(value: unknown): value is ManualPriceItem {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<ManualPriceItem>;
  return typeof item.id === 'string'
    && typeof item.platformName === 'string'
    && typeof item.modelName === 'string'
    && ['text', 'image', 'video', 'audio', 'tts', 'music'].includes(item.category ?? '')
    && ['plan_credit_based', 'direct_price_based'].includes(item.pricingMode ?? '')
    && typeof item.planName === 'string'
    && typeof item.planPrice === 'number'
    && typeof item.creditAmount === 'number'
    && typeof item.currency === 'string'
    && (item.creditPool === undefined || typeof item.creditPool === 'string')
    && (item.purchaseCycle === undefined || ['monthly', 'yearly', 'one_time', 'custom'].includes(item.purchaseCycle))
    && (item.purchaseTerms === undefined || (!!item.purchaseTerms && [true, false, null].includes(item.purchaseTerms.stackable) && (item.purchaseTerms.maxPackages === null || typeof item.purchaseTerms.maxPackages === 'number')))
    && (item.parameters === undefined || typeof item.parameters === 'string')
    && (item.comparisonScenario === undefined || typeof item.comparisonScenario === 'string')
    && (item.selectedUnit === undefined || unitTypesForCategory(item.category as ManualCategory).includes(item.selectedUnit))
    && Array.isArray(item.unitDefinitions)
    && item.unitDefinitions.every(u => !!u && typeof u === 'object' && typeof u.unitType === 'string' && (u.value === null || typeof u.value === 'number'));
}

function scenarioMultiplier(unit: UnitDefinition['unitType'], category: ManualCategory, scenario: Scenario) {
  try { return Number(exactScenarioMultiplier(unit, category, scenario).text()); } catch { return null; }
}
function exactScenarioMultiplier(unit: UnitDefinition['unitType'], category: ManualCategory, scenario: Scenario): D {
  let count: number | undefined;
  if (unit === 'per_image') count = scenario.imageCount;
  else if (unit === 'per_video') count = scenario.videoCount ?? 1;
  else if (unit === 'per_character') count = scenario.ttsCharacters ?? 0;
  else if (unit === 'per_song') count = scenario.musicSongs ?? 0;
  else if (unit === 'per_generation') count = scenario.musicGenerations ?? 0;
  else if (unit === 'per_credit') count = scenario.creditCount ?? 0;
  else if (unit.includes('cached_tokens')) count = scenario.textCachedTokens ?? 0;
  else if (unit.includes('input_tokens')) count = scenario.textInputTokens;
  else if (unit.includes('output_tokens')) count = scenario.textOutputTokens;
  if (count !== undefined) {
    if (unit !== 'per_credit' && !Number.isSafeInteger(count)) throw new PricingError('usage');
    return decimalNumber(count).div(unitSize(unit));
  }
  let seconds: D;
  if (category === 'video') seconds = scenario.videoSecondsPerVideo ? decimalNumber(scenario.videoCount ?? 1).mul(decimalNumber(scenario.videoSecondsPerVideo)) : decimalNumber(scenario.videoSeconds);
  else if (category === 'music' && scenario.musicSecondsPerSong) seconds = decimalNumber(scenario.musicSongs ?? 0).mul(decimalNumber(scenario.musicSecondsPerSong));
  else seconds = decimalNumber(audioUsage(category, scenario) ?? NaN).mul(D.parse('60'));
  return unit === 'per_second' ? seconds : seconds.div(D.parse('60'));
}

function audioUsage(category: ManualCategory, scenario: Scenario) {
  return category === 'tts' ? scenario.ttsMinutes ?? null : category === 'music' ? scenario.musicMinutes ?? null : scenario.audioMinutes;
}

function finiteNonNegative(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0;
}

function round(value: number) {
  return Number(value.toFixed(6));
}
