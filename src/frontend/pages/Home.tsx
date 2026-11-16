// Incremental home: existing visual system, usable decision paths, explicit sample data.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { ToolCategory } from '../../shared/types';
import { useT, useLocale, useLocalePath } from '../i18n';
import { useTools, usePriceUpdates, useGuides } from '../data';
import { HomeSearch } from '../components/HomeSearch';
import { ScenarioCard } from '../components/ScenarioCard';
import { ToolCard } from '../components/ToolCard';
import { AdvertisementSlot } from '../components/AdvertisementSlot';
const categories: { id: ToolCategory; title: string; type: string; path: string; desc: string }[] = [
  { id: 'image', title: 'nav.image', type: 'image', path: '/tools?category=image', desc: 'home.scenes.image.desc' },
  { id: 'video', title: 'nav.video', type: 'video', path: '/tools?category=video', desc: 'home.scenes.video.desc' },
  { id: 'voice', title: 'nav.voiceTools', type: 'tts', path: '/compare/tts', desc: 'home.voiceDesc' },
  { id: 'music', title: 'nav.musicTools', type: 'music', path: '/compare/music', desc: 'home.musicDesc' },
  { id: 'llm-api', title: 'nav.llmApi', type: 'api', path: '/tools?category=llm-api', desc: 'home.scenes.llm.desc' },
];
function Home() {
  const t = useT(), locale = useLocale(), lp = useLocalePath();
  const [category, setCategory] = useState<ToolCategory>('image');
  const tools = useTools().data, updates = usePriceUpdates().data, guides = useGuides().data;
  const visible = tools.filter(tool => tool.toolCategory === category).slice(0, 4);
  const selected = categories.find(c => c.id === category)!;
  return <div className="space-y-10 sm:space-y-12" data-testid="home-content">
    <section className="pt-2 text-center sm:pt-4">
      <h1 className="mx-auto max-w-3xl font-display text-3xl font-bold leading-tight tracking-tight text-ink sm:text-5xl">{t('home.heroTitle')}</h1>
      <p className="mx-auto mt-4 max-w-2xl text-base text-ink-2 sm:text-lg">{t('home.heroSubtitle')}</p>
      <div className="mx-auto mt-6 max-w-2xl"><HomeSearch tools={tools} /><p className="mt-2 text-xs text-ink-2">{t('home.searchHint')}</p></div>
      <div className="mx-auto mt-5 flex max-w-2xl flex-col justify-center gap-3 sm:flex-row">
        <Link to={lp('/discovery-lab')} className="btn-primary justify-center">{t('nav.discoveryLab')} <span className="rounded bg-white/20 px-1.5 py-0.5 text-xs">{t('home.mockExperience')}</span> →</Link>
        <Link to={lp('/calculator')} className="btn-secondary justify-center">{t('nav.calculator')} →</Link>
      </div>
    </section>

    <section aria-label={t('home.scenesTitle')}><h2 className="mb-4 font-display text-xl font-bold">{t('home.scenesTitle')}</h2><div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      {categories.map(c => <ScenarioCard key={c.id} compact category={c.id} title={t(c.title)} desc={t(c.desc)} to={lp(c.path)} />)}
    </div></section>

    <section aria-label={t('home.decisionTitle')} className="grid gap-4 md:grid-cols-2">
      <Link to={lp('/discovery-lab')} className="card card-hover border-primary-100 bg-primary-50/60 p-5 sm:p-6"><span className="eyebrow">{t('home.finderEyebrow')}</span><h2 className="mt-2 font-display text-xl font-bold">{t('nav.discoveryLab')}</h2><p className="mt-2 text-sm text-ink-2">{t('home.finderDesc')}</p><p className="mt-3 text-xs text-warn">{t('home.finderNotice')}</p><span className="mt-4 block text-sm font-semibold text-primary">{t('home.startFinding')} →</span></Link>
      <div className="card p-5 sm:p-6"><span className="eyebrow">{t('home.calculatorEyebrow')}</span><h2 className="mt-2 font-display text-xl font-bold"><Link className="hover:text-primary" to={lp('/calculator')}>{t('nav.calculator')}</Link></h2><p className="mt-2 text-sm text-ink-2">{t('home.calculatorDesc')}</p><div className="mt-4 flex flex-wrap gap-2">{categories.map(c => <Link key={c.id} to={lp(`/calculator?type=${c.type}`)} className="chip hover:border-primary" data-testid={`home-calc-${c.id}`}>{t(c.title)} →</Link>)}</div></div>
    </section>

    <AdvertisementSlot placement="home-primary" />

    <section data-testid="home-catalog" aria-labelledby="home-catalog-title">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3"><h2 id="home-catalog-title" className="font-display text-xl font-bold sm:text-2xl">{t('home.catalogTitle')}</h2><Link to={lp(selected.path)} className="text-sm font-semibold text-primary">{t('common.viewAll')} →</Link></div>
      <p role="note" className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">{t('home.catalogNotice')}</p>
      <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label={t('home.catalogCategories')}>{categories.map(c => <button key={c.id} type="button" className={`chip ${category === c.id ? 'chip-active' : ''}`} aria-pressed={category === c.id} onClick={() => setCategory(c.id)}>{t(c.title)}</button>)}</div>
      {visible.length ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{visible.map(tool => <ToolCard key={tool.id} tool={tool} preview />)}</div> : <div className="card p-6 text-center"><p className="text-ink-2">{t('home.noCategoryPrices')}</p><Link className="btn-secondary mt-4" to={lp(selected.path)}>{t('home.manualCategoryCompare')} →</Link></div>}
    </section>

    {!!updates.length && <section aria-labelledby="home-updates-title"><h2 id="home-updates-title" className="mb-3 font-display text-xl font-bold">{t('home.priceRecordsTitle')}</h2><p className="mb-4 text-sm text-ink-2">{t('home.priceRecordsNotice')}</p><div className="overflow-hidden rounded-card border border-line bg-surface">{updates.slice(0, 3).map(u => <div key={u.id} className="flex flex-wrap items-center gap-2 border-b border-line-2 px-4 py-3 last:border-b-0"><div className="min-w-0 flex-1"><span className="font-medium">{u.toolName}</span><p className="text-xs text-ink-2">{t('home.priceRecordDesc')}</p></div><span className="rounded bg-warn-soft px-2 py-1 text-xs text-warn">{t('home.sampleRecord')}</span><time dateTime={u.date} className="text-xs text-ink-2">{u.date}</time></div>)}</div></section>}

    <section aria-labelledby="home-guides-title"><h2 id="home-guides-title" className="mb-4 font-display text-xl font-bold">{t('home.guideTipsTitle')}</h2><div className="grid gap-4 md:grid-cols-3">{guides.map(g => <article className="card flex flex-col p-5" key={g.id}><h3 className="font-display font-semibold">{locale === 'en' ? g.titleEn ?? g.title : g.title}</h3><p className="mt-2 flex-1 text-sm text-ink-2">{t(g.category === 'image' ? 'home.imageTip' : g.category === 'video' ? 'home.videoTip' : 'home.apiTip')}</p><Link className="mt-4 text-sm font-semibold text-primary" to={lp(`/calculator?type=${g.category === 'llm-api' ? 'api' : g.category}`)}>{t('home.estimateUsage')} →</Link></article>)}</div></section>

    <section className="card flex flex-col items-start justify-between gap-4 p-5 sm:flex-row sm:items-center"><div><h2 className="font-display text-xl font-bold">{t('home.maintainTitle')}</h2><p className="mt-2 text-sm text-ink-2">{t('home.maintainDesc')}</p></div><Link to={lp('/calculator')} className="btn-secondary flex-none">{t('home.maintainCta')} →</Link></section>

    <AdvertisementSlot placement="home-secondary" compact />
  </div>;
}
export default Home;
