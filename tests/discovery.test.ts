import { describe, expect, it } from 'vitest';
import { D } from '../src/shared/discovery/decimal';
import { createMockCatalog } from '../src/shared/discovery/fixtures';
import { alternatives, discover, quote, savings, searchChoices } from '../src/shared/discovery/engine';
import { ApiRepository, MockRepository, validateCatalog } from '../src/shared/discovery/repository';
import type { CategoryId, Request } from '../src/shared/discovery/types';
const now = new Date('2026-11-06T00:00:00Z');
const request = (category: CategoryId = 'image'): Request => {
  const x = createMockCatalog().experiences.find(e => e.id === category)!;
  return { categoryId: category, usage: x.usage, conditions: x.conditions, criteria: x.criteria };
};
function calculate(id: string, patch: Partial<Request> = {}) {
  const c = createMockCatalog(); return quote(c, c.plans.find(p => p.id === id)!, { ...request(), ...patch }, now);
}
describe('P1 decimal arithmetic', () => {
  it('adds decimals exactly and retains fractions until output', () => {
    expect(D.parse('0.1').add(D.parse('0.2')).text()).toBe('0.3');
    expect(D.parse('1').div(D.parse('3')).mul(D.parse('3')).text()).toBe('1');
    expect(D.parse('9007199254740993').add(D.parse('1')).text()).toBe('9007199254740994');
  });
  it.each(['-1', '', 'NaN', 'Infinity', '1e3', '0.0000000000001', '01', '1'.repeat(31)])('rejects invalid %s', s => expect(() => D.parse(s)).toThrow());
});
describe('P1 five-category shared pipeline', () => {
  it.each(['image', 'video', 'tts', 'music', 'llm'] as CategoryId[])('%s searches, matches, quotes, compares alternatives and channels', category => {
    const c = createMockCatalog(), r = request(category);
    const rows = discover(c, r, now), a = rows.find(x => x.plan.id === `${category}-a`)!, b = rows.find(x => x.plan.id === `${category}-b`)!;
    expect(a.quote.status).toBe('ok'); expect(savings(a.quote, b.quote)?.percent).toBe('50');
    expect(rows.find(x => x.plan.id === `${category}-reseller`)?.quote.status).toBe('ok');
    expect(alternatives(c, `${category}-a`, r, now)[0].plan.id).toBe(`${category}-b`);
    expect(alternatives(c, `${category}-b`, r, now)).toEqual([]);
    expect(discover(c, { ...r, query: 'Channel B' }, now).map(x => x.plan.id)).toEqual([`${category}-reseller`]);
    expect(discover(c, { ...r, criteria: [{ attributeId: 'commercial', value: 'true', kind: 'required' }] }, now).find(x => x.plan.id === `${category}-b`)?.quote.reason).toBe('requirements');
  });
  it('supports a new experience as data, with no new calculator', () => {
    const c = createMockCatalog();
    c.experiences.push({ ...c.experiences[0], id: 'social-campaign', name: 'SIM social campaign', usage: { image: '30' }, criteria: [{ attributeId: 'api', value: 'true', kind: 'required' }] });
    const e = c.experiences.at(-1)!;
    expect(discover(c, e, now).find(x => x.plan.id === 'image-a')?.quote.purchase).toBe('6');
  });
  it('suggests existing identities by fuzzy query and category', () => {
    const c = createMockCatalog();
    expect(searchChoices(c, 'image', 'mdlimg').filter(x => x.kind === 'model').map(x => x.id)).toEqual(['image-a', 'image-b']);
    expect(searchChoices(c, 'image').some(x => x.id === 'video-a')).toBe(false);
    expect(searchChoices(c, 'image', 'nothing-found')).toEqual([]);
  });
  it('combines identity selections with OR semantics and filters by stable IDs', () => {
    const c = createMockCatalog();
    const a = discover(c, { ...request(), selections: [{ kind: 'model', id: 'image-a' }] }, now);
    expect(a.some(x => x.plan.id === 'image-b')).toBe(false);
    expect(a.some(x => x.plan.id === 'image-reseller')).toBe(true);
    expect(discover(c, { ...request(), selections: [{ kind: 'model', id: 'image-a' }, { kind: 'model', id: 'image-b' }] }, now)).toHaveLength(discover(c, request(), now).length);
    expect(discover(c, { ...request(), selections: [{ kind: 'provider', id: 'channel-b' }] }, now).map(x => x.plan.id)).toEqual(['image-reseller']);
    expect(discover(c, { ...request(), selections: [{ kind: 'product', id: 'image-b' }] }, now).map(x => x.plan.id)).toEqual(['image-b']);
  });
  it('combines billing filters, tags and model search', () => {
    const c = createMockCatalog();
    const rows = discover(c, { ...request(), query: 'Model image-a', billing: ['annual', 'monthly'], tagId: 'creator' }, now);
    expect(rows.map(x => x.plan.id)).toEqual(['monthly', 'annual', 'monthly-overage']);
    expect(discover(c, { ...request(), query: 'does-not-exist' }, now)).toEqual([]);
  });
});
describe('P1 pricing terms', () => {
  it.each([
    ['image-a', '2', '2', null], ['monthly', '10', '5', '10'], ['annual', '120', '5', '10'],
    ['package', '10', '5', '10'], ['one_time', '10', '5', '10'], ['free', '0', '0', '10'],
    ['credits', '10', '6.666666666667', '20'], ['monthly-overage', '12.5', '12.5', '0'],
  ])('%s separates purchase, consumed and remaining', (id, purchase, consumed, remaining) => {
    const q = calculate(id);
    expect(q.status).toBe('ok'); expect(q.purchase).toBe(purchase); expect(q.consumed).toBe(consumed); expect(q.remaining?.quantity ?? null).toBe(remaining);
  });
  it('annual purchase remains upfront; monthly quota does not become annual quota', () => {
    expect(calculate('annual').monthlyEquivalent).toBe('10');
    expect(calculate('annual', { usage: { image: '21' } }).reason).toBe('quota');
    expect(savings(calculate('monthly'), calculate('annual'))).toBeNull();
  });
  it('package rounds up and one-time quota cannot be silently rebought', () => {
    expect(calculate('package', { usage: { image: '21' } }).purchase).toBe('20');
    expect(calculate('one_time', { usage: { image: '21' } }).reason).toBe('quota');
    expect(calculate('free', { usage: { image: '21' } }).reason).toBe('quota');
  });
  it.each([['missing', 'missing-price'], ['expired', 'expired'], ['invalid', 'invalid-price'], ['wrong-pool', 'credit-pool']])('%s is blocked, not free', (id, reason) => {
    const q = calculate(id); expect(q.reason).toBe(reason); expect(q.purchase).toBeNull();
  });
  it('missing fixed amount and missing quota fail closed', () => {
    const c = createMockCatalog(), p = c.plans.find(x => x.id === 'free')!;
    p.amount = null; expect(quote(c, p, request(), now).reason).toBe('missing-price');
    p.amount = '0'; p.entitlement = null; expect(quote(c, p, request(), now).reason).toBe('entitlement');
  });
  it('rejects fractional discrete units and unsupported mixed fees', () => {
    expect(calculate('image-a', { usage: { image: '0.5' } }).reason).toBe('quantity');
    const c = createMockCatalog(), p = c.plans[0]; p.amount = '10';
    expect(quote(c, p, request(), now).reason).toBe('unsupported-rule');
  });
  it('zero usage still validates missing prices, retains subscription purchase', () => {
    expect(calculate('missing', { usage: { image: '0' } }).purchase).toBeNull();
    expect(calculate('monthly', { usage: { image: '0' } }).purchase).toBe('10');
    expect(calculate('package', { usage: { image: '0' } }).purchase).toBe('0');
  });
  it('does not compare currencies, conditions or units', () => {
    const c = createMockCatalog(), p = c.plans[0]; p.currency = 'CNY';
    expect(savings(calculate('image-a'), quote(c, p, request(), now))).toBeNull();
    expect(calculate('image-a', { conditions: { resolution: '2048' } }).reason).toBe('conditions');
    expect(calculate('image-a', { usage: { song: '10' } }).reason).toBe('quantity');
  });
  it('rejects overlapping components and zero denominators', () => {
    const c = createMockCatalog(), p = c.plans[0]; p.components.push(p.components[0]);
    expect(quote(c, p, request(), now).reason).toBe('unit');
    p.components.pop(); p.components[0].per = '0'; expect(quote(c, p, request(), now).reason).toBe('invalid-price');
  });
  it('LLM charges input/output independently; missing output is not zero', () => {
    const c = createMockCatalog(), p = c.plans.find(x => x.id === 'llm-a')!;
    expect(quote(c, p, request('llm'), now).purchase).toBe('0.4');
    p.components[1].rate = null; expect(quote(c, p, request('llm'), now).purchase).toBeNull();
  });
  it('preferences explain matches rather than fabricate quality scores', () => {
    expect(calculate('image-a', { criteria: [{ attributeId: 'api', value: 'true', kind: 'preferred' }] }).preferredMatches).toBe(1);
  });
  it('savings use exact fractions even below displayed precision', () => {
    const c = createMockCatalog(), a = c.plans[0], b = c.plans[1];
    a.components[0] = { unit: 'image', rate: '0.000000000001', per: '100' };
    b.components[0] = { unit: 'image', rate: '0.000000000001', per: '200' };
    expect(savings(quote(c, a, request(), now), quote(c, b, request(), now))?.percent).toBe('50');
  });
});
describe('Repository contract', () => {
  it('Mock and API run identical business queries', async () => {
    const mock = await new MockRepository().load();
    const api = await new ApiRepository('/fixture', async () => new Response(JSON.stringify(mock))).load();
    expect(discover(api, request(), now)).toEqual(discover(mock, request(), now));
  });
  it('does not share mutable fixture state', async () => {
    const repo = new MockRepository(), a = await repo.load(); a.plans[0].amount = '999';
    expect((await repo.load()).plans[0].amount).toBeNull();
  });
  it('HTTP error and malformed payload never fall back to mock', async () => {
    await expect(new ApiRepository('/fixture', async () => new Response('', { status: 503 })).load()).rejects.toThrow('503');
    await expect(new ApiRepository('/fixture', async () => new Response('{}')).load()).rejects.toThrow('Invalid catalog');
  });
  it('rejects missing relationships, duplicates and mislabeled simulation', () => {
    const c = createMockCatalog(); c.simulated = false; expect(() => validateCatalog(c)).toThrow('Simulation');
    c.simulated = true; c.channels = []; expect(() => validateCatalog(c)).toThrow('relation');
    const duplicate = createMockCatalog(); duplicate.products.push(duplicate.products[0]); expect(() => validateCatalog(duplicate)).toThrow('Duplicate');
  });
  it('supports cancellation', async () => {
    const controller = new AbortController(); controller.abort();
    await expect(new MockRepository().load(controller.signal)).rejects.toThrow();
  });
});
