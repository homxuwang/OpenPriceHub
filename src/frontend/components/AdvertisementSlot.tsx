import { useLocale } from '../i18n';
/** Reserved inventory only. No advertiser, tracking script or effect on organic results. */
export function AdvertisementSlot({ placement, compact = false }: { placement: 'home-primary' | 'home-secondary'; compact?: boolean }) {
  const zh = useLocale() === 'zh';
  return <aside data-ad-slot={placement} aria-label={zh ? '广告位预留' : 'Reserved advertising space'} className={`relative flex flex-col items-center justify-center gap-2 overflow-hidden rounded-card border-2 border-dashed border-primary-200 bg-primary-50/50 px-5 text-center ${compact ? 'min-h-[120px] py-5' : 'min-h-[144px] py-7 sm:min-h-[120px]'}`}>
    <span className="absolute left-3 top-2 text-[10px] font-semibold uppercase tracking-label text-primary-700">{zh ? '广告位 · 预留' : 'ADVERTISEMENT · RESERVED'}</span>
    <strong className="mt-2 font-display text-lg text-ink">{zh ? '广告与赞助展示位' : 'Advertising & sponsorship space'}</strong>
    <p className="max-w-xl text-sm text-ink-2">{zh ? '未来用于展示面向 AI 创作者的产品与服务，广告不会影响工具筛选或成本排名。' : 'Reserved for products and services for AI creators. Ads will not influence tool filtering or cost rankings.'}</p>
    <span className="text-xs text-ink-2">{zh ? '当前暂无广告内容' : 'No advertisement currently displayed'}</span>
  </aside>;
}
