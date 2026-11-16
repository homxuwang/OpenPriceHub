import { useEffect, useId, useRef, useState } from 'react';
import type { SearchChoice, SearchSelection } from '../../shared/discovery/types';
import { fuzzy } from '../../shared/discovery/engine';
const key = (v: SearchSelection) => `${v.kind}:${v.id}`;
export default function EntitySelect({ choices, selected, query, onQuery, onChange, zh }: {
  choices: SearchChoice[]; selected: SearchSelection[]; query: string;
  onQuery: (v: string) => void; onChange: (v: SearchSelection[]) => void; zh: boolean;
}) {
  const [open, setOpen] = useState(false), [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null), listId = useId();
  const options = choices.filter(x => fuzzy(x.name, query));
  const labels = { product: zh ? '产品' : 'Product', model: zh ? '模型' : 'Model', provider: zh ? '服务商' : 'Provider' };
  const toggle = (choice: SearchChoice) => {
    onChange(selected.some(x => key(x) === key(choice)) ? selected.filter(x => key(x) !== key(choice)) : [...selected, { kind: choice.kind, id: choice.id }]);
    onQuery(''); setActive(0);
  };
  useEffect(() => {
    const close = (event: MouseEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);
  return <div ref={root} className="relative min-w-0" onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false); }}>
    <label htmlFor={listId + '-input'}>{zh ? '搜索产品、模型、服务商（可多选）' : 'Products, models, providers (multi-select)'}</label>
    {!!selected.length && <div className="mt-2 flex flex-wrap gap-2">{selected.map(s => <button key={key(s)} type="button" className="max-w-full break-words rounded-lg bg-primary-50 px-2 py-1 text-left text-xs text-primary-700" onClick={() => onChange(selected.filter(x => key(x) !== key(s)))} aria-label={`${zh ? '移除' : 'Remove'} ${choices.find(x => key(x) === key(s))?.name ?? s.id} ${labels[s.kind]}`}>{choices.find(x => key(x) === key(s))?.name ?? s.id} · {labels[s.kind]} ×</button>)}<button type="button" className="text-xs underline" onClick={() => { onChange([]); onQuery(''); }}>{zh ? '清空选择' : 'Clear selections'}</button></div>}
    <input id={listId + '-input'} aria-label="Search" role="combobox" aria-expanded={open} aria-controls={listId} aria-autocomplete="list" aria-activedescendant={open && options[active] ? `${listId}-${active}` : undefined}
      placeholder={zh ? '输入关键词，选择已有产品或模型' : 'Type to find existing products or models'}
      className="w-full rounded-lg border border-line bg-surface p-2 text-ink" value={query}
      onFocus={() => setOpen(true)} onChange={e => { onQuery(e.target.value); setOpen(true); setActive(0); }}
      onKeyDown={e => {
        if (e.key === 'Escape') { setOpen(false); return; }
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); setOpen(true); setActive(i => Math.max(0, Math.min(options.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1)))); }
        if (e.key === 'Enter' && open && options[active]) { e.preventDefault(); toggle(options[active]); }
      }} />
    {open && <div id={listId} role="listbox" aria-label={zh ? '搜索建议' : 'Search suggestions'} aria-multiselectable="true" className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-line bg-surface p-1 shadow-lg">
      {options.map((choice, i) => <div id={`${listId}-${i}`} key={key(choice)} role="option" aria-selected={selected.some(x => key(x) === key(choice))}
        className={`cursor-pointer rounded p-2 text-sm ${i === active ? 'bg-primary-50' : 'hover:bg-surface-2'}`} onMouseDown={e => e.preventDefault()} onMouseEnter={() => setActive(i)} onClick={() => toggle(choice)}>
        <span aria-hidden>{selected.some(x => key(x) === key(choice)) ? '✓ ' : ''}</span>{choice.name} <span className="text-ink-2">· {labels[choice.kind]}</span>
      </div>)}
      {!options.length && <p className="p-2 text-sm">{zh ? '没有匹配的已有产品、模型或服务商' : 'No matching products, models or providers'}</p>}
    </div>}

    <p className="mt-1 text-xs text-ink-2">{zh ? '选择多项可同时查看；留空显示当前场景全部方案。' : 'Select multiple entries to view together; leave empty for all plans in this experience.'}</p>
  </div>;
}
