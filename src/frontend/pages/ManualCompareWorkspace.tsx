import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { calculatorCategory } from '../../shared/calculatorScope';
import { MANUAL_CATEGORY_LABELS } from '../components/ManualComparisonResults';
import { useLocale } from '../i18n';
import QuickManualCompare from './ManualCompare';
import DetailedManualCompare from './DetailedManualCompare';

type Mode = 'detailed' | 'quick';

function ManualCompareWorkspace() {
  const locale = useLocale();
  const zh = locale === 'zh';
  const [params, setParams] = useSearchParams();
  const category = calculatorCategory(params.get('type'));
  const [notice,setNotice]=useState('');
  const [mode, setMode] = useState<Mode>('detailed');

  return (
    <div>
      <header className="mb-6">
        <span className="eyebrow">// MODEL COST CALCULATOR</span>
        <h1 className="mt-2 font-display text-3xl font-bold text-ink">
          {zh ? '模型成本计算器' : 'Model Cost Calculator'}
        </h1>
        <p className="mt-2 max-w-3xl text-ink-2">
          {zh
            ? '详细模式用于长期维护网站、套餐、模型和价格规则；快速模式适合临时输入几条价格立即比较。'
            : 'Detailed mode maintains platforms, plans, models, and pricing rules. Quick mode compares a few temporary prices immediately.'}
        </p>
      </header>

      <label className="label mb-6 block max-w-md">{zh ? '使用场景' : 'Usage category'}<select aria-label="Calculator category" className="input mt-2" value={category ?? 'all'} onChange={e => { const next = new URLSearchParams(params); next.delete('model'); if (e.target.value === 'all') next.delete('type'); else next.set('type', e.target.value); setParams(next); }}>
        <option value="all">{zh ? '全部场景' : 'All categories'}</option>{(['image', 'video', 'tts', 'music', 'text', 'audio'] as const).map(c => <option key={c} value={c}>{MANUAL_CATEGORY_LABELS[locale][c]}</option>)}
      </select></label>
      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        <ModeButton
          active={mode === 'detailed'}
          title={zh ? '详细比价' : 'Detailed comparison'}
          description={zh ? '多网站、多套餐、模型价格规则、表格与图表' : 'Multiple platforms, plans, model rules, tables, and charts'}
          onClick={() => setMode('detailed')}
        />
        <ModeButton
          active={mode === 'quick'}
          title={zh ? '简单快速比价' : 'Quick comparison'}
          description={zh ? '直接填写套餐或单价，无需建立完整资料' : 'Enter plans or unit prices without building a full catalog'}
          onClick={() => setMode('quick')}
        />
      </div>

      {notice&&<p role="status" className="mb-4 rounded-lg bg-primary-50 p-3 text-sm text-primary-700">{notice}</p>}
      {mode === 'detailed' ? <DetailedManualCompare category={category} modelId={params.get('model')} platformId={params.get('platform')} /> : <QuickManualCompare category={category} onSavedToDetailed={()=>{const next=new URLSearchParams(params);next.delete('model');next.delete('platform');setParams(next);setMode('detailed');setNotice(zh?'快速记录已追加到详细模式，原档案保持保留。':'Quick records were added to detailed mode; existing records are retained.');}} />}
    </div>
  );
}

function ModeButton({ active, title, description, onClick }: {
  active: boolean;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-card border p-4 text-left transition-all ${
        active
          ? 'border-primary bg-primary-50 shadow-card'
          : 'border-line bg-surface hover:border-primary-200 hover:shadow-card'
      }`}
    >
      <div className={`font-display text-lg font-semibold ${active ? 'text-primary-700' : 'text-ink'}`}>{title}</div>
      <div className="mt-1 text-sm text-ink-2">{description}</div>
    </button>
  );
}

export default ManualCompareWorkspace;
