import { fromExact, type ExactValue } from './creditPurchase';
import type { ComparisonMetadata, ManualCategory } from './manualCompare';
export type ComparisonBasis = 'same_unit' | 'same_usage';
export type ComparisonMetric = 'unit' | 'scenario' | 'purchase';
export interface ComparableRow extends ComparisonMetadata {
  id: string; category: ManualCategory; modelName: string; platformName: string; planName: string;
  sourceCurrency?: string; originalCurrency?: string; targetCurrency: string;
  pricingMode?: string; creditUnitCost?: number | null;
  scenarioCost: number | null; convertedUnitCost: number | null;
  unitCosts: { unitType: string; nonlinear?:boolean; originalExact?: string; convertedExact?: string; originalRatio?: ExactValue; convertedRatio?: ExactValue; originalUnitCost: number; convertedUnitCost: number }[];
}
const order: ManualCategory[] = ['image', 'video', 'tts', 'music', 'text', 'audio'];
export function groupComparisons<T extends ComparableRow>(rows: T[], basis: ComparisonBasis, metric: ComparisonMetric) {
  const groups = new Map<string, { key: string; comparable: boolean; rows: T[] }>();
  for (const row of rows) {
    // Unit charts/ranking always require identical component dimensions, even when total-cost comparison is enabled.
    const baseKey = metric === 'unit' || basis === 'same_unit' ? row.unitComparisonKey : row.comparisonKey;
    const key = metric==='unit'&&row.convertedUnitCost===null?null:metric === 'purchase' ? baseKey && row.purchaseComparisonKey ? JSON.stringify([baseKey, row.purchaseComparisonKey]) : null : baseKey;
    const comparable = key !== null;
    const identity = key ?? `unranked:${row.id}`;
    const group = groups.get(identity) ?? { key: identity, comparable, rows: [] };
    group.rows.push(row); groups.set(identity, group);
  }
  return [...groups.values()].sort((a, b) => order.indexOf(a.rows[0].category) - order.indexOf(b.rows[0].category)).map(g => ({
    ...g,
    rows: g.comparable ? [...g.rows].sort((a, b) => {
      const exactA = metric === 'purchase' ? a.purchase.amountExact : metric === 'scenario' ? a.purchase.consumedExact : a.unitCostExact;
      const exactB = metric === 'purchase' ? b.purchase.amountExact : metric === 'scenario' ? b.purchase.consumedExact : b.unitCostExact;
      if (exactA && exactB) return fromExact(exactA).cmp(fromExact(exactB));
      if (metric === 'purchase') return exactA ? -1 : exactB ? 1 : 0;
      const x = metric === 'scenario' ? a.scenarioCost : a.convertedUnitCost;
      const y = metric === 'scenario' ? b.scenarioCost : b.convertedUnitCost;
      return x === null ? y === null ? 0 : 1 : y === null ? -1 : x - y;
    }) : g.rows,
  }));
}
