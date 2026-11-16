import { legacyDecimalText } from '../../shared/creditPurchase';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { completeDetailedSample } from '../../shared/calculatorSamples';
import { CalculatorImportPreview } from '../components/CalculatorImportPreview';
import { exportCalculator,previewCalculatorImport,type ImportPreview } from '../../shared/calculatorIo';
import { useLocale } from '../i18n';
import {
  buildDetailedComparisonRows,
  createDetailedSampleState,
  normalizeDetailedState,
  type DetailedCompareState,
  type DetailedModel,
  type DetailedPlan,
  type DetailedPlatform,
  type DetailedRule,
} from '../../shared/detailedCompare';
import {
  unitTypesForCategory,
  type ManualCategory,
  type ManualPricingMode,
} from '../../shared/manualCompare';
import ManualComparisonResults, { ComparisonBasisControl, ComparisonMetricControl, MANUAL_CATEGORY_LABELS } from '../components/ManualComparisonResults';
import { CalculatorScenarioFields } from '../components/CalculatorScenarioFields';
import { CalculatorFxEditor } from '../components/CalculatorFxEditor';
import { UnitRulesEditor, BillingTermsEditor, ExactPriceInput } from '../components/UnitRulesEditor';
import { CreditPurchaseFields, emptyCreditTerms } from '../components/CreditPurchaseFields';
import type { ComparisonBasis, ComparisonMetric } from '../../shared/manualComparisonGroups';
import type { Scenario } from '../../shared/types';
import { UNIT_LABELS, type ManualUnitDefinition as UnitDefinition, type BillingTerms } from '../../shared/manualUnits';

const STORAGE_KEY = 'oph.detailed-compare.v1';
type EntityTab = 'platforms' | 'plans' | 'models' | 'rules';
type ResultMetric = ComparisonMetric;

let sequence = 0;
function createId(prefix: string) {
  if (typeof globalThis.crypto?.randomUUID === 'function') return `${prefix}-${globalThis.crypto.randomUUID()}`;
  sequence += 1;
  return `${prefix}-${Date.now()}-${sequence}`;
}

function loadInitialState() {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    const normalized = saved ? normalizeDetailedState(JSON.parse(saved)) : null;
    if (normalized) return normalized;
  } catch {
    // Keep the calculator usable when storage is blocked.
  }
  return createDetailedSampleState();
}

const CATEGORY_LABELS = MANUAL_CATEGORY_LABELS;

function DetailedManualCompare({ category = null, modelId = null, platformId = null }: { category?: ManualCategory | null; modelId?: string | null; platformId?: string | null }) {
  const locale = useLocale();
  const zh = locale === 'zh';
  const tr = (chinese: string, english: string) => zh ? chinese : english;
  const [state, setState] = useState<DetailedCompareState>(loadInitialState);
  const [tab, setTab] = useState<EntityTab>('platforms');
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(() => state.platforms.map((entry) => entry.id));
  const [selectedModels, setSelectedModels] = useState<string[]>(() => state.models.map((entry) => entry.id));
  const [scenario, setScenario] = useState<Scenario>(() => ({ ...state.scenario }));
  const [targetCurrency, setTargetCurrency] = useState(state.targetCurrency);
  const [basis, setBasis] = useState<ComparisonBasis>('same_unit');
  const [metric, setMetric] = useState<ResultMetric>('scenario');
  const [generated, setGenerated] = useState(true);
  const [importPreview,setImportPreview]=useState<ImportPreview<DetailedCompareState>|null>(null);
  const [message, setMessage] = useState('');
  const importRef = useRef<HTMLInputElement>(null);

  const [platformDraft, setPlatformDraft] = useState({ id: '', name: '', defaultCurrency: 'CNY', notes: '' });
  const [planDraft, setPlanDraft] = useState<DetailedPlan>({
    id: '', platformId: state.platforms[0]?.id ?? '', name: '', price: 0, currency: 'CNY',
    billingCycle: 'monthly', creditAmount: 0, notes: '', creditPool: '', purchaseTerms: emptyCreditTerms(),
  });
  const [modelDraft, setModelDraft] = useState({ id: '', name: '', category: category ?? 'image' as ManualCategory });
  const [ruleDraft, setRuleDraft] = useState({
    id: '', platformId: state.platforms[0]?.id ?? '', modelId: state.models[0]?.id ?? '',
    pricingMode: 'plan_credit_based' as ManualPricingMode, currency: 'CNY', notes: '', parameters: '', comparisonScenario: '', selectedUnit: '' as UnitDefinition['unitType'] | '', creditPool: '', planIds: [] as string[],
    units: [] as UnitDefinition[], billingTerms:undefined as BillingTerms|undefined,
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore persistence errors.
    }
  }, [state]);

  const availableModels = state.models.filter(model => !category || model.category === category);
  useEffect(() => { setSelectedModels(state.models.filter(model => (!category || model.category === category) && (!modelId || model.id === modelId)).map(model => model.id)); }, [category, modelId]);
  useEffect(() => { if (platformId) setSelectedPlatforms(state.platforms.filter(platform => platform.id === platformId).map(platform => platform.id)); }, [platformId]);
  const rows = useMemo(() => generated ? buildDetailedComparisonRows(state, {
    platformIds: selectedPlatforms,
    modelIds: selectedModels.filter(id => availableModels.some(model => model.id === id)),
    scenario,
    targetCurrency,
  }) : [], [generated, selectedModels, selectedPlatforms, scenario, state, targetCurrency, category]);

  const activeRuleModel = state.models.find((entry) => entry.id === ruleDraft.modelId);
  const ruleUnits = activeRuleModel ? unitTypesForCategory(activeRuleModel.category) : [];

  const notify = (value: string) => {
    setMessage(value);
    window.setTimeout(() => setMessage(''), 3000);
  };

  const savePlatform = (event: React.FormEvent) => {
    event.preventDefault();
    const item: DetailedPlatform = {
      id: platformDraft.id || createId('platform'),
      name: platformDraft.name.trim(),
      defaultCurrency: platformDraft.defaultCurrency,
      notes: platformDraft.notes.trim(),
    };
    if (!item.name) return;
    setState((current) => ({
      ...current,
      platforms: platformDraft.id
        ? current.platforms.map((entry) => entry.id === item.id ? item : entry)
        : [...current.platforms, item],
    }));
    if (!platformDraft.id) setSelectedPlatforms((current) => [...current, item.id]);
    setPlatformDraft({ id: '', name: '', defaultCurrency: 'CNY', notes: '' });
    notify(tr('网站已保存', 'Platform saved'));
  };

  const savePlan = (event: React.FormEvent) => {
    event.preventDefault();
    if (!planDraft.platformId || !planDraft.name.trim() || planDraft.price <= 0) return;
    const item: DetailedPlan = { ...planDraft, id: planDraft.id || createId('plan'), name: planDraft.name.trim() };
    setState((current) => ({
      ...current,
      rules: current.rules.map(rule => rule.planIds?.includes(item.id) && rule.platformId !== item.platformId ? { ...rule, planIds: rule.planIds.filter(id => id !== item.id) } : rule),
      plans: planDraft.id
        ? current.plans.map((entry) => entry.id === item.id ? item : entry)
        : [...current.plans, item],
    }));
    setPlanDraft({ id: '', platformId: planDraft.platformId, name: '', price: 0, currency: 'CNY', billingCycle: 'monthly', creditAmount: 0, notes: '', creditPool: '', purchaseTerms: emptyCreditTerms() });
    notify(tr('套餐已保存', 'Plan saved'));
  };

  const saveModel = (event: React.FormEvent) => {
    event.preventDefault();
    if (!modelDraft.name.trim()) return;
    const item: DetailedModel = { ...modelDraft, id: modelDraft.id || createId('model'), name: modelDraft.name.trim() };
    setState((current) => ({
      ...current,
      models: modelDraft.id
        ? current.models.map((entry) => entry.id === item.id ? item : entry)
        : [...current.models, item],
    }));
    if (!modelDraft.id) setSelectedModels((current) => [...current, item.id]);
    setModelDraft({ id: '', name: '', category: 'image' });
    notify(tr('模型已保存', 'Model saved'));
  };

  const saveRule = (event: React.FormEvent) => {
    event.preventDefault();
    if (!activeRuleModel || !ruleDraft.platformId) return;
    const unitDefinitions = ruleDraft.units.filter(unit=>unit.value!==null||unit.exactValue!=null||unit.included!==undefined||!!unit.tiers?.length);
    if (unitDefinitions.length === 0) {
      notify(tr('请至少填写一个有效消耗或单价', 'Enter at least one valid usage or price'));
      return;
    }
    if (ruleDraft.pricingMode === 'plan_credit_based'
      && !state.plans.some((entry) => entry.platformId === ruleDraft.platformId)) {
      notify(tr('积分模式需要先为该网站录入套餐', 'Credit mode requires a plan for this platform'));
      return;
    }
    const item: DetailedRule = {
      id: ruleDraft.id || createId('rule'),
      platformId: ruleDraft.platformId,
      modelId: ruleDraft.modelId,
      pricingMode: ruleDraft.pricingMode,
      currency: ruleDraft.currency,
      unitDefinitions, billingTerms:ruleDraft.billingTerms,
      creditPool: ruleDraft.creditPool.trim(), planIds: ruleDraft.planIds,
      notes: ruleDraft.notes, parameters: ruleDraft.parameters, comparisonScenario: ruleDraft.comparisonScenario, selectedUnit: ruleDraft.selectedUnit || undefined,
    };
    setState((current) => ({
      ...current,
      rules: ruleDraft.id
        ? current.rules.map((entry) => entry.id === item.id ? item : entry)
        : [...current.rules, item],
    }));
    setRuleDraft((current) => ({ ...current, id: '', notes: '', units: [] }));
    notify(tr('模型价格已保存', 'Model price saved'));
  };

  const remove = (type: EntityTab, id: string) => {
    if (!window.confirm(tr('确定删除？相关数据也会一并清理。', 'Delete this item and related data?'))) return;
    setState((current) => {
      if (type === 'platforms') return {
        ...current,
        platforms: current.platforms.filter((entry) => entry.id !== id),
        plans: current.plans.filter((entry) => entry.platformId !== id),
        rules: current.rules.filter((entry) => entry.platformId !== id),
      };
      if (type === 'plans') return { ...current, plans: current.plans.filter((entry) => entry.id !== id), rules: current.rules.map(rule => ({ ...rule, planIds: rule.planIds?.filter(planId => planId !== id) })) };
      if (type === 'models') return {
        ...current,
        models: current.models.filter((entry) => entry.id !== id),
        rules: current.rules.filter((entry) => entry.modelId !== id),
      };
      return { ...current, rules: current.rules.filter((entry) => entry.id !== id) };
    });
    if (type === 'platforms') setSelectedPlatforms((current) => current.filter((entry) => entry !== id));
    if (type === 'models') setSelectedModels((current) => current.filter((entry) => entry !== id));
  };

  const edit = (type: EntityTab, id: string) => {
    setTab(type);
    if (type === 'platforms') {
      const item = state.platforms.find((entry) => entry.id === id);
      if (item) setPlatformDraft(item);
    } else if (type === 'plans') {
      const item = state.plans.find((entry) => entry.id === id);
      if (item) setPlanDraft(item);
    } else if (type === 'models') {
      const item = state.models.find((entry) => entry.id === id);
      if (item) setModelDraft(item);
    } else {
      const item = state.rules.find((entry) => entry.id === id);
      if (item) setRuleDraft({
        ...item, parameters: item.parameters ?? '', comparisonScenario: item.comparisonScenario ?? '', selectedUnit: item.selectedUnit ?? '', creditPool: item.creditPool ?? '', planIds: item.planIds ?? [],
        units:item.unitDefinitions, billingTerms:item.billingTerms,
      });
    }
  };

  const loadSample = () => {
    const sample = createDetailedSampleState();
    setState(sample);
    setScenario({ ...sample.scenario });
    setTargetCurrency(sample.targetCurrency);
    setSelectedPlatforms(sample.platforms.map((entry) => entry.id));
    setSelectedModels(sample.models.map((entry) => entry.id));
    setGenerated(true);
    notify(tr('示例数据已载入', 'Sample data loaded'));
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(exportCalculator('detailed',state), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'openpricehub-detailed-compare.json';
    link.click();
    URL.revokeObjectURL(url);
  };

  const importJson = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      if(file.size>2*1024*1024)throw Error('File exceeds 2 MB / 文件超过 2 MB');
      setImportPreview(previewCalculatorImport(JSON.parse(await file.text()),'detailed'));
    } catch(error) {
      notify(tr('导入失败：','Import failed: ')+String(error instanceof Error?error.message:error));
    }
  };

  const confirmImport=()=>{if(!importPreview)return;try{const imported=importPreview.data;localStorage.setItem('oph.detailed-compare.import-backup',JSON.stringify(state));localStorage.setItem(STORAGE_KEY,JSON.stringify(imported));setState(imported);setScenario({...imported.scenario});setTargetCurrency(imported.targetCurrency);setSelectedPlatforms(imported.platforms.map(p=>p.id));setSelectedModels(imported.models.map(m=>m.id));setGenerated(true);setImportPreview(null);notify(tr('导入成功，已备份上一版。','Imported; previous state backed up.'));}catch{notify(tr('存储失败，未覆盖当前数据。','Storage failed; current data was not replaced.'));}};
  const updateTargetCurrency = (value: string) => { setTargetCurrency(value); setState(current => ({ ...current, targetCurrency: value })); };
  const toggle = (id: string, values: string[], setter: React.Dispatch<React.SetStateAction<string[]>>) =>
    setter(values.includes(id) ? values.filter((entry) => entry !== id) : [...values, id]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {[
            [tr('网站', 'Platforms'), state.platforms.length],
            [tr('套餐', 'Plans'), state.plans.length],
            [tr('模型', 'Models'), state.models.length],
            [tr('价格规则', 'Rules'), state.rules.length],
            [tr('结果币种', 'Currency'), targetCurrency],
          ].map(([label, value]) => (
            <div className="card px-4 py-3" key={label}>
              <div className="text-xs text-ink-2">{label}</div>
              <div className="mt-1 font-display text-lg font-bold text-ink">{value}</div>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-secondary" type="button" onClick={loadSample}>{tr('载入示例', 'Load sample')}</button>
          <button className="btn-secondary" type="button" onClick={() => importRef.current?.click()}>{tr('导入 JSON', 'Import JSON')}</button>
          <button className="btn-secondary" type="button" onClick={()=>{setImportPreview(previewCalculatorImport(exportCalculator('detailed',completeDetailedSample()),'detailed'));}}>{tr('载入完整计价示例','Load full pricing examples')}</button>
          <button className="btn-secondary" type="button" onClick={exportJson}>{tr('导出 JSON', 'Export JSON')}</button>
          <button className="btn-ghost" type="button" onClick={()=>{try{const raw=localStorage.getItem('oph.detailed-compare.import-backup');if(!raw)throw Error(tr('暂无备份。','No backup available.'));setImportPreview(previewCalculatorImport(JSON.parse(raw),'detailed'));}catch(error){notify(String(error instanceof Error?error.message:error));}}}>{tr('预览上次备份','Preview previous backup')}</button>
          <input ref={importRef} type="file" className="hidden" accept="application/json" onChange={importJson} />
        </div>
      </div>

      <p role="note" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">{tr('示例价格为模拟数据；手动录入的数据未经官方核验。', 'Sample prices are simulated; manually entered prices are not officially verified.')}</p>
      {message && <div className="rounded-lg border border-primary-200 bg-primary-50 px-4 py-3 text-sm text-primary-700" role="status">{message}</div>}

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
        <section className="card overflow-hidden">
          <div className="border-b border-line px-5 py-4">
            <h2 className="font-display text-lg font-semibold text-ink">{tr('数据录入', 'Data entry')}</h2>
            <p className="mt-1 text-sm text-ink-2">{tr('按网站 → 套餐 → 模型 → 模型价格的顺序录入。', 'Enter platforms, plans, models, then model prices.')}</p>
          </div>
          <div className="flex overflow-x-auto border-b border-line px-3 pt-3">
            {([
              ['platforms', tr('1. 网站', '1. Platforms')],
              ['plans', tr('2. 套餐', '2. Plans')],
              ['models', tr('3. 模型', '3. Models')],
              ['rules', tr('4. 模型价格', '4. Model prices')],
            ] as [EntityTab, string][]).map(([value, label]) => (
              <button key={value} type="button" onClick={() => setTab(value)}
                className={`whitespace-nowrap border-b-2 px-4 py-3 text-sm font-semibold ${tab === value ? 'border-primary text-primary' : 'border-transparent text-ink-2'}`}>
                {label}
              </button>
            ))}
          </div>
          <div className="p-5">
            {tab === 'platforms' && (
              <form className="grid gap-4 sm:grid-cols-2" onSubmit={savePlatform}>
                <TextInput label={tr('网站名', 'Platform name')} value={platformDraft.name}
                  onChange={(name) => setPlatformDraft((current) => ({ ...current, name }))} />
                <SelectInput label={tr('默认币种', 'Default currency')} value={platformDraft.defaultCurrency}
                  options={Object.keys(state.rates).map((value) => ({ value, label: value }))}
                  onChange={(defaultCurrency) => setPlatformDraft((current) => ({ ...current, defaultCurrency }))} />
                <div className="sm:col-span-2">
                  <TextInput label={tr('备注', 'Notes')} value={platformDraft.notes}
                    onChange={(notes) => setPlatformDraft((current) => ({ ...current, notes }))} />
                </div>
                <button className="btn-primary sm:col-span-2" type="submit">{platformDraft.id ? tr('更新网站', 'Update platform') : tr('保存网站', 'Save platform')}</button>
              </form>
            )}

            {tab === 'plans' && (
              <form className="grid gap-4 sm:grid-cols-2" onSubmit={savePlan}>
                <SelectInput label={tr('所属网站', 'Platform')} value={planDraft.platformId}
                  options={state.platforms.map((entry) => ({ value: entry.id, label: entry.name }))}
                  onChange={(platformId) => setPlanDraft((current) => ({ ...current, platformId }))} />
                <TextInput label={tr('套餐名', 'Plan name')} value={planDraft.name}
                  onChange={(name) => setPlanDraft((current) => ({ ...current, name }))} />
                <ExactPriceInput label={tr('价格','Price')} value={planDraft.priceExact??legacyDecimalText(planDraft.price)} onChange={priceExact=>setPlanDraft(current=>({...current,priceExact,price:Number(priceExact)||0}))}/>
                <SelectInput label={tr('币种', 'Currency')} value={planDraft.currency}
                  options={Object.keys(state.rates).map((value) => ({ value, label: value }))}
                  onChange={(currency) => setPlanDraft((current) => ({ ...current, currency }))} />
                <SelectInput label={tr('周期', 'Billing cycle')} value={planDraft.billingCycle}
                  options={['monthly', 'yearly', 'one_time', 'custom'].map((value) => ({ value, label: value }))}
                  onChange={(billingCycle) => setPlanDraft((current) => ({ ...current, billingCycle: billingCycle as DetailedPlan['billingCycle'] }))} />
                <ExactPriceInput label={tr('积分数量','Credits')} value={planDraft.creditAmountExact??legacyDecimalText(planDraft.creditAmount)} onChange={creditAmountExact=>setPlanDraft(current=>({...current,creditAmountExact,creditAmount:Number(creditAmountExact)||0}))}/>
                <TextInput label={tr('套餐积分池名称', 'Plan credit pool name')} value={planDraft.creditPool ?? ''} onChange={creditPool => setPlanDraft(current => ({ ...current, creditPool }))} />
                <CreditPurchaseFields terms={planDraft.purchaseTerms} onChange={purchaseTerms => setPlanDraft(current => ({ ...current, purchaseTerms }))} zh={zh} prefix="detailed-plan" />
                <button className="btn-primary sm:col-span-2" type="submit">{planDraft.id ? tr('更新套餐', 'Update plan') : tr('保存套餐', 'Save plan')}</button>
              </form>
            )}

            {tab === 'models' && (
              <form className="grid gap-4 sm:grid-cols-2" onSubmit={saveModel}>
                <TextInput label={tr('模型名', 'Model name')} value={modelDraft.name}
                  onChange={(name) => setModelDraft((current) => ({ ...current, name }))} />
                <SelectInput label={tr('模型类型', 'Category')} value={modelDraft.category}
                  options={(Object.keys(CATEGORY_LABELS[locale]) as ManualCategory[]).map((value) => ({ value, label: CATEGORY_LABELS[locale][value] }))}
                  onChange={(category) => setModelDraft((current) => ({ ...current, category: category as ManualCategory }))} />
                <button className="btn-primary sm:col-span-2" type="submit">{modelDraft.id ? tr('更新模型', 'Update model') : tr('保存模型', 'Save model')}</button>
              </form>
            )}

            {tab === 'rules' && (
              <form className="grid gap-4 sm:grid-cols-2" onSubmit={saveRule}>
                <SelectInput label={tr('网站', 'Platform')} value={ruleDraft.platformId}
                  options={state.platforms.map((entry) => ({ value: entry.id, label: entry.name }))}
                  onChange={(platformId) => setRuleDraft((current) => ({ ...current, platformId, planIds: [], creditPool: '' }))} />
                <SelectInput label={tr('模型', 'Model')} value={ruleDraft.modelId}
                  options={state.models.map((entry) => ({ value: entry.id, label: `${entry.name} · ${CATEGORY_LABELS[locale][entry.category]}` }))}
                  onChange={(modelId) => setRuleDraft((current) => ({ ...current, modelId, selectedUnit: '', units: [] }))} />
                <SelectInput label={tr('计费模式', 'Pricing mode')} value={ruleDraft.pricingMode}
                  options={[
                    { value: 'plan_credit_based', label: tr('积分换算', 'Plan credits') },
                    { value: 'direct_price_based', label: tr('直接价格', 'Direct price') },
                  ]}
                  onChange={(pricingMode) => setRuleDraft((current) => ({ ...current, pricingMode: pricingMode as ManualPricingMode, billingTerms:undefined }))} />
                {ruleDraft.pricingMode === 'direct_price_based' && (
                  <SelectInput label={tr('直接价格币种', 'Direct price currency')} value={ruleDraft.currency}
                    options={Object.keys(state.rates).map((value) => ({ value, label: value }))}
                    onChange={(currency) => setRuleDraft((current) => ({ ...current, currency }))} />
                )}
                <TextInput label={tr('可比参数（必填才排名）', 'Comparable parameters (required for ranking)')} value={ruleDraft.parameters} onChange={parameters => setRuleDraft(current => ({ ...current, parameters }))} />
                <TextInput label={tr('共同场景（跨模型比较时填写）', 'Shared task (for comparison across models)')} value={ruleDraft.comparisonScenario} onChange={comparisonScenario => setRuleDraft(current => ({ ...current, comparisonScenario }))} />
                {activeRuleModel && activeRuleModel.category!=='text' && <SelectInput label={tr('本次采用的计价单位', 'Pricing unit used for this quote')} value={ruleDraft.selectedUnit} options={[{ value: '', label: tr('自动（仅一个已填写单价时）', 'Automatic (only one populated rate)') }, ...ruleUnits.map(u => ({ value: u, label: UNIT_LABELS[locale][u] }))]} onChange={selectedUnit => setRuleDraft(current => ({ ...current, selectedUnit: selectedUnit as UnitDefinition['unitType'] | '' }))} />}
                {activeRuleModel?.category==='text'&&<SelectInput label={tr('Token 分项或原始积分','Token components or raw credits')} value={ruleDraft.selectedUnit} options={[{value:'',label:tr('Token 分项','Token components')},{value:'per_credit',label:tr('原始积分','Raw credits')}]} onChange={selectedUnit=>setRuleDraft(current=>({...current,selectedUnit:selectedUnit as ''|'per_credit'}))}/>}
                {ruleDraft.pricingMode === 'plan_credit_based' && <>
                  <TextInput label={tr('本规则使用的积分池', 'Credit pool used by this rule')} value={ruleDraft.creditPool} onChange={creditPool => setRuleDraft(current => ({ ...current, creditPool }))} />
                  <fieldset className="rounded-lg border border-line p-3 sm:col-span-2"><legend className="text-sm font-semibold">{tr('已确认适用的套餐（可多选）', 'Confirmed eligible plans (multi-select)')}</legend><p className="mb-2 text-xs text-ink-2">{tr('只选择已确认支持此模型及参数的套餐；积分池必须与套餐一致。未确认的旧数据不计算购买金额。', 'Select only plans confirmed for this model and parameters; credit pool names must match. Unconfirmed legacy data has no purchase quote.')}</p>
                    {state.plans.filter(plan => plan.platformId === ruleDraft.platformId).map(plan => <label className="mr-3 inline-flex items-center gap-2 text-sm" key={plan.id}><input type="checkbox" aria-label={`Eligible plan ${plan.id}`} checked={ruleDraft.planIds.includes(plan.id)} onChange={() => setRuleDraft(current => ({ ...current, planIds: current.planIds.includes(plan.id) ? current.planIds.filter(id => id !== plan.id) : [...current.planIds, plan.id] }))} />{plan.name}</label>)}
                  </fieldset>
                </>}
                <UnitRulesEditor units={ruleUnits} value={ruleDraft.units} onChange={units=>setRuleDraft(current=>({...current,units}))} zh={zh} prefix="Rule unit price" credits={ruleDraft.pricingMode==='plan_credit_based'}/>
                {ruleDraft.pricingMode==='direct_price_based'&&<><BillingTermsEditor value={ruleDraft.billingTerms} onChange={billingTerms=>setRuleDraft(current=>({...current,billingTerms}))} zh={zh}/><TextInput label={tr('按积分计价的积分池','Pool for per-credit pricing')} value={ruleDraft.creditPool} onChange={creditPool=>setRuleDraft(current=>({...current,creditPool}))}/></>}
                <button className="btn-primary sm:col-span-2" type="submit">{ruleDraft.id ? tr('更新模型价格', 'Update model price') : tr('保存模型价格', 'Save model price')}</button>
              </form>
            )}

            <SavedItems
              type={tab}
              state={state}
              locale={locale}
              onEdit={edit}
              onRemove={remove}
            />
          </div>
        </section>

        <div className="space-y-4">
          <section className="card p-5">
            <h2 className="font-display font-semibold text-ink">{tr('整体参数', 'Global settings')}</h2>
            <div className="mt-4"><CalculatorFxEditor value={state} onChange={fx=>setState(current=>({...current,...fx}))} zh={zh}/></div>
            <div className="mt-4">
              <SelectInput label={tr('结果币种', 'Target currency')} value={targetCurrency}
                options={Object.keys(state.rates).map((value) => ({ value, label: value }))}
                onChange={updateTargetCurrency} />
            </div>
          </section>

          <section className="card p-5">
            <h2 className="font-display font-semibold text-ink">{tr('对比设置', 'Comparison settings')}</h2>
            <FilterList title={tr('选择网站', 'Select platforms')} items={state.platforms}
              selected={selectedPlatforms} onToggle={(id) => toggle(id, selectedPlatforms, setSelectedPlatforms)}
              onAll={() => setSelectedPlatforms(state.platforms.map((entry) => entry.id))} onNone={() => setSelectedPlatforms([])} />
            <FilterList title={tr('选择模型', 'Select models')} items={availableModels}
              selected={selectedModels} onToggle={(id) => toggle(id, selectedModels, setSelectedModels)}
              onAll={() => setSelectedModels(availableModels.map((entry) => entry.id))} onNone={() => setSelectedModels([])} />
            <div className="mt-4"><CalculatorScenarioFields value={scenario} onChange={next=>{setScenario(next);setState(current=>({...current,scenario:next}));}} zh={zh} category={category}/></div>
            <div className="mt-4">
              <ComparisonBasisControl value={basis} onChange={setBasis} zh={zh} />
              <ComparisonMetricControl value={metric} onChange={setMetric} zh={zh} />
            </div>
            <button className="btn-primary mt-4 w-full" type="button"
              disabled={selectedPlatforms.length === 0 || selectedModels.length === 0}
              onClick={() => setGenerated(true)}>
              {tr('生成对比表和图表', 'Generate table and chart')}
            </button>
          </section>
        </div>
      </div>

      <details className="card p-5">
        <summary className="cursor-pointer font-display font-semibold text-ink">
          {tr('查看计算说明', 'View calculation formulas')}
        </summary>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {[
            {
              title: tr('积分套餐折算', 'Plan credit conversion'),
              formula: tr('每积分成本 = 套餐价格 ÷ 套餐总积分', 'Cost per credit = plan price ÷ total credits'),
            },
            {
              title: tr('模型单位成本', 'Model unit cost'),
              formula: tr('单位成本 = 每积分成本 × 每单位消耗积分', 'Unit cost = cost per credit × credits per unit'),
            },
            {
              title: tr('汇率换算', 'Currency conversion'),
              formula: tr('目标成本 = 原币种成本 × 原币种汇率 ÷ 目标币种汇率', 'Target cost = source cost × source rate ÷ target rate'),
            },
          ].map((item) => (
            <div className="rounded-lg border border-line bg-surface-2/60 p-4" key={item.title}>
              <div className="text-sm font-semibold text-ink">{item.title}</div>
              <code className="mt-2 block whitespace-normal text-xs leading-5 text-ink-2">{item.formula}</code>
            </div>
          ))}
        </div>
      </details>

      {importPreview&&<CalculatorImportPreview preview={importPreview} currentCount={state.rules.length} onConfirm={confirmImport} onCancel={()=>setImportPreview(null)} zh={zh}/>}
      <ManualComparisonResults rows={rows} basis={basis} metric={metric} locale={locale} chart />
    </div>
  );
}

function TextInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <div><label className="label">{label}</label><input className="input" value={value} onChange={(event) => onChange(event.target.value)} /></div>;
}

function SelectInput({ label, value, options, onChange }: {
  label: string; value: string; options: { value: string; label: string }[]; onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <select className="input" value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">—</option>
        {options.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
      </select>
    </div>
  );
}

function FilterList({ title, items, selected, onToggle, onAll, onNone }: {
  title: string; items: { id: string; name: string }[]; selected: string[];
  onToggle: (id: string) => void; onAll: () => void; onNone: () => void;
}) {
  return (
    <div className="mt-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="label mb-0">{title}</span>
        <span className="flex gap-2 text-xs"><button type="button" className="text-primary" onClick={onAll}>All</button><button type="button" className="text-ink-2" onClick={onNone}>None</button></span>
      </div>
      <div className="max-h-36 space-y-1 overflow-y-auto rounded-lg border border-line p-2">
        {items.map((item) => (
          <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-surface-2" key={item.id}>
            <input type="checkbox" checked={selected.includes(item.id)} onChange={() => onToggle(item.id)} />
            <span>{item.name}</span>
          </label>
        ))}
        {items.length === 0 && <div className="px-2 py-3 text-sm text-ink-2">—</div>}
      </div>
    </div>
  );
}

function SavedItems({ type, state, locale, onEdit, onRemove }: {
  type: EntityTab; state: DetailedCompareState; locale: 'zh' | 'en';
  onEdit: (type: EntityTab, id: string) => void; onRemove: (type: EntityTab, id: string) => void;
}) {
  const items = type === 'platforms' ? state.platforms : type === 'plans' ? state.plans : type === 'models' ? state.models : state.rules;
  return (
    <div className="mt-6 border-t border-line pt-5">
      <h3 className="mb-3 text-sm font-semibold text-ink">{locale === 'zh' ? '已保存' : 'Saved'}</h3>
      <div className="space-y-2">
        {items.map((item) => {
          const title = 'name' in item ? item.name : state.models.find((model) => model.id === item.modelId)?.name ?? '—';
          const meta = type === 'platforms' ? (item as DetailedPlatform).defaultCurrency
            : type === 'plans' ? `${(item as DetailedPlan).price} ${(item as DetailedPlan).currency} · ${state.platforms.find((entry) => entry.id === (item as DetailedPlan).platformId)?.name ?? '—'}`
              : type === 'models' ? CATEGORY_LABELS[locale][(item as DetailedModel).category]
                : `${state.platforms.find((entry) => entry.id === (item as DetailedRule).platformId)?.name ?? '—'} · ${(item as DetailedRule).pricingMode === 'plan_credit_based' ? (locale === 'zh' ? '积分换算' : 'Credits') : (locale === 'zh' ? '直接价格' : 'Direct')}`;
          return (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-line bg-surface-2/50 px-3 py-2" key={item.id}>
              <div className="min-w-0"><div className="truncate text-sm font-semibold text-ink">{title}</div><div className="truncate text-xs text-ink-2">{meta}</div></div>
              <div className="flex gap-1">
                <button className="btn-ghost px-2 py-1 text-xs" type="button" onClick={() => onEdit(type, item.id)}>{locale === 'zh' ? '编辑' : 'Edit'}</button>
                <button className="btn-ghost px-2 py-1 text-xs text-danger" type="button" onClick={() => onRemove(type, item.id)}>{locale === 'zh' ? '删除' : 'Delete'}</button>
              </div>
            </div>
          );
        })}
        {items.length === 0 && <div className="text-sm text-ink-2">{locale === 'zh' ? '暂无数据' : 'No data'}</div>}
      </div>
    </div>
  );
}

export default DetailedManualCompare;
