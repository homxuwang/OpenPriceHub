import { useUnified } from '../data/UnifiedProvider';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Tool } from '../../shared/types';
import { normalizeDetailedState } from '../../shared/detailedCompare';
import { fuzzy } from '../../shared/discovery/engine';
import { useLocale, useLocalePath, useT } from '../i18n';
import { SearchBar } from './SearchBar';

// Read identities from the user's existing calculator records; never invent model/provider links.
export function HomeSearch({ tools }: { tools: Tool[] }) {
  const {catalog}=useUnified();
  const [query, setQuery] = useState('');
  const [saved] = useState(() => {
    try { const raw = localStorage.getItem('oph.detailed-compare.v1'); return raw ? normalizeDetailedState(JSON.parse(raw)) : null; } catch { return null; }
  });
  const locale = useLocale(), lp = useLocalePath(), t = useT(), navigate = useNavigate();
  const entries = useMemo(() => [
    ...tools.map(tool => ({ id: `tool:${tool.id}`, name: tool.name, detail: `${t('categories.' + tool.toolCategory)} · ${tool.live?(locale==='zh'?'已发布目录':'Published catalog'):t('home.sampleCatalog')}`, path: `/tools?q=${encodeURIComponent(tool.name)}` })),
    ...(catalog?.models.filter(m=>m.productId||catalog.offers.some(o=>o.modelId===m.id)).map(m=>({id:'live-model:'+m.id,name:m.name,detail:locale==='zh'?'已发布模型':'Published model',path:'/tools?q='+encodeURIComponent(m.name)}))||[]),
    ...(catalog?.channels.map(c=>({id:'live-channel:'+c.id,name:c.name,detail:locale==='zh'?'服务渠道':'Service channel',path:'/tools?q='+encodeURIComponent(c.name)}))||[]),
    ...(saved?.models.filter(model => typeof model.id === 'string' && typeof model.name === 'string').map(model => ({ id: `model:${model.id}`, name: model.name, detail: t('home.savedModel'), path: `/calculator?type=${model.category}&model=${encodeURIComponent(model.id)}` })) ?? []),
    ...(saved?.platforms.filter(platform => typeof platform.id === 'string' && typeof platform.name === 'string').map(platform => ({ id: `provider:${platform.id}`, name: platform.name, detail: t('home.savedProvider'), path: `/calculator?platform=${encodeURIComponent(platform.id)}` })) ?? []),
  ], [tools,saved,locale,catalog]);
  const suggestions = entries.filter(e => fuzzy(e.name, query)).slice(0, 8).map(e => ({ id: e.id, label: e.name, detail: e.detail, onSelect: () => navigate(lp(e.path)) }));
  return <SearchBar size="lg" placeholder={t('home.searchPlaceholder')} onQueryChange={setQuery} suggestions={suggestions} onSearch={q => { if (q) navigate(lp(`/tools?q=${encodeURIComponent(q)}`)); }} />;
}
