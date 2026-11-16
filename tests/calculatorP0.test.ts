import { describe, expect, it } from 'vitest';
import { calculateManualComparison, createManualItem, DEFAULT_MANUAL_STATE, normalizeManualState, type ManualCategory } from '../src/shared/manualCompare';
import { buildDetailedComparisonRows, createDetailedSampleState, normalizeDetailedState } from '../src/shared/detailedCompare';
import { groupComparisons } from '../src/shared/manualComparisonGroups';
const scenario = { ...DEFAULT_MANUAL_STATE.scenario, videoSeconds: 60, imageCount: 100, ttsMinutes: 2, musicMinutes: 3 };
function item(id: string, category: ManualCategory = 'image') {
  return { ...createManualItem(id, 1, category), platformName: id, modelName: 'same-model', parameters: 'standard; v1', pricingMode: 'direct_price_based' as const,
    unitDefinitions: [{ unitType: category === 'image' ? 'per_image' as const : 'per_second' as const, value: 0.1 }] };
}
const calc = (i: ReturnType<typeof item>) => calculateManualComparison(i, scenario, { CNY: 1, USD: 7.2 }, 'CNY');
describe('calculator P0 comparison safety', () => {
  it('keeps five simulated product classes in separate groups', () => {
    const s = createDetailedSampleState();
    const rows = buildDetailedComparisonRows(s, { platformIds: s.platforms.map(p => p.id), modelIds: s.models.map(m => m.id), scenario: s.scenario, targetCurrency: 'CNY' });
    const groups = groupComparisons(rows, 'same_usage', 'scenario');
    expect(groups.map(g => g.rows[0].category)).toEqual(['image', 'video', 'tts', 'music', 'text']);
    for (const g of groups) expect(new Set(g.rows.map(r => r.category)).size).toBe(1);
  });
  it('compares the same model across providers with equal declared parameters', () => {
    const a = calc(item('a')), b = calc({ ...item('b'), currency: 'USD' });
    const groups = groupComparisons([a, b], 'same_unit', 'scenario');
    expect(groups).toHaveLength(1); expect(groups[0].comparable).toBe(true);
    expect(groups[0].rows.map(r => r.scenarioCost)).toEqual([10, 72]);
  });
  it('does not compare different model identities, parameters or categories by default', () => {
    expect(groupComparisons([calc(item('a')), calc({ ...item('b'), parameters: 'high quality' }), calc({ ...item('c'), modelName: 'other-model' })], 'same_unit', 'scenario')).toHaveLength(3);
  });
  it('allows an explicit shared task across models without dropping parameter requirements', () => {
    const a = calc({ ...item('a'), comparisonScenario: 'text to image' });
    const b = calc({ ...item('b'), modelName: 'different-model', comparisonScenario: 'text to image' });
    expect(groupComparisons([a, b], 'same_usage', 'scenario')).toHaveLength(1);
    expect(groupComparisons([a, { ...b, comparisonKey: null, unitComparisonKey: null }], 'same_usage', 'scenario')).toHaveLength(2);
  });
  it('isolates second/minute unit rankings and compares totals only when explicitly selected', () => {
    const a = calc(item('a', 'video'));
    const b = calc({ ...item('b', 'video'), unitDefinitions: [{ unitType: 'per_minute', value: 6 }] });
    expect(a.scenarioCost).toBe(6); expect(b.scenarioCost).toBe(6);
    expect(groupComparisons([a, b], 'same_unit', 'scenario')).toHaveLength(2);
    expect(groupComparisons([a, b], 'same_usage', 'scenario')).toHaveLength(1);
    expect(groupComparisons([a, b], 'same_usage', 'unit')).toHaveLength(2);
  });
  it('does not add alternative time rates and accepts an explicit selected unit', () => {
    const i = { ...item('v', 'video'), unitDefinitions: [{ unitType: 'per_second' as const, value: 0.1 }, { unitType: 'per_minute' as const, value: 6 }] };
    expect(calc(i).scenarioCost).toBeNull(); expect(calc(i).comparisonIssue).toBe('ambiguous-unit');
    expect(calc({ ...i, selectedUnit: 'per_second' }).scenarioCost).toBe(6);
    expect(calc({ ...i, selectedUnit: 'per_minute' }).scenarioCost).toBe(6);
  });
  it('keeps token components separate but sums charges for the specified usage', () => {
    const i = { ...item('t', 'text'), unitDefinitions: [{ unitType: 'per_1k_input_tokens' as const, value: 2 }, { unitType: 'per_1k_output_tokens' as const, value: 4 }] };
    const q = calc(i); expect(q.convertedUnitCost).toBeNull(); expect(q.originalUnitCost).toBeNull();
    expect(q.unitCosts).toHaveLength(2); expect(q.scenarioCost).toBe(4);
    expect(groupComparisons([q, calc(item('i'))], 'same_usage', 'scenario')).toHaveLength(2);
  });
  it('blocks missing required token components and missing prices, not zero', () => {
    const token = { ...item('t', 'text'), unitDefinitions: [{ unitType: 'per_1k_input_tokens' as const, value: 1 }] };
    expect(calc(token).scenarioCost).toBeNull();
    expect(calc({ ...item('m'), unitDefinitions: [{ unitType: 'per_image', value: null }] }).scenarioCost).toBeNull();
    expect(calc({ ...item('free'), unitDefinitions: [{ unitType: 'per_image', value: 0 }] }).scenarioCost).toBe(0);
  });
  it('keeps unclassified audio and unknown parameters out of rankings', () => {
    expect(calc(item('a', 'audio')).comparisonIssue).toBe('unclassified-audio');
    expect(calc({ ...item('x'), parameters: undefined }).comparisonKey).toBeNull();
    expect(calc({ ...item('x'), parameters: undefined }).scenarioCost).toBe(10);
  });
  it('uses separate TTS/music usages and supports audio seconds/minutes conversion', () => {
    expect(calc(item('tts', 'tts')).scenarioCost).toBe(12);
    expect(calc(item('music', 'music')).scenarioCost).toBe(18);
  });
  it('roundtrips old JSON and new fields without silently deleting incompatible units', () => {
    const s = { ...DEFAULT_MANUAL_STATE, items: [{ ...item('x'), comparisonScenario: 'draw', selectedUnit: 'per_image' as const }] };
    expect(normalizeManualState(JSON.parse(JSON.stringify(s)))?.items[0].comparisonScenario).toBe('draw');
    const invalid = { ...s, items: [{ ...item('x'), unitDefinitions: [{ unitType: 'per_second' as const, value: 1 }] }] };
    const imported = normalizeManualState(invalid)!;
    expect(imported.items[0].unitDefinitions).toHaveLength(1);
    expect(calc(imported.items[0]).comparisonIssue).toBe('unsupported-unit');
    const d = createDetailedSampleState(); expect(normalizeDetailedState(JSON.parse(JSON.stringify(d)))?.rules[0].parameters).toBe(d.rules[0].parameters);
  });
  it('does not group quotes evaluated for different usage amounts', () => {
    const a = calc(item('a'));
    const b = calculateManualComparison(item('b'), { ...scenario, imageCount: 1 }, { CNY: 1 }, 'CNY');
    expect(groupComparisons([a, b], 'same_usage', 'scenario')).toHaveLength(2);
  });
  it('does not rank zero usage or invalid exchange rates', () => {
    const q = calculateManualComparison(item('x'), { ...scenario, imageCount: 0 }, { CNY: 1 }, 'CNY');
    expect(q.comparisonIssue).toBe('zero-usage');
    expect(calculateManualComparison(item('x'), scenario, { CNY: 0 }, 'CNY').scenarioCost).toBeNull();
  });
});
