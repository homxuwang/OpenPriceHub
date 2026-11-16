import { useEffect, useMemo, useState } from 'react';
import { useLocale } from '../i18n';
import { DiscoveryProvider, useDiscovery } from '../discovery/context';
import { alternatives, discover, savings, searchChoices } from '../../shared/discovery/engine';
import EntitySelect from '../discovery/EntitySelect';
import { BILLINGS, type Billing, type Request, type SearchSelection, type Unit } from '../../shared/discovery/types';
const reasons: Record<string, [string, string]> = {
  identity: ['身份关联不完整', 'Unresolved identity'], requirements: ['不满足必要条件', 'Required capability missing'], conditions: ['分辨率或质量条件不一致', 'Resolution / quality mismatch'], source: ['缺少有效来源', 'Missing source'], expired: ['价格过期', 'Expired price'], quantity: ['请输入有效用量', 'Enter usage'], 'missing-price': ['价格缺失，不能视为免费', 'Missing price — not free'], entitlement: ['额度或周期不完整', 'Missing entitlement / period'], unit: ['计量单位不一致', 'Incompatible units'], 'credit-pool': ['积分池或消耗规则不匹配', 'Credit pool mismatch'], 'unsupported-rule': ['规则尚不支持', 'Unsupported rule'], quota: ['超出额度且无超额规则', 'Quota exceeded; no overage rule'], 'invalid-price': ['价格或用量格式无效', 'Invalid price or quantity'],
};
const billingLabels: Record<Billing, [string, string]> = { free: ['免费', 'Free'], monthly: ['月付', 'Monthly'], annual: ['年付', 'Annual'], payg: ['按量', 'Pay As You Go'], credits: ['积分包', 'Credit-based'], package: ['用量包', 'Usage Package'], one_time: ['一次性', 'One-time'] };
const field = 'rounded-lg border border-line bg-surface p-2 w-full text-ink';
function Workspace() {
  const { catalog: c, error } = useDiscovery();
  const zh = useLocale() === 'zh';
  const t = (cn: string, en: string) => zh ? cn : en;
  const [experienceId, setExperienceId] = useState('image');
  const [usage, setUsage] = useState<Partial<Record<Unit, string>>>({ image: '10' });
  const [query, setQuery] = useState(''), [billing, setBilling] = useState<Billing[]>([]), [tag, setTag] = useState('');
  const [entities, setEntities] = useState<SearchSelection[]>([]);
  const [required, setRequired] = useState(false), [preferred, setPreferred] = useState(false);
  const [reference, setReference] = useState(''), [selected, setSelected] = useState<string[]>([]);
  const experience = c?.experiences.find(x => x.id === experienceId) ?? c?.experiences[0];
  useEffect(() => { if (experience) { setUsage(experience.usage); setSelected([]); setReference(''); setEntities([]); setQuery(''); } }, [experience]);
  const request: Request | null = experience ? { categoryId: experience.categoryId, usage, conditions: experience.conditions, criteria: [...experience.criteria, ...(required ? [{ attributeId: 'commercial', value: 'true', kind: 'required' as const }] : []), ...(preferred ? [{ attributeId: 'api', value: 'true', kind: 'preferred' as const }] : [])], query, selections: entities, billing, tagId: tag || undefined } : null;
  const rows = useMemo(() => c && request ? discover(c, request) : [], [c, experience, usage, query, entities, billing, tag, required, preferred]);
  const referenceRow = rows.find(x => x.plan.id === reference);
  const original = c?.offers.find(x => x.id === referenceRow?.plan.offerId)?.productId;
  const alts = c && request && original ? alternatives(c, original, request) : [];
  useEffect(() => { const previousTitle = document.title; document.title = 'OpenPriceHub — Tool Finder & Comparison'; const meta = document.createElement('meta'); meta.name = 'robots'; meta.content = 'noindex,nofollow'; document.head.append(meta); return () => { meta.remove(); document.title = previousTitle; }; }, []);
  if (error) return <div role="alert" className="p-6">{t('数据加载失败，没有回退到模拟报价：', 'Data load failed; no silent mock fallback: ')}{error}</div>;
  if (c && !experience) return <p className="p-6">{t('暂无配置的需求场景。', 'No discovery experiences configured.')}</p>;
  if (!c || !experience) return <p role="status" className="p-6">{t('加载数据…', 'Loading catalog…')}</p>;
  const price = (v: string | null, currency: string) => v === null ? '—' : `${currency} ${v}`;
  return <main className="mx-auto max-w-7xl px-4 py-8 space-y-6">
    <h1 className="text-2xl font-bold">{t('智能选型与比价', 'Tool Finder & Comparison')}</h1>
    <div role="note" data-testid="simulation" className="rounded-xl border border-amber-400 bg-amber-50 p-4 text-amber-950">{c.simulated ? t('模拟数据 · 全部产品和价格均为虚构测试数据，不是真实报价，不提供购买。', 'SIMULATED DATA · All products and prices are fictional test fixtures, not real quotations. No purchasing.') : t('API 数据 · 报价以来源及适用条件为准。', 'API data · Check source and applicable terms.')}</div>
    <section className="grid gap-4 rounded-xl border border-line bg-surface p-4 sm:grid-cols-2 lg:grid-cols-3">
      <label>{t('需求场景', 'Discovery experience')}<select aria-label="Discovery experience" className={field} value={experience.id} onChange={e => setExperienceId(e.target.value)}>{c.experiences.map(x => <option key={x.id} value={x.id}>{zh ? x.nameZh ?? x.name : x.name}</option>)}</select></label>
      <EntitySelect key={experience.id} choices={searchChoices(c, experience.categoryId)} selected={entities} query={query} onQuery={setQuery} onChange={setEntities} zh={zh} />
      <label>{t('标签', 'Tag')}<select aria-label="Tag" className={field} value={tag} onChange={e => setTag(e.target.value)}><option value="">{t('全部', 'All')}</option>{c.tags.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
      {Object.entries(usage).map(([unit, quantity]) => <label key={unit}>{t('月度用量', 'Monthly usage')} ({unit})<input aria-label={`Usage ${unit}`} inputMode="decimal" className={field} value={quantity} onChange={e => setUsage({ ...usage, [unit]: e.target.value })} /></label>)}
      <div className="space-y-2"><label className="block"><input type="checkbox" checked={required} onChange={e => setRequired(e.target.checked)} /> {t('必须支持商用', 'Require commercial use')}</label><label className="block"><input type="checkbox" checked={preferred} onChange={e => setPreferred(e.target.checked)} /> {t('偏好 API', 'Prefer API')}</label></div>
      <fieldset className="sm:col-span-2 lg:col-span-3"><legend>{t('付费模式（可多选）', 'Pricing models (multi-select)')}</legend><div className="flex flex-wrap gap-4">{BILLINGS.map(b => <label key={b}><input type="checkbox" aria-label={`Billing ${b}`} checked={billing.includes(b)} onChange={() => setBilling(billing.includes(b) ? billing.filter(x => x !== b) : [...billing, b])} /> {billingLabels[b][zh ? 0 : 1]}</label>)}</div></fieldset>
      <p className="text-sm text-ink-2 sm:col-span-2 lg:col-span-3">{t('按输入的一个月用量估算；年付为全年预付加本月超额费，不代表全年用量预测。套餐均假定从零余额新购。消耗成本是额度分摊估计，不是账单。', 'Estimates use one month of usage. Annual cash = annual prepayment plus this month’s overage, not a full-year forecast. Assumes new purchase with zero existing balance. Consumed cost is allocated usage value, not the bill.')} {Object.entries(experience.conditions).map(([k, v]) => `${k}: ${v}`).join(' · ')}</p>
    </section>
    <p role="status">{rows.length} {t('个方案；勾选比较并选择基准。仅同条件计算节省，不混合排名。', 'plans; select plans and a reference. Savings require compatible terms; no mixed-unit rankings.')}</p>
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{rows.map(({ plan, quote: q }) => {
      const offer = c.offers.find(x => x.id === plan.offerId)!, product = c.products.find(x => x.id === offer.productId)!, channel = c.channels.find(x => x.id === offer.channelId)!;
      const diff = referenceRow ? savings(referenceRow.quote, q) : null;
      return <article data-testid={`plan-${plan.id}`} key={plan.id} className="rounded-xl border border-line bg-surface p-4 space-y-3 min-w-0 break-words">
        <h2 className="font-bold">{product.name} · {plan.name}</h2><p className="text-sm">{channel.name} · {c.providers.find(x => x.id === channel.providerId)?.name} · {billingLabels[plan.billing][zh ? 0 : 1]}</p>
        <p className="text-xs text-ink-2">{c.models.find(x => x.id === offer.modelId)?.name} · {c.sources.find(x => x.id === plan.sourceId)?.label}</p>
        {q.status === 'blocked' ? <p role="status">{t('无法报价：', 'Cannot quote: ')}{reasons[q.reason!]?.[zh ? 0 : 1] ?? q.reason}</p> : <dl className="space-y-1 text-sm"><div>{t('实际购买金额', 'Purchase amount')}: <strong data-testid="purchase">{price(q.purchase, q.currency)}</strong></div><div>{t('预计消耗成本', 'Consumed cost')}: {price(q.consumed, q.currency)}</div><div>{t('剩余额度', 'Remaining')}: {q.remaining ? `${q.remaining.quantity} ${q.remaining.unit} ${q.remaining.poolId ?? ''}` : '—'}</div><div>{t('有效单位成本', 'Effective cost per requested unit')}: {price(q.effectiveUnitCost, q.currency)}</div>{q.monthlyEquivalent !== null && <div>{t('月均费用', 'Monthly equivalent')}: {price(q.monthlyEquivalent, q.currency)}</div>}</dl>}
        <p className="text-xs">{t('满足偏好', 'Preference matches')}: {q.preferredMatches} · {t('有效期至', 'Valid until')}: {plan.validUntil.slice(0, 10)}</p>
        <div className="flex flex-wrap gap-3"><label><input aria-label={`Compare ${plan.id}`} type="checkbox" checked={selected.includes(plan.id)} onChange={() => setSelected(selected.includes(plan.id) ? selected.filter(id => id !== plan.id) : [...selected, plan.id])} /> {t('比较', 'Compare')}</label><label><input aria-label={`Reference ${plan.id}`} type="radio" name="reference" checked={reference === plan.id} onChange={() => setReference(plan.id)} /> {t('基准 / 查看平替', 'Reference / alternatives')}</label></div>
        {selected.includes(plan.id) && referenceRow && <p data-testid="savings">{diff ? `${t('相对基准节省', 'Savings vs reference')}: ${q.currency} ${diff.amount} (${diff.percent ?? '—'}%)` : t('条件或付款周期不同，无法直接比较', 'Incompatible terms or commitment; cannot compare')}</p>}
      </article>;
    })}</div>
    {rows.length === 0 && <p>{t('没有匹配结果，请调整筛选。', 'No results. Adjust your filters.')}</p>}
    <section className="rounded-xl border border-line p-4 space-y-2"><h2 className="text-xl font-bold">{t('低价平替依据', 'Alternative evidence')}</h2>{!original ? <p>{t('先选择基准方案。', 'Choose a reference plan first.')}</p> : alts.length ? alts.map(a => <p key={a.plan.id}>{a.plan.name}: {a.reason} · {price(a.quote.purchase, a.quote.currency)}</p>) : <p>{t('没有已声明的定向平替关系。', 'No declared directional alternatives.')}</p>}</section>
    <p className="text-xs text-ink-2">{t('结果最多展示 12 位小数，四舍五入；内部运算保持精确。模拟场景不提供生成质量评分。', 'Results rounded half-up to at most 12 decimal places; exact internal arithmetic. No fabricated quality scores.')}</p>
  </main>;
}
export default function DiscoveryLab() { return <DiscoveryProvider><Workspace /></DiscoveryProvider>; }
