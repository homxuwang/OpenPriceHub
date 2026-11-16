import { groupComparisons, type ComparableRow, type ComparisonBasis, type ComparisonMetric } from '../../shared/manualComparisonGroups';
import { UNIT_LABELS } from '../../shared/manualUnits';
import { fromExact, type ExactValue } from '../../shared/creditPurchase';
import type { ManualCategory } from '../../shared/manualCompare';
export const MANUAL_CATEGORY_LABELS: Record<'zh' | 'en', Record<ManualCategory, string>> = {
  zh: { image: '图片', video: '视频', tts: 'TTS 语音', music: '音乐', text: 'LLM/API', audio: '音频（待分类）' },
  en: { image: 'Image', video: 'Video', tts: 'TTS', music: 'Music', text: 'LLM/API', audio: 'Audio (unclassified)' },
};
const unitLabels = Object.fromEntries(Object.keys(UNIT_LABELS.en).map(key => [key, [UNIT_LABELS.zh[key as keyof typeof UNIT_LABELS.zh], UNIT_LABELS.en[key as keyof typeof UNIT_LABELS.en]]]));
const issues: Record<string, [string, string]> = {
  parameters: ['参数未确认：请填写分辨率、质量等可比参数，暂不排名。', 'Parameters unconfirmed: enter resolution, quality, etc. No ranking.'],
  model: ['缺少模型或共同场景，暂不排名。', 'Missing model or shared task. No ranking.'],
  'unclassified-audio': ['旧音频类型未区分 TTS/音乐，请先分类。', 'Legacy audio is unclassified; choose TTS or Music.'],
  'missing-price': ['必要价格缺失，不按免费计算。', 'Required price missing; not treated as free.'],
  'ambiguous-unit': ['存在重复或多个时间单价，请选择一个计价单位，不可重复累加。', 'Duplicate / alternative time rates: select one unit; they cannot be added.'],
  'unsupported-unit': ['价格单位与产品场景不一致。', 'Pricing unit does not match category.'],
  'exchange-rate': ['缺少有效汇率，无法报价。', 'Missing valid exchange rate.'],
  usage: ['用量缺失或无效，无法报价。', 'Missing or invalid usage.'],
  'invalid-price': ['价格格式或精度无效，请使用最多 12 位小数的十进制数。', 'Invalid price format/precision; use decimal notation with at most 12 fractional digits.'],
  'ambiguous-purchase': ['完整购包叠加与单套餐现金超额两种方式请选择一种。', 'Choose package stacking or single-package cash overage, not both.'],
  'ambiguous-price': ['阶梯与单独超额价不能同时应用，请选择一种规则。', 'Choose tiers or a standalone overage rate, not both.'],
  'unit-cost-unavailable': ['多分项或非线性费用没有统一单位成本，请切换总成本。', 'Multiple components or nonlinear fees have no combined unit cost; select total cost.'],
  'tier-rule': ['阶梯规则无效，需递增上限和完整单价。', 'Invalid tiers: require increasing bounds and complete rates.'],
  'allowance-missing': ['订阅或免费模式需明确填写各分项额度。', 'Subscriptions/free plans require explicit component allowances.'],
  'unsupported-billing': ['计费组合不受支持或免费套餐含非零固定费。', 'Unsupported billing combination or nonzero fee on a free plan.'],
  'billing-period': ['请在使用场景中选择匹配的月度或年度用量范围。', 'Select a matching monthly or annual usage period.'],
  'terms-unconfirmed': ['尚未确认积分能否叠加，购买金额未知。', 'Package combinability unconfirmed; purchase amount unavailable.'],
  'insufficient-quota': ['不可叠加且单套餐额度不足，无法完成本次用量。', 'A single non-combinable package cannot cover this usage.'],
  'package-limit': ['需要的套餐数量超过购买上限。', 'Required packages exceed the purchase limit.'],
  'invalid-package-limit': ['购买数量上限必须为正整数。', 'Package limit must be a positive integer.'],
  'plan-unconfirmed': ['尚未确认此套餐适用于当前模型和参数。', 'Plan eligibility for this model and parameters is unconfirmed.'],
  'credit-pool': ['规则与套餐积分池缺失或不一致。', 'Rule and plan credit pools are missing or different.'],
  'purchase-cycle': ['购买周期未明确，或周期不同；购买金额不混合排名。', 'Unconfirmed or different purchase commitments are not ranked together.'],
  'zero-usage': ['用量为零，不参与最低成本排名。', 'Zero usage: excluded from cost ranking.'],
};
export function ComparisonBasisControl({ value, onChange, zh }: { value: ComparisonBasis; onChange: (v: ComparisonBasis) => void; zh: boolean }) {
  return <div className="space-y-2"><label className="label">{zh ? '比较依据' : 'Comparison basis'}<select aria-label="Comparison basis" className="input mt-1" value={value} onChange={e => onChange(e.target.value as ComparisonBasis)}>
    <option value="same_unit">{zh ? '相同场景、参数和计价单位（默认）' : 'Same task, parameters and pricing unit (default)'}</option>
    <option value="same_usage">{zh ? '按相同用量比较总成本（允许秒/分钟换算）' : 'Total cost for equal usage (seconds/minutes convertible)'}</option>
  </select></label><p className="text-xs text-ink-2">{zh ? '默认只比较同一模型；跨模型时请填写相同的“共同场景”和参数。不同类别始终分组，输入/输出 Token 单价不相加。' : 'Same model by default. For different models, explicitly set the same shared task and parameters. Categories remain separate; input/output token unit prices are never added.'}</p></div>;
}
export function ComparisonMetricControl({ value, onChange, zh }: { value: ComparisonMetric; onChange: (v: ComparisonMetric) => void; zh: boolean }) {
  return <div className="mb-3"><label className="label">{zh ? '对比指标' : 'Comparison metric'}</label><select aria-label="Comparison metric" className="input" value={value} onChange={e => onChange(e.target.value as ComparisonMetric)}>
    <option value="scenario">{zh ? '本次预计消耗成本' : 'Estimated consumed cost'}</option>
    <option value="purchase">{zh ? '本次购买金额（预计）' : 'Purchase amount (estimated)'}</option>
    <option value="unit">{zh ? '目标币种单位成本' : 'Normalized unit cost'}</option>
  </select></div>;
}
export default function ManualComparisonResults({ rows, basis, metric = 'scenario', locale, chart = false }: { rows: ComparableRow[]; basis: ComparisonBasis; metric?: ComparisonMetric; locale: 'zh' | 'en'; chart?: boolean }) {
  const zh = locale === 'zh', groups = groupComparisons(rows, basis, metric);
  const format = (n: number | string | null, currency: string, exact?: ExactValue | null) => {
    if (n === null) return '—';
    if (n === '0' && exact && BigInt(exact.numerator) > 0n) return `<0.000000000001 ${currency}`;
    const text = typeof n === 'number' ? n.toLocaleString(undefined, { maximumFractionDigits: 6 }) : n.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    // Only group the integer portion of decimal-string financial values.
    const safe = typeof n === 'string' ? n.split('.').map((part, i) => i === 0 ? part.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : part).join('.') : text;
    return `${safe} ${currency}`;
  };
  const value = (r: ComparableRow) => metric === 'purchase' ? r.purchase.amount === null ? null : Number(r.purchase.amount) : metric === 'scenario' ? r.purchase.consumedAmount === null ? null : Number(r.purchase.consumedAmount) : r.unitCostExact ? Number(r.unitCostExact.numerator) / Number(r.unitCostExact.denominator) : r.convertedUnitCost;
  const displayValue = (r: ComparableRow) => format(metric === 'purchase' ? r.purchase.amount : metric === 'scenario' ? r.purchase.consumedAmount : r.unitCosts[0]?.convertedExact ?? r.convertedUnitCost, r.targetCurrency, metric === 'purchase' ? r.purchase.amountExact : metric === 'scenario' ? r.purchase.consumedExact : r.unitCostExact);
  const ratio = (r: ComparableRow) => metric === 'purchase' ? r.purchase.amountExact : metric === 'scenario' ? r.purchase.consumedExact : r.unitCostExact;
  return <section className="space-y-4" data-testid="comparison-results">
    <h2 className="font-display text-xl font-semibold">{zh ? '按场景分组的成本对比' : 'Cost comparison by task'}</h2>
    <p className="text-sm text-ink-2">{zh ? '每组独立比较，可切换消耗成本、购买金额和单位成本。积分套餐按零余额、新购同一种套餐计算；不跨套餐或积分池合并。不同购买周期不混排。直接计价包含已录入的固定费、免费额度、超额、阶梯及最低消费。' : 'Compare consumed cost, purchase amount or unit cost within each group. Credit packages assume zero starting balance and new purchases of one plan type; no combining different plans or credit pools. Different purchase commitments stay separate. Direct pricing applies entered fees, allowances, overage, tiers and minimum charges.'}</p>
    <p className="text-xs text-ink-2">{zh ? '金额为所填条件下的估算，不代表已扣款。计算保持精确，显示最多 12 位小数；图表比例仅用于展示。' : 'Amounts are estimates under entered terms, not completed charges. Exact arithmetic, displayed to at most 12 decimal places; chart proportions are visual approximations.'}</p>
    <p className="text-xs text-ink-2 sm:hidden">{zh ? '左右滑动表格，查看购买金额和剩余积分。' : 'Swipe the table horizontally to view purchase amounts and remaining credits.'}</p>
    {!rows.length && <p>{zh ? '请选择网站和模型，或添加价格规则。' : 'Select platforms and models, or add price rules.'}</p>}
    {groups.map(g => {
      const first = g.rows[0], values = g.rows.map(value).filter((n): n is number => n !== null), max = Math.max(...values, 0);
      const canRank = g.comparable && values.length > 1;
      const groupIssue = first.comparisonIssue ?? (metric==='unit'&&first.convertedUnitCost===null?'unit-cost-unavailable':null) ?? (metric === 'purchase' ? first.purchase.reason ?? (!first.purchaseComparisonKey ? 'purchase-cycle' : null) : null);
      const lowest = (r: ComparableRow) => { const a = ratio(r), b = ratio(first); return a && b ? fromExact(a).cmp(fromExact(b)) === 0 : value(r) !== null && value(r) === Math.min(...values); };
      return <section key={g.key} data-testid="comparison-group" data-category={first.category} className="card min-w-0 overflow-hidden">
        <div className="border-b border-line p-4"><h3 className="font-semibold">{MANUAL_CATEGORY_LABELS[locale][first.category]} · {first.comparisonScenario || first.modelName || '—'}</h3>
          <p className="text-xs text-ink-2">{first.parameters || (zh ? '参数未确认' : 'Unconfirmed parameters')} · {metric === 'unit' || basis === 'same_unit' ? first.unitCosts.map(u => unitLabels[u.unitType]?.[zh ? 0 : 1] ?? u.unitType).join(' + ') : (zh ? '相同场景用量' : 'Equal scenario usage')}{metric === 'purchase' && ` · ${first.purchase.cycle ?? (zh ? '按量结算' : 'usage billing')}`}</p>
          {groupIssue && <p className="mt-2 text-sm text-amber-700">{issues[groupIssue]?.[zh ? 0 : 1] ?? groupIssue}</p>}
        </div>
        <div className="space-y-3 border-b border-line p-3 md:hidden">{g.rows.map(r=><article data-testid={`mobile-receipt-${r.id}`} key={r.id} className="rounded-lg border border-line bg-surface-2/40 p-3">
          <h4 className="break-words text-sm font-semibold">{r.platformName} · {r.modelName}</h4>{r.planName&&<p className="mt-1 text-xs text-ink-2">{r.planName}</p>}
          <dl className="mt-3 grid grid-cols-2 gap-3 text-xs"><div><dt className="text-ink-2">{zh?'本次购买金额（预计）':'Purchase amount (estimated)'}</dt><dd className="mt-1 font-semibold text-primary">{format(r.purchase.amount,r.targetCurrency,r.purchase.amountExact)}</dd></div><div><dt className="text-ink-2">{zh?'预计消耗成本':'Consumed cost'}</dt><dd className="mt-1 font-semibold">{format(r.purchase.consumedAmount,r.targetCurrency,r.purchase.consumedExact)}</dd></div>
          {r.purchase.kind==='credits'&&<><div><dt className="text-ink-2">{zh?'消耗积分':'Credits consumed'}</dt><dd>{r.purchase.requiredCredits??'—'}</dd></div><div><dt className="text-ink-2">{zh?'购买套餐数':'Packages to buy'}</dt><dd>{r.purchase.packageCount??'—'}</dd></div><div className="col-span-2"><dt className="text-ink-2">{zh?'剩余积分':'Remaining credits'}</dt><dd>{r.purchase.remainingCredits??'—'} · {r.purchase.pool}</dd></div></>}
          </dl>{r.purchase.reason&&<p className="mt-2 text-xs text-amber-700">{issues[r.purchase.reason]?.[zh?0:1]??r.purchase.reason}</p>}
        </article>)}</div>
        <div className="overflow-x-auto"><table className="w-full min-w-[1400px] text-left text-sm"><thead className="bg-surface-2 text-ink-2"><tr>{[zh ? '组内序号' : 'Within group', zh ? '平台 / 模型' : 'Platform / model', zh ? '套餐' : 'Plan', zh ? '原币种单价（分项）' : 'Original prices (separate)', zh ? '目标币种单价（分项）' : 'Converted prices (separate)', zh ? '本次预计消耗成本' : 'Estimated consumed cost', zh ? '消耗积分' : 'Credits consumed', zh ? '购买套餐数' : 'Packages to buy', zh ? '本次购买金额（预计）' : 'Purchase amount (estimated)', zh ? '剩余积分' : 'Remaining credits'].map(label => <th className="px-4 py-3" key={label}>{label}</th>)}</tr></thead>
          <tbody className="divide-y divide-line">{g.rows.map((r, i) => <tr key={r.id} data-testid={`comparison-row-${r.id}`} className={canRank && lowest(r) ? 'bg-success-soft/40' : 'bg-surface'}>
            <td className="px-4 py-3">{g.comparable ? i + 1 : '—'}{canRank && lowest(r) && <span className="block text-xs text-success">{zh ? '组内最低' : 'Lowest in group'}</span>}</td>
            <td className="px-4 py-3"><strong>{r.platformName}</strong><div>{r.modelName}</div></td><td className="px-4 py-3">{r.planName || '—'}<div className="text-xs text-ink-2">{r.pricingMode === 'plan_credit_based' ? (zh ? '积分换算' : 'Credit conversion') : (zh ? '直接价格' : 'Direct price')}</div>{r.creditUnitCost != null && <div className="text-xs">{zh ? '每积分：' : 'Per credit: '}{format(r.creditUnitCostExact ?? r.creditUnitCost, r.sourceCurrency ?? r.originalCurrency ?? '')}</div>}</td>
            <td className="px-4 py-3">{r.unitCosts.map(u => <div key={u.unitType}>{unitLabels[u.unitType]?.[zh ? 0 : 1] ?? u.unitType}: {u.nonlinear?(zh?'按用量规则计费':'Usage rules apply'):format(u.originalExact ?? u.originalUnitCost, r.sourceCurrency ?? r.originalCurrency ?? '', u.originalRatio)}</div>)}</td>
            <td className="px-4 py-3">{r.unitCosts.map(u => <div key={u.unitType}>{unitLabels[u.unitType]?.[zh ? 0 : 1] ?? u.unitType}: {u.nonlinear?(zh?'按用量规则计费':'Usage rules apply'):format(u.convertedExact ?? u.convertedUnitCost, r.targetCurrency, u.convertedRatio)}</div>)}</td>
            <td data-testid="consumed-cost" className="px-4 py-3 font-semibold">{format(r.purchase.consumedAmount, r.targetCurrency, r.purchase.consumedExact)}</td>
            <td data-testid="credits-required" className="px-4 py-3">{r.purchase.requiredCredits ?? '—'}</td>
            <td data-testid="package-count" className="px-4 py-3">{r.purchase.packageCount ?? '—'}</td>
            <td className="max-w-64 px-4 py-3"><strong data-testid="purchase-amount">{format(r.purchase.amount, r.targetCurrency, r.purchase.amountExact)}</strong>{r.purchase.sourceAmount !== null && (r.sourceCurrency ?? r.originalCurrency) !== r.targetCurrency && <div className="text-xs text-ink-2">{format(r.purchase.sourceAmount, r.sourceCurrency ?? r.originalCurrency ?? '')}</div>}{r.purchase.reason && <p className="mt-1 text-xs text-amber-700">{issues[r.purchase.reason]?.[zh ? 0 : 1] ?? r.purchase.reason}</p>}</td>
            <td data-testid="credits-remaining" className="max-w-48 px-4 py-3">{r.purchase.remainingCredits ?? '—'}{r.purchase.kind === 'credits' && <div className="break-words text-xs text-ink-2">{r.purchase.pool}</div>}</td>
          </tr>)}</tbody></table></div>
        {chart && g.comparable && <div className="space-y-3 border-t border-line p-4"><h4 className="font-semibold">{zh ? '组内成本图' : 'Cost chart within group'}</h4>{values.length === 0 ? <p className="text-sm text-ink-2">{zh ? '多分项或非线性费用没有统一单位成本；请查看规则或切换场景总成本。' : 'Multiple components have no combined unit cost; view separate prices or select scenario totals.'}</p> : g.rows.map(r => <div key={r.id} className="grid gap-2 sm:grid-cols-[160px_1fr_150px] sm:items-center"><span className="truncate text-sm">{r.platformName} · {r.planName || r.modelName}</span><div className="h-6 rounded bg-surface-2"><div className="h-full rounded bg-primary" style={{ width: value(r) !== null && max > 0 ? `${Math.max(1, value(r)! / max * 100)}%` : '0%' }} /></div><span className="text-sm">{displayValue(r)}</span></div>)}</div>}
      </section>;
    })}
  </section>;
}
