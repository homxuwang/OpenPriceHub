// OpenPriceHub · 搜索框

import { useId, useState } from 'react';
import { useT } from '../i18n';

export function SearchBar({
  placeholder,
  defaultValue = '',
  onSearch,
  size = 'md',
  autoFocus = false,
  suggestions,
  onQueryChange,
}: {
  placeholder?: string;
  defaultValue?: string;
  onSearch?: (q: string) => void;
  size?: 'md' | 'lg';
  autoFocus?: boolean;
  suggestions?: { id: string; label: string; detail: string; onSelect: () => void }[];
  onQueryChange?: (q: string) => void;
}) {
  const t = useT();
  const listId = useId();
  const [open, setOpen] = useState(false), [active, setActive] = useState(0);
  const [q, setQ] = useState(defaultValue);
  const expanded = open && !!q.trim() && suggestions !== undefined;
  const pad = size === 'lg' ? 'py-3.5 pl-12 pr-28 text-base' : 'py-2.5 pl-10 pr-3 text-sm';

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        onSearch?.(q.trim());
      }}
      className="relative w-full"
      onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false); }}
    >
      <svg
        className={`pointer-events-none absolute top-1/2 -translate-y-1/2 text-ink-2 ${
          size === 'lg' ? 'left-4 h-5 w-5' : 'left-3 h-4 w-4'
        }`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
      </svg>
      <input
        type="search"
        aria-label={t('common.search')} role={suggestions === undefined ? undefined : 'combobox'} aria-expanded={suggestions === undefined ? undefined : expanded}
        aria-controls={suggestions === undefined ? undefined : listId} aria-autocomplete={suggestions === undefined ? undefined : 'list'}
        aria-activedescendant={expanded && suggestions?.[active] ? `${listId}-${active}` : undefined}
        onFocus={() => setOpen(true)} onKeyDown={e => {
          if (e.key === 'Escape') setOpen(false);
          if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && suggestions) { e.preventDefault(); setOpen(true); setActive(i => Math.max(0, Math.min(suggestions.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1)))); }
          if (e.key === 'Enter' && expanded && suggestions?.[active]) { e.preventDefault(); suggestions[active].onSelect(); setOpen(false); }
        }}
        value={q}
        autoFocus={autoFocus}
        onChange={(e) => {
          setQ(e.target.value); setOpen(true); setActive(0); onQueryChange?.(e.target.value);
          if (size !== 'lg') onSearch?.(e.target.value.trim()); // 小搜索框即时过滤
        }}
        placeholder={placeholder}
        className={`w-full rounded-xl border border-line bg-surface text-ink placeholder:text-ink-2/70 shadow-card transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 ${pad}`}
      />
      {size === 'lg' && (
        <button type="submit" className="btn-primary absolute right-2 top-1/2 -translate-y-1/2 !py-2">
          {t('common.search')}
        </button>
      )}
      {expanded && <div id={listId} role="listbox" aria-label={t('home.suggestions')} className="absolute left-0 right-0 top-full z-30 mt-2 max-h-72 overflow-y-auto rounded-xl border border-line bg-surface p-1 text-left shadow-pop">
        {suggestions?.length ? suggestions.map((option, i) => <button key={option.id} id={`${listId}-${i}`} type="button" role="option" aria-selected={i === active} tabIndex={-1} onMouseDown={e => e.preventDefault()} onMouseEnter={() => setActive(i)} onClick={() => { option.onSelect(); setOpen(false); }} className={`block w-full rounded-lg px-3 py-2 text-left text-sm ${i === active ? 'bg-primary-50' : 'hover:bg-surface-2'}`}><span className="block font-semibold">{option.label}</span><span className="text-xs text-ink-2">{option.detail}</span></button>) : <p className="px-3 py-2 text-sm text-ink-2">{t('home.noSuggestions')}</p>}
      </div>}
    </form>
  );
}
