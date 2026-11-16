import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Tool } from '../../shared/types';
import { normalizeDetailedState } from '../../shared/detailedCompare';
import { fuzzy } from '../../shared/discovery/engine';
import { useLocale, useLocalePath, useT } from '../i18n';
import { SearchBar } from './SearchBar';

// Read identities from the user's existing calculator records; never invent model/provider links.
export function HomeSearch({ tools }: { tools: Tool[] }) {
  const [query, setQuery] = useState('');
  const [saved] = useState(() => {
    try { const raw = localStorage.getItem('oph.detailed-compare.v1'); return raw ? normalizeDetailedState(JSON.parse(raw)) : null; } catch { return null; }
  });
  const locale = useLocale(), lp = useLocalePath(), t = useT(), navigate = useNavigate();
  const entries = useMemo(() => [
    ...tools.map(tool => ({ id: `tool:${tool.id}`, name: tool.name, detail: `${t('categories.' + tool.toolCategory)} · ${t('home.sampleCatalog')}`, path: `/tools?q=${encodeURIComponent(tool.name)}` })),
    ...(saved?.models.filter(model => typeof model.id === 'string' && typeof model.name === 'string').map(model => ({ id: `model:${model.id}`, name: model.name, detail: t('home.savedModel'), path: `/calculator?type=${model.category}&model=${encodeURIComponent(model.id)}` })) ?? []),
    ...(saved?.platforms.filter(platform => typeof platform.id === 'string' && typeof platform.name === 'string').map(platform => ({ id: `provider:${platform.id}`, name: platform.name, detail: t('home.savedProvider'), path: `/calculator?platform=${encodeURIComponent(platform.id)}` })) ?? []),
  ], [tools, saved, locale]);
  const suggestions = entries.filter(e => fuzzy(e.name, query)).slice(0, 8).map(e => ({ id: e.id, label: e.name, detail: e.detail, onSelect: () => navigate(lp(e.path)) }));
  return <SearchBar size="lg" placeholder={t('home.searchPlaceholder')} onQueryChange={setQuery} suggestions={suggestions} onSearch={q => { if (q) navigate(lp(`/tools?q=${encodeURIComponent(q)}`)); }} />;
}
