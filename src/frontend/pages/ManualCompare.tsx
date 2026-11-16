import { legacyDecimalText } from '../../shared/creditPurchase';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { completeQuickSample } from '../../shared/calculatorSamples';
import { CalculatorImportPreview } from '../components/CalculatorImportPreview';
import { exportCalculator, previewCalculatorImport, quickToDetailed, readDetailedForTransfer, type ImportPreview } from '../../shared/calculatorIo';
import type { DetailedCompareState } from '../../shared/detailedCompare';
import { useLocale } from '../i18n';
import {
  calculateManualComparison,
  createManualItem,
  createManualSampleState,
  normalizeManualState,
  unitTypesForCategory,
  type ManualCategory,
  type ManualCompareState,
  type ManualPriceItem,
  type ManualPricingMode,
} from '../../shared/manualCompare';
import ManualComparisonResults, { ComparisonBasisControl, ComparisonMetricControl, MANUAL_CATEGORY_LABELS } from '../components/ManualComparisonResults';
import { CalculatorScenarioFields } from '../components/CalculatorScenarioFields';
import { CalculatorFxEditor } from '../components/CalculatorFxEditor';
import { UnitRulesEditor, BillingTermsEditor, ExactPriceInput } from '../components/UnitRulesEditor';
import { CreditPurchaseFields, PurchaseCycleField } from '../components/CreditPurchaseFields';
import type { ComparisonBasis, ComparisonMetric } from '../../shared/manualComparisonGroups';
import { UNIT_LABELS, type ManualUnitDefinition as UnitDefinition } from '../../shared/manualUnits';

const STORAGE_KEY = 'oph.manual-compare.v1';

let idSequence = 0;
function createId() {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID();
  idSequence += 1;
  return `manual-${Date.now()}-${idSequence}`;
}

function initialState() {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    const normalized = saved ? normalizeManualState(JSON.parse(saved)) : null;
    if (normalized) return normalized;
  } catch {
    // Storage can be unavailable in private browsing.
  }
  return createManualSampleState(createId(), createId());
}

const CATEGORY_LABELS = MANUAL_CATEGORY_LABELS;
const MODE_LABELS = {
  zh: { plan_credit_based: '积分换算', direct_price_based: '直接价格' },
  en: { plan_credit_based: 'Plan credits', direct_price_based: 'Direct price' },
};

function ManualCompare({ category = null, onSavedToDetailed }: { category?: ManualCategory | null; onSavedToDetailed?:()=>void }) {
  const locale = useLocale();
  const zh = locale === 'zh';
  const tr = (chinese: string, english: string) => zh ? chinese : english;
  const [state, setState] = useState<ManualCompareState>(initialState);
  const [metric, setMetric] = useState<ComparisonMetric>('scenario');
  const [basis, setBasis] = useState<ComparisonBasis>('same_unit');
  const [importPreview,setImportPreview]=useState<ImportPreview<ManualCompareState>|null>(null);
  const [transferPreview,setTransferPreview]=useState<ImportPreview<DetailedCompareState>|null>(null);
  const [message, setMessage] = useState('');
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Calculations still work if local persistence is blocked.
    }
  }, [state]);

  const visibleItems = state.items.filter(item => !category || item.category === category);
  const results = useMemo(() => state.items.filter(item => !category || item.category === category).map((item) => calculateManualComparison(item, state.scenario, state.rates, state.targetCurrency, undefined, undefined, state.ratesExact,state.rateRatios)), [state, category]);

  const updateItem = (id: string, patch: Partial<ManualPriceItem>) => {
    setState((current) => ({
      ...current,
      items: current.items.map((item) => item.id === id ? { ...item, ...patch } : item),
    }));
  };

  const changeCategory = (item: ManualPriceItem, category: ManualCategory) => {
    updateItem(item.id, {
      category, selectedUnit: item.category === 'audio' && ['tts', 'music'].includes(category) ? item.selectedUnit : undefined,
      unitDefinitions: item.category === 'audio' && ['tts', 'music'].includes(category) ? item.unitDefinitions : unitTypesForCategory(category).map((unitType) => ({ unitType, value: null })),
    });
  };

  const addItem = () => {
    setState((current) => ({
      ...current,
      items: [...current.items, createManualItem(createId(), current.items.length + 1, category ?? 'image')],
    }));
  };

  const loadSample = () => {
    setState(createManualSampleState(createId(), createId()));
    setMessage(tr('已载入示例：39 CNY / 400 积分 × 20 积分/张 = 1.95 CNY/张。', 'Sample loaded: 39 CNY / 400 credits × 20 credits/image = 1.95 CNY/image.'));
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(exportCalculator('quick',state), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'openpricehub-manual-compare.json';
    link.click();
    URL.revokeObjectURL(url);
    setMessage(tr('比价数据已导出。', 'Comparison data exported.'));
  };

  const importJson = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      if(file.size>2*1024*1024)throw Error('File exceeds 2 MB / 文件超过 2 MB');
      setImportPreview(previewCalculatorImport(JSON.parse(await file.text()),'quick'));
    } catch (error) {
      setMessage(tr('导入失败：', 'Import failed: ')+String(error instanceof Error?error.message:error));
    }
  };

  const confirmImport=()=>{if(!importPreview)return;try{localStorage.setItem('oph.manual-compare.import-backup',JSON.stringify(state));localStorage.setItem(STORAGE_KEY,JSON.stringify(importPreview.data));setState(importPreview.data);setImportPreview(null);setMessage(tr('导入成功，已备份上一版。','Imported; previous state backed up.'));}catch{setMessage(tr('存储失败，未覆盖当前数据。','Storage failed; current data was not replaced.'));}};
  const prepareTransfer=()=>{try{const converted=quickToDetailed(state,readDetailedForTransfer());setTransferPreview(previewCalculatorImport(exportCalculator('detailed',converted),'detailed'));}catch(error){setMessage(String(error instanceof Error?error.message:error));}};
  const confirmTransfer=()=>{if(!transferPreview)return;try{const old=localStorage.getItem('oph.detailed-compare.v1');if(old)localStorage.setItem('oph.detailed-compare.import-backup',old);localStorage.setItem('oph.detailed-compare.v1',JSON.stringify(transferPreview.data));setTransferPreview(null);onSavedToDetailed?.();setMessage(tr('已追加到详细模式。','Saved to detailed mode.'));}catch{setMessage(tr('存储失败，未覆盖详细数据。','Storage failed; detailed data was not replaced.'));}};


  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <span className="eyebrow">// MANUAL PRICE LAB</span>
          <h1 className="mt-2 font-display text-3xl font-bold text-ink">
            {tr('手动比价实验室', 'Manual price lab')}
          </h1>
          <p className="mt-2 max-w-3xl text-ink-2">
            {tr(
              '把套餐、积分消耗和直接单价统一换算到同一币种，并按真实使用场景排序。数据自动保存在当前浏览器。',
              'Normalize plans, credit usage, and direct prices into one currency, then rank them for a real usage scenario. Data is saved locally.',
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-secondary" type="button" onClick={loadSample}>{tr('载入示例', 'Load sample')}</button>
          <button className="btn-secondary" type="button" onClick={() => importRef.current?.click()}>{tr('导入 JSON', 'Import JSON')}</button>
          <button className="btn-secondary" type="button" onClick={()=>{setImportPreview(previewCalculatorImport(exportCalculator('quick',completeQuickSample()),'quick'));}}>{tr('载入完整计价示例','Load full pricing examples')}</button>
          <button className="btn-secondary" type="button" onClick={exportJson}>{tr('导出 JSON', 'Export JSON')}</button>
          <button className="btn-secondary" type="button" onClick={prepareTransfer}>{tr('保存到详细模式','Save to detailed mode')}</button>
          <button className="btn-ghost" type="button" onClick={()=>{try{const raw=localStorage.getItem('oph.manual-compare.import-backup');if(!raw)throw Error(tr('暂无备份。','No backup available.'));setImportPreview(previewCalculatorImport(JSON.parse(raw),'quick'));}catch(error){setMessage(String(error instanceof Error?error.message:error));}}}>{tr('预览上次备份','Preview previous backup')}</button>
          <input ref={importRef} className="hidden" type="file" accept="application/json" onChange={importJson} />
        </div>
      </header>

      <p role="note" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">{tr('示例价格为模拟数据；手动录入的数据未经官方核验。', 'Sample prices are simulated; manually entered prices are not officially verified.')}</p>
      {message && (
        <div className="rounded-lg border border-primary-200 bg-primary-50 px-4 py-3 text-sm text-primary-700" role="status">
          {message}
        </div>
      )}

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.5fr)_360px]">
        <div className="space-y-4">
          {visibleItems.map((item, index) => (
            <section className="card p-5" key={item.id}>
              <div className="mb-5 flex items-start justify-between gap-3">
                <div>
                  <span className="eyebrow">{tr('价格规则', 'PRICE RULE')} #{index + 1}</span>
                  <h2 className="mt-1 font-display text-lg font-semibold text-ink">
                    {item.platformName || tr('未命名平台', 'Unnamed platform')} · {item.modelName || tr('未命名模型', 'Unnamed model')}
                  </h2>
                </div>
                <button
                  className="btn-ghost px-3 py-1.5 text-danger"
                  type="button"
                  disabled={state.items.length === 1}
                  onClick={() => setState((current) => ({
                    ...current,
                    items: current.items.filter((entry) => entry.id !== item.id),
                  }))}
                >
                  {tr('删除', 'Remove')}
                </button>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label">{tr('平台 / 网站', 'Platform / website')}</label>
                  <input className="input" value={item.platformName}
                    onChange={(event) => updateItem(item.id, { platformName: event.target.value })} />
                </div>
                <div>
                  <label className="label">{tr('模型', 'Model')}</label>
                  <input className="input" value={item.modelName}
                    onChange={(event) => updateItem(item.id, { modelName: event.target.value })} />
                </div>
                <div>
                  <label className="label">{tr('模型类型', 'Model category')}</label>
                  <select className="input" value={item.category}
                    onChange={(event) => changeCategory(item, event.target.value as ManualCategory)}>
                    {(Object.keys(CATEGORY_LABELS[locale]) as ManualCategory[]).map((category) => (
                      <option value={category} key={category}>{CATEGORY_LABELS[locale][category]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">{tr('计费模式', 'Pricing mode')}</label>
                  <select className="input" value={item.pricingMode}
                    onChange={(event) => updateItem(item.id, { pricingMode: event.target.value as ManualPricingMode, billingTerms:undefined })}>
                    {(Object.keys(MODE_LABELS[locale]) as ManualPricingMode[]).map((mode) => (
                      <option value={mode} key={mode}>{MODE_LABELS[locale][mode]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">{tr('原始币种', 'Source currency')}</label>
                  <select className="input" value={item.currency}
                    onChange={(event) => updateItem(item.id, { currency: event.target.value })}>
                    {Object.keys(state.rates).map((currency) => <option value={currency} key={currency}>{currency}</option>)}
                  </select>
                </div>

                <div><label className="label">{tr('可比参数（必填才排名）', 'Comparable parameters (required for ranking)')}</label><input aria-label={`Parameters ${item.id}`} className="input" placeholder={tr('例如：1024×1024，标准质量', 'e.g. 1024×1024, standard quality')} value={item.parameters ?? ''} onChange={e => updateItem(item.id, { parameters: e.target.value })} /></div>
                <div><label className="label">{tr('共同场景（跨模型比较时填写）', 'Shared task (for comparison across models)')}</label><input aria-label={`Shared task ${item.id}`} className="input" value={item.comparisonScenario ?? ''} onChange={e => updateItem(item.id, { comparisonScenario: e.target.value })} /></div>
                {item.category!=='text' && <div><label className="label">{tr('本次采用的计价单位', 'Pricing unit used for this quote')}</label><select aria-label={`Time unit ${item.id}`} className="input" value={item.selectedUnit ?? ''} onChange={e => updateItem(item.id, { selectedUnit: e.target.value ? e.target.value as UnitDefinition['unitType'] : undefined })}><option value="">{tr('自动（仅一个已填写单价时）', 'Automatic (only one populated rate)')}</option>{unitTypesForCategory(item.category).map(u => <option key={u} value={u}>{UNIT_LABELS[locale][u]}</option>)}</select></div>}
                {item.category==='text'&&<label className="label">{tr('Token 分项或原始积分用量','Token components or raw credits')}<select className="input" value={item.selectedUnit==='per_credit'?'per_credit':''} onChange={e=>updateItem(item.id,{selectedUnit:e.target.value==='per_credit'?'per_credit':undefined})}><option value="">{tr('按 Token 分项','Token components')}</option><option value="per_credit">{tr('按原始积分','Raw credits')}</option></select></label>}
                {item.pricingMode === 'plan_credit_based' && (
                  <>
                    <div>
                      <label className="label">{tr('套餐名称', 'Plan name')}</label>
                      <input className="input" value={item.planName}
                        onChange={(event) => updateItem(item.id, { planName: event.target.value })} />
                    </div>
                    <ExactPriceInput label={tr('套餐价格','Plan price')} value={item.planPriceExact??legacyDecimalText(item.planPrice)} onChange={planPriceExact=>updateItem(item.id,{planPriceExact,planPrice:Number(planPriceExact)||0})}/>
                    <ExactPriceInput label={tr('套餐积分数','Plan credits')} value={item.creditAmountExact??legacyDecimalText(item.creditAmount)} onChange={creditAmountExact=>updateItem(item.id,{creditAmountExact,creditAmount:Number(creditAmountExact)||0})}/>
                    <PurchaseCycleField value={item.purchaseCycle} onChange={purchaseCycle => updateItem(item.id, { purchaseCycle })} zh={zh} prefix={item.id} />
                    <div><label className="label">{tr('套餐积分池名称（可选）', 'Plan credit pool name (optional)')}</label><input aria-label={`Credit pool ${item.id}`} className="input" value={item.creditPool ?? ''} onChange={e => updateItem(item.id, { creditPool: e.target.value })} /></div>
                    <CreditPurchaseFields terms={item.purchaseTerms} onChange={purchaseTerms => updateItem(item.id, { purchaseTerms })} zh={zh} prefix={item.id} />
                  </>
                )}

                <UnitRulesEditor units={unitTypesForCategory(item.category)} value={item.unitDefinitions} onChange={unitDefinitions=>updateItem(item.id,{unitDefinitions})} zh={zh} prefix={`Unit price ${item.id}`} credits={item.pricingMode==='plan_credit_based'} />
                {item.pricingMode==='direct_price_based'&&<><BillingTermsEditor value={item.billingTerms} onChange={billingTerms=>updateItem(item.id,{billingTerms})} zh={zh}/><label className="label">{tr('按积分计价的积分池','Pool for per-credit pricing')}<input className="input" value={item.creditPool??''} onChange={e=>updateItem(item.id,{creditPool:e.target.value})}/></label></>}

              </div>

              {item.pricingMode === 'plan_credit_based' && item.planPrice > 0 && item.creditAmount > 0 && (
                <div className="receipt mt-4">
                  <div className="receipt-row">
                    <span className="k">{tr('每积分成本', 'Cost per credit')}</span>
                    <span className="v">{results.find(result => result.id === item.id)?.creditUnitCostExact ?? '—'} {item.currency}</span>
                  </div>
                </div>
              )}
            </section>
          ))}

          {visibleItems.length === 0 && <p className="card p-5 text-sm text-ink-2">{tr('本场景还没有价格规则，可添加规则或切换至全部场景。', 'No rules in this category yet. Add a price rule or switch to all categories.')}</p>}
          <button className="btn-secondary w-full" type="button" onClick={addItem}>
            + {tr('添加价格规则', 'Add price rule')}
          </button>
        </div>

        <aside className="space-y-4 xl:sticky xl:top-20">
          <section className="card p-5">
            <h2 className="font-display font-semibold text-ink">{tr('整体参数', 'Global settings')}</h2>
            <div className="mt-4">
              <label className="label">{tr('目标结果币种', 'Target currency')}</label>
              <select className="input" value={state.targetCurrency}
                onChange={(event) => setState((current) => ({ ...current, targetCurrency: event.target.value }))}>
                {Object.keys(state.rates).map((currency) => <option value={currency} key={currency}>{currency}</option>)}
              </select>
            </div>
            <div className="mt-4"><CalculatorFxEditor value={state} onChange={fx=>setState(current=>({...current,...fx}))} zh={zh}/></div>
          </section>

          <section className="card p-5"><ComparisonMetricControl value={metric} onChange={setMetric} zh={zh} /><ComparisonBasisControl value={basis} onChange={setBasis} zh={zh} /></section>
          <section className="card p-5">
            <h2 className="font-display font-semibold text-ink">{tr('使用场景', 'Usage scenario')}</h2>
            <div className="mt-4"><CalculatorScenarioFields value={state.scenario} onChange={scenario=>setState(current=>({...current,scenario}))} zh={zh} category={category}/></div>
          </section>
        </aside>
      </div>

      {importPreview&&<CalculatorImportPreview preview={importPreview} currentCount={state.items.length} onConfirm={confirmImport} onCancel={()=>setImportPreview(null)} zh={zh}/>}
      {transferPreview&&<CalculatorImportPreview preview={transferPreview} currentCount={0} onConfirm={confirmTransfer} onCancel={()=>setTransferPreview(null)} zh={zh} transfer/>}
      <ManualComparisonResults rows={results} metric={metric} basis={basis} locale={locale} />
    </div>
  );
}

export default ManualCompare;
