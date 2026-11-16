import type { Catalog } from './types';
import { BILLINGS, UNITS } from './types';
import { createMockCatalog } from './fixtures';
export interface CatalogRepository { load(signal?: AbortSignal): Promise<Catalog> }
// Transport validation deliberately permits bad numeric strings: these are blocked by the
// engine per plan (and are useful anomaly fixtures), not treated as zero/free.
type Check = (value: unknown) => boolean;
const str: Check = v => typeof v === 'string';
const nullable = (check: Check): Check => v => v === null || check(v);
const list = (check: Check): Check => v => Array.isArray(v) && v.every(check);
const oneOf = (values: readonly string[]): Check => v => typeof v === 'string' && values.includes(v);
const object = (fields: Record<string, Check>): Check => v => !!v && typeof v === 'object' && !Array.isArray(v) && Object.entries(fields).every(([key, check]) => check((v as Record<string, unknown>)[key]));
const stringMap: Check = v => !!v && typeof v === 'object' && !Array.isArray(v) && Object.values(v).every(str);
const category = oneOf(['image', 'video', 'tts', 'music', 'llm']);
const unit = oneOf(UNITS);
const shape = object({
  schemaVersion: v => v === 1, simulated: v => typeof v === 'boolean',
  categories: list(object({ id: category, name: str })),
  providers: list(object({ id: str, name: str })),
  products: list(object({ id: str, name: str, categoryId: category, providerId: str, tagIds: list(str) })),
  models: list(object({ id: str, name: str, developerId: str, categoryId: category })),
  channels: list(object({ id: str, name: str, providerId: str })),
  offers: list(object({ id: str, productId: str, modelId: str, channelId: str })),
  attributes: list(object({ id: str, name: str })),
  attributeValues: list(object({ modelId: str, attributeId: str, value: str })),
  tags: list(object({ id: str, name: str })),
  sources: list(object({ id: str, kind: oneOf(['simulation', 'official']), label: str, url: nullable(str) })),
  plans: list(object({ id: str, name: str, offerId: str, billing: oneOf(BILLINGS), currency: v => typeof v === 'string' && /^[A-Z]{3}$/.test(v), amount: nullable(str), sourceId: str, validUntil: str, conditions: stringMap,
    components: list(object({ unit, rate: nullable(str), per: str })),
    entitlement: nullable(object({ unit, quantity: str, period: oneOf(['month', 'purchase']), poolId: nullable(str) })),
    creditRule: nullable(object({ unit, creditsPerUnit: str, poolId: str })),
  })),
  alternatives: list(object({ originalId: str, alternativeId: str, reason: str, scenario: category })),
  experiences: list(object({ id: str, name: str, nameZh: v => v === undefined || str(v), categoryId: category, usage: v => stringMap(v) && Object.keys(v as object).every(k => UNITS.includes(k as typeof UNITS[number])), criteria: list(object({ attributeId: str, value: str, kind: oneOf(['required', 'preferred']) })), conditions: stringMap })),
});
export function validateCatalog(value: unknown): Catalog {
  if (!shape(value)) throw new Error('Invalid catalog response (schemaVersion 1 required)');
  const c = value as Catalog;
  for (const collection of [c.categories, c.providers, c.products, c.models, c.channels, c.offers, c.plans, c.attributes, c.tags, c.sources, c.experiences]) {
    if (new Set(collection.map(x => x.id)).size !== collection.length) throw new Error('Duplicate entity ID');
  }
  const has = (rows: { id: string }[], id: string) => rows.some(x => x.id === id);
  const valid = c.products.every(x => has(c.categories, x.categoryId) && has(c.providers, x.providerId) && x.tagIds.every(id => has(c.tags, id))) &&
    c.models.every(x => has(c.categories, x.categoryId) && has(c.providers, x.developerId)) &&
    c.channels.every(x => has(c.providers, x.providerId)) &&
    c.offers.every(x => has(c.products, x.productId) && has(c.models, x.modelId) && has(c.channels, x.channelId)) &&
    c.plans.every(x => has(c.offers, x.offerId) && has(c.sources, x.sourceId)) &&
    c.attributeValues.every(x => has(c.models, x.modelId) && has(c.attributes, x.attributeId)) &&
    c.alternatives.every(x => x.originalId !== x.alternativeId && has(c.products, x.originalId) && has(c.products, x.alternativeId)) &&
    c.experiences.every(x => has(c.categories, x.categoryId) && x.criteria.every(y => has(c.attributes, y.attributeId)));
  if (!valid) throw new Error('Unresolved catalog relation');
  if (!c.simulated && c.sources.some(x => x.kind === 'simulation')) throw new Error('Simulation data cannot be labeled live');
  return c;
}
export class MockRepository implements CatalogRepository {
  constructor(private readonly factory: () => Catalog = createMockCatalog) {}
  async load(signal?: AbortSignal) { signal?.throwIfAborted(); return validateCatalog(structuredClone(this.factory())); }
}
export class ApiRepository implements CatalogRepository {
  constructor(private readonly endpoint = '/api/p1/catalog', private readonly fetcher: typeof fetch = (...args) => globalThis.fetch(...args)) {}
  async load(signal?: AbortSignal) {
    const response = await this.fetcher(this.endpoint, { signal, headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`Catalog API: HTTP ${response.status}`);
    return validateCatalog(await response.json());
  }
}
