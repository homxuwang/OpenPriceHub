import { D, zero } from './decimal';
import type { Catalog, CategoryId, Plan, Quote, Request, SearchChoice, Unit } from './types';
const categoryUnits: Record<CategoryId, Unit[]> = { image: ['image'], video: ['second'], tts: ['character', 'minute'], music: ['song', 'generation', 'minute'], llm: ['input_token', 'output_token'] };
const discrete = new Set<Unit>(['image', 'character', 'song', 'generation', 'input_token', 'output_token']);
const canonical = (v: object) => JSON.stringify(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)));
export function quote(c: Catalog, p: Plan, r: Request, now = new Date()): Quote {
  const result: Quote = { planId: p.id, status: 'blocked', reason: null, simulated: c.simulated, currency: p.currency, purchaseExact: null, purchase: null, consumed: null, monthlyEquivalent: null, remaining: null, effectiveUnitCost: null, preferredMatches: 0,
    basis: canonical({ currency: p.currency, usage: canonical(r.usage), conditions: canonical(r.conditions), commitment: p.billing === 'annual' ? 'annual-prepaid' : 'current-request', criteria: JSON.stringify(r.criteria.filter(x => x.kind === 'required')) }) };
  const fail = (reason: string) => ({ ...result, reason });
  try {
    const offer = c.offers.find(x => x.id === p.offerId), model = c.models.find(x => x.id === offer?.modelId);
    if (!offer || !model || !c.channels.some(x => x.id === offer.channelId) || model.categoryId !== r.categoryId) return fail('identity');
    for (const rule of r.criteria) {
      const matched = c.attributeValues.some(x => x.modelId === model.id && x.attributeId === rule.attributeId && x.value === rule.value);
      if (rule.kind === 'required' && !matched) return fail('requirements');
      if (rule.kind === 'preferred' && matched) result.preferredMatches++;
    }
    if (canonical(p.conditions) !== canonical(r.conditions)) return fail('conditions');
    const source = c.sources.find(x => x.id === p.sourceId);
    if (!source || (!c.simulated && (source.kind !== 'official' || !source.url))) return fail('source');
    if (!Number.isFinite(Date.parse(p.validUntil)) || Date.parse(p.validUntil) <= now.getTime()) return fail('expired');
    const entries = Object.entries(r.usage) as [Unit, string][];
    if (!entries.length) return fail('quantity');
    const quantities = entries.map(([u, q]) => [u, D.parse(q)] as const);
    if (quantities.some(([unit, q]) => !categoryUnits[r.categoryId].includes(unit) || (discrete.has(unit) && q.n % q.d !== 0n))) return fail('quantity');
    const total = quantities.reduce((sum, [, q]) => sum.add(q), zero());
    // A zero request is not a price discovery shortcut: still validate all price terms.
    let purchase = zero(), consumed = zero(), monthly: D | null = null;
    let remaining: Quote['remaining'] = null;
    if (p.billing === 'payg') {
      if (p.amount !== null || p.entitlement || p.creditRule) return fail('unsupported-rule');
      if (p.components.length !== entries.length || new Set(p.components.map(x => x.unit)).size !== entries.length) return fail('unit');
      for (const [unit, q] of quantities) {
        const component = p.components.find(x => x.unit === unit);
        if (!component) return fail('unit');
        if (component.rate === null) return fail('missing-price');
        purchase = purchase.add(q.mul(D.parse(component.rate)).div(D.parse(component.per)));
      }
      consumed = purchase;
    } else {
      if (p.amount === null) return fail('missing-price');
      const amount = D.parse(p.amount), entitlement = p.entitlement;
      if (!entitlement || quantities.length !== 1) return fail('entitlement');
      const allowance = D.parse(entitlement.quantity);
      if (allowance.cmp(zero()) <= 0) return fail('entitlement');
      let [unit, needed] = quantities[0];
      const physicalQuantity = needed;
      if (p.billing === 'credits') {
        const rule = p.creditRule;
        if (!rule || !entitlement.poolId || rule.poolId !== entitlement.poolId || rule.unit !== unit || entitlement.unit !== 'credit') return fail('credit-pool');
        const multiplier = D.parse(rule.creditsPerUnit);
        if (multiplier.cmp(zero()) <= 0) return fail('credit-pool');
        needed = needed.mul(multiplier); unit = 'credit';
      } else if (entitlement.poolId || p.creditRule) return fail('credit-pool');
      if (unit !== entitlement.unit) return fail('unit');
      if (p.billing === 'package' || p.billing === 'credits') {
        if (entitlement.period !== 'purchase' || p.components.length) return fail('unsupported-rule');
        const packs = needed.div(allowance).ceil();
        purchase = amount.mul(packs); consumed = amount.mul(needed).div(allowance);
        remaining = { quantity: allowance.mul(packs).sub(needed).text(), unit, poolId: entitlement.poolId };
      } else {
        if (entitlement.period !== (p.billing === 'one_time' ? 'purchase' : 'month')) return fail('entitlement');
        if (p.billing === 'free' && amount.cmp(zero()) !== 0) return fail('invalid-price');
        const base = p.billing === 'annual' ? amount.div(D.parse('12')) : amount;
        const excess = needed.cmp(allowance) > 0 ? needed.sub(allowance) : zero();
        let overage = zero();
        if (p.components.length > 1 || (p.components.length && p.components[0].unit !== unit)) return fail('unsupported-rule');
        const component = p.components[0];
        if (component && (component.rate === null || D.parse(component.per).cmp(zero()) <= 0)) return fail('missing-price');
        if (component?.rate !== null && component?.rate !== undefined) D.parse(component.rate);
        if (excess.cmp(zero()) > 0) {
          if (!component || component.rate === null) return fail('quota');
          overage = excess.mul(D.parse(component.rate)).div(D.parse(component.per));
        }
        purchase = amount.add(overage);
        consumed = base.mul(needed.cmp(allowance) > 0 ? allowance : needed).div(allowance).add(overage);
        if (p.billing === 'annual') monthly = base.add(overage);
        remaining = { quantity: excess.cmp(zero()) > 0 ? '0' : allowance.sub(needed).text(), unit, poolId: null };
      }
      // Effective cost is cash purchase / requested physical units, not / credits.
      if (physicalQuantity.cmp(zero()) > 0) result.effectiveUnitCost = purchase.div(physicalQuantity).text();
    }
    if (p.billing === 'payg' && quantities.length === 1 && total.cmp(zero()) > 0) result.effectiveUnitCost = purchase.div(total).text();
    return { ...result, status: 'ok', reason: null, purchaseExact: { numerator: String(purchase.n), denominator: String(purchase.d) }, purchase: purchase.text(), consumed: consumed.text(), monthlyEquivalent: monthly?.text() ?? null, remaining };
  } catch { return fail('invalid-price'); }
}
const normalize = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
export function fuzzy(haystack: string, needle: string) {
  const h = normalize(haystack), n = normalize(needle);
  if (h.includes(n)) return true;
  // Subsequence matching allows short/incomplete input without a fabricated score.
  let i = 0;
  for (const letter of h) if (letter === n[i]) i++;
  return i === n.length;
}
/** Only identities present in the active category are offered for selection. */
export function searchChoices(c: Catalog, categoryId: CategoryId, query = ''): SearchChoice[] {
  const offers = c.offers.filter(o => c.products.some(p => p.id === o.productId && p.categoryId === categoryId));
  const providerIds = new Set(offers.flatMap(o => [
    c.channels.find(x => x.id === o.channelId)?.providerId,
    c.products.find(x => x.id === o.productId)?.providerId,
    c.models.find(x => x.id === o.modelId)?.developerId,
  ]));
  return [
    ...c.products.filter(p => offers.some(o => o.productId === p.id)).map(p => ({ kind: 'product' as const, id: p.id, name: p.name })),
    ...c.models.filter(m => offers.some(o => o.modelId === m.id)).map(m => ({ kind: 'model' as const, id: m.id, name: m.name })),
    ...c.providers.filter(p => providerIds.has(p.id)).map(p => ({ kind: 'provider' as const, id: p.id, name: p.name })),
  ].filter(x => fuzzy(x.name, query));
}
export function discover(c: Catalog, r: Request, now = new Date()) {
  return c.plans.filter(p => {
    const offer = c.offers.find(o => o.id === p.offerId), product = c.products.find(x => x.id === offer?.productId);
    if (!product || product.categoryId !== r.categoryId || (r.billing?.length && !r.billing.includes(p.billing)) || (r.tagId && !product.tagIds.includes(r.tagId))) return false;
    const model = c.models.find(x => x.id === offer?.modelId), channel = c.channels.find(x => x.id === offer?.channelId);
    const provider = c.providers.find(x => x.id === channel?.providerId);
    if (r.selections?.length && !r.selections.some(s => s.kind === 'product' ? s.id === product.id : s.kind === 'model' ? s.id === model?.id : s.id === provider?.id || s.id === product.providerId || s.id === model?.developerId)) return false;
    const words = [product.name, model?.name, channel?.name, provider?.name, c.providers.find(x => x.id === product.providerId)?.name, c.providers.find(x => x.id === model?.developerId)?.name, ...product.tagIds.map(id => c.tags.find(t => t.id === id)?.name), ...c.attributeValues.filter(a => a.modelId === model?.id).map(a => `${a.attributeId} ${a.value}`)].join(' ');
    return !r.query || fuzzy(words, r.query);
  }).map(p => ({ plan: p, quote: quote(c, p, r, now) }));
}
export function savings(reference: Quote, alternative: Quote) {
  if (reference.status !== 'ok' || alternative.status !== 'ok' || reference.basis !== alternative.basis || reference.purchase === null || alternative.purchase === null) return null;
  if (!reference.purchaseExact || !alternative.purchaseExact) return null;
  const base = new D(BigInt(reference.purchaseExact.numerator), BigInt(reference.purchaseExact.denominator)), other = new D(BigInt(alternative.purchaseExact.numerator), BigInt(alternative.purchaseExact.denominator));
  return { amount: base.sub(other).text(), percent: base.cmp(zero()) > 0 ? base.sub(other).mul(D.parse('100')).div(base).text() : null };
}
export function alternatives(c: Catalog, originalId: string, r: Request, now = new Date()) {
  const relations = c.alternatives.filter(x => x.originalId === originalId && x.scenario === r.categoryId);
  return discover(c, { ...r, query: '', selections: [] }, now).filter(row => relations.some(rel => rel.alternativeId === c.offers.find(o => o.id === row.plan.offerId)?.productId)).map(row => ({ ...row, reason: relations.find(rel => rel.alternativeId === c.offers.find(o => o.id === row.plan.offerId)?.productId)!.reason }));
}
