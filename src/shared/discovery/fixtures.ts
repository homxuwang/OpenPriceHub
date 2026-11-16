import type { Catalog, CategoryId, Plan, Unit } from './types';
/** Entirely fictional test identities/prices. Never merge into the live catalog. */
export function createMockCatalog(): Catalog {
  const c: Catalog = { schemaVersion: 1, simulated: true, categories: [], providers: [{ id: 'maker', name: 'SIM Maker' }, { id: 'channel-b', name: 'SIM Channel B' }], products: [], models: [], channels: [{ id: 'direct', name: 'SIM Direct', providerId: 'maker' }, { id: 'reseller', name: 'SIM Reseller', providerId: 'channel-b' }], offers: [], plans: [], attributes: [{ id: 'api', name: 'API' }, { id: 'commercial', name: 'Commercial use' }], attributeValues: [], tags: [{ id: 'creator', name: 'SIM Creator' }], sources: [{ id: 'fixture', kind: 'simulation', label: 'Fictional test fixture — not a vendor quotation', url: null }], alternatives: [], experiences: [] };
  const units: Record<CategoryId, Unit> = { image: 'image', video: 'second', tts: 'character', music: 'song', llm: 'input_token' };
  for (const category of ['image', 'video', 'tts', 'music', 'llm'] as CategoryId[]) {
    const unit = units[category];
    c.categories.push({ id: category, name: { image: 'AI Image', video: 'AI Video', tts: 'Voice & TTS', music: 'AI Music', llm: 'LLM / API' }[category] });
    c.experiences.push({ id: category, name: { image: 'Text to Image', video: 'Text to Video', tts: 'Text to Speech', music: 'Text to Music', llm: 'Text Generation / API' }[category], nameZh: { image: '文生图', video: '文生视频', tts: '文本转语音', music: '文生音乐', llm: '文本生成 / API' }[category], categoryId: category, usage: category === 'llm' ? { input_token: '1000', output_token: '500' } : { [unit]: category === 'tts' ? '1000' : '10' }, criteria: [], conditions: category === 'image' ? { resolution: '1024' } : category === 'video' ? { quality: 'standard' } : {} });
    for (const suffix of ['a', 'b']) {
      const id = `${category}-${suffix}`;
      c.products.push({ id, name: `SIM ${category.toUpperCase()} ${suffix.toUpperCase()}`, categoryId: category, providerId: 'maker', tagIds: ['creator'] });
      c.models.push({ id, name: `SIM Model ${id}`, developerId: 'maker', categoryId: category });
      c.attributeValues.push({ modelId: id, attributeId: 'api', value: 'true' }, { modelId: id, attributeId: 'commercial', value: suffix === 'a' ? 'true' : 'false' });
      c.offers.push({ id, modelId: id, productId: id, channelId: 'direct' });
      const plan: Plan = { id, offerId: id, name: `SIM ${suffix === 'a' ? 'Reference' : 'Alternative'}`, billing: 'payg', currency: 'USD', amount: null, components: [{ unit, per: category === 'llm' || category === 'tts' ? '1000' : '1', rate: suffix === 'a' ? '0.2' : '0.1' }], entitlement: null, creditRule: null, sourceId: 'fixture', validUntil: '2099-01-01T00:00:00Z', conditions: { ...c.experiences.at(-1)!.conditions } };
      if (category === 'llm') plan.components.push({ unit: 'output_token', per: '1000', rate: suffix === 'a' ? '0.4' : '0.2' });
      c.plans.push(plan);
    }
    c.alternatives.push({ originalId: `${category}-a`, alternativeId: `${category}-b`, reason: 'Simulation: same declared task, lower fixture usage rate; commercial permission differs.', scenario: category });
    c.offers.push({ id: `${category}-reseller`, productId: `${category}-a`, modelId: `${category}-a`, channelId: 'reseller' });
    c.plans.push({ ...structuredClone(c.plans.find(p => p.id === `${category}-a`)!), id: `${category}-reseller`, offerId: `${category}-reseller`, name: 'SIM second provider' });
  }
  const base = c.plans[0];
  const add = (id: string, patch: Partial<Plan>) => c.plans.push({ ...structuredClone(base), id, name: `SIM ${id}`, ...patch });
  add('missing', { components: [{ unit: 'image', rate: null, per: '1' }] });
  add('expired', { validUntil: '2020-01-01T00:00:00Z' });
  add('invalid', { components: [{ unit: 'image', rate: '-1', per: '1' }] });
  for (const billing of ['free', 'monthly', 'annual', 'package', 'one_time'] as const) add(billing, {
    billing, amount: billing === 'free' ? '0' : billing === 'annual' ? '120' : '10',
    components: [], entitlement: { unit: 'image', quantity: '20', period: billing === 'annual' || billing === 'monthly' || billing === 'free' ? 'month' : 'purchase', poolId: null },
  });
  add('credits', { billing: 'credits', amount: '5', components: [], entitlement: { unit: 'credit', quantity: '30', period: 'purchase', poolId: 'pool-a' }, creditRule: { unit: 'image', creditsPerUnit: '4', poolId: 'pool-a' } });
  add('wrong-pool', { ...structuredClone(c.plans.at(-1)!), id: 'wrong-pool', name: 'SIM wrong-pool', creditRule: { unit: 'image', creditsPerUnit: '4', poolId: 'pool-b' } });
  add('monthly-overage', { billing: 'monthly', amount: '10', entitlement: { unit: 'image', quantity: '5', period: 'month', poolId: null }, components: [{ unit: 'image', rate: '0.5', per: '1' }] });
  return c;
}
