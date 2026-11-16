import { Link } from "react-router-dom";
import { useLocale, useLocalePath } from "../i18n";
import { useCompare } from "../context/CompareContext";
import { ToolLogo } from "../components/ToolLogo";
import type { Product } from "../../shared/catalog/types";
import { PRICING_MODELS } from "../../shared/catalog/types";
import {
  startingPlan,
  planPrice,
  modes,
  hasFree,
  publicUnits,
  matchingPlans,
  type Filters,
} from "../../shared/catalog/logic";

/** Original ToolCard visual structure, backed by verified multi-plan data. */
export function ProductCard({
  product,
  filters,
}: {
  product: Product;
  filters?: Filters;
}) {
  const lp = useLocalePath();
  const zh = useLocale() === "zh";
  const compare = useCompare();
  const p = filters
    ? { ...product, plans: matchingPlans(product, filters) }
    : product;
  const plan = startingPlan(p, filters?.basis);
  return (
    <div className="card card-hover flex h-full flex-col p-5">
      <div className="flex items-start gap-3">
        <ToolLogo text={p.name.slice(0, 2)} category={p.category} />
        <div className="min-w-0 flex-1">
          <Link
            to={lp(`/tools/${p.slug}`)}
            className="font-display text-base font-semibold text-ink hover:text-primary"
          >
            {p.name}
          </Link>
          <p className="mt-1 line-clamp-2 text-sm text-ink-2">
            {zh ? p.summaryZh : p.summary}
          </p>
        </div>
        <button
          onClick={() => compare.toggle(p.slug)}
          aria-label={`${zh ? "比较" : "Compare"} ${p.name}`}
          aria-pressed={compare.has(p.slug)}
          className={`flex-none rounded-lg border px-2.5 py-1.5 text-xs font-semibold ${compare.has(p.slug) ? "border-primary bg-primary text-white" : "border-line bg-surface text-ink-2 hover:border-primary-200"}`}
        >
          {compare.has(p.slug) ? "✓" : "+"}
        </button>
      </div>
      <div className="mt-4">
        <div className="font-display text-lg font-bold tabular text-ink">
          {plan
            ? planPrice(plan)
            : zh
              ? "价格待核验"
              : "Price awaiting verification"}
        </div>
        <div className="mt-1 text-xs text-ink-2">
          {plan?.name} ·{" "}
          {hasFree(p)
            ? zh
              ? "有免费额度"
              : "Free allowance available"
            : zh
              ? "未列出免费额度"
              : "No free allowance listed"}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {modes(p).map((m) => (
          <span
            key={m}
            className="rounded-md bg-surface-2 px-2 py-0.5 text-xs text-ink-2"
          >
            {PRICING_MODELS[m]}
          </span>
        ))}
      </div>
      <p className="mt-3 text-xs text-ink-2">
        {publicUnits(p).join(" · ") ||
          (zh
            ? "单位成本取决于套餐与实际用量"
            : "Unit cost depends on plan and workload")}
      </p>
      <div className="mt-4 border-t border-line-2 pt-3 text-xs text-ink-2">
        {zh ? "最后核验" : "Last verified"}：{p.verifiedAt || "—"}
      </div>
      <div className="mt-auto flex flex-wrap justify-between gap-2 pt-3 text-xs font-semibold text-primary">
        <Link to={lp(`/tools/${p.slug}`)}>
          {zh ? "套餐详情 →" : "View plans →"}
        </Link>
        <Link to={lp(`/alternatives/${p.slug}`)}>
          {zh ? "查找低价平替 →" : "Find alternatives →"}
        </Link>
      </div>
    </div>
  );
}
