import { useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useLocale, useLocalePath } from "../i18n";
import { useCompare } from "../context/CompareContext";
import { useCatalog } from "./context";
import type { Product, Plan } from "../../shared/catalog/types";
import { CATEGORIES, PRICING_MODELS } from "../../shared/catalog/types";
import {
  filterCatalog,
  matchingPlans,
  type Filters,
  startingPlan,
  planPrice,
  modes,
  hasFree,
  publicUnits,
} from "../../shared/catalog/logic";
export const useCopy = () => {
  const zh = useLocale() === "zh";
  return (en: string, cn: string) => (zh ? cn : en);
};
export function PageTitle({
  title,
  description,
  eyebrow,
  children,
}: {
  title: string;
  description?: string;
  eyebrow?: string;
  children?: ReactNode;
}) {
  return (
    <header className="mb-7">
      <p className="eyebrow">
        {eyebrow || "OPENPRICEHUB / PRICE INTELLIGENCE"}
      </p>
      <h1 className="mt-2 font-display text-3xl font-bold tracking-tight sm:text-4xl">
        {title}
      </h1>
      {description && (
        <p className="mt-3 max-w-3xl text-ink-2">{description}</p>
      )}
      {children}
    </header>
  );
}
export function Breadcrumbs({
  items,
}: {
  items: { name: string; path?: string }[];
}) {
  const lp = useLocalePath();
  const t = useCopy();
  return (
    <nav
      aria-label="Breadcrumb"
      className="mb-5 flex flex-wrap gap-2 text-xs text-ink-2"
    >
      <Link to={lp("/")}>{t("Home", "首页")}</Link>
      {items.map((i, k) => (
        <span key={k}>
          {" "}
          / {i.path ? <Link to={lp(i.path)}>{i.name}</Link> : i.name}
        </span>
      ))}
    </nav>
  );
}
export function GlobalSearch({
  alternatives = false,
}: {
  alternatives?: boolean;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const catalog = useCatalog();
  const lp = useLocalePath();
  const navigate = useNavigate();
  const t = useCopy();
  const results = q.trim() ? filterCatalog(catalog, { q }).slice(0, 6) : [];
  return (
    <div className="relative">
      <form
        role="search"
        className="relative w-full"
        onSubmit={(e) => {
          e.preventDefault();
          setOpen(false);
          navigate(
            lp(
              `${alternatives ? "/alternatives" : "/tools"}?q=${encodeURIComponent(q)}`,
            ),
          );
        }}
      >
        <input
          aria-label={t(
            "Search products, models or features",
            "搜索产品、模型或功能",
          )}
          className="w-full rounded-xl border border-line bg-surface py-3.5 pl-4 pr-28 text-base text-ink placeholder:text-ink-2/70 shadow-card focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          placeholder={t(
            "Search a tool, model, provider or feature…",
            "搜索工具、模型、服务商或功能…",
          )}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
          }}
        />
        <button className="btn-primary absolute right-2 top-1/2 -translate-y-1/2 !py-2">
          {t("Search", "搜索")}
        </button>
      </form>
      {open && q.trim() && (
        <div
          className="absolute inset-x-0 top-full z-30 mt-2 rounded-xl border border-line bg-white p-2 shadow-pop"
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false);
          }}
        >
          {results.length ? (
            results.map((p) => {
              const plan = startingPlan(p);
              return (
                <Link
                  onClick={() => setOpen(false)}
                  key={p.id}
                  to={lp(
                    `/${alternatives ? "alternatives" : "tools"}/${p.slug}`,
                  )}
                  className="block rounded-lg p-3 text-sm hover:bg-surface-2 focus:bg-surface-2"
                >
                  <span className="font-semibold">{p.name}</span>
                  <span className="ml-2 text-xs text-ink-2">
                    {CATEGORIES.find((c) => c.id === p.category)?.en}
                  </span>
                  <span className="mt-1 block text-xs text-ink-2">
                    {plan
                      ? planPrice(plan)
                      : t("Awaiting verification", "待核验")}{" "}
                    ·{" "}
                    {modes(p)
                      .map((m) => PRICING_MODELS[m])
                      .join(" / ")}
                    {hasFree(p) ? " · Free allowance" : ""}
                  </span>
                </Link>
              );
            })
          ) : (
            <p className="p-3 text-sm">
              {t(
                "No matches. Try a product or capability.",
                "没有匹配结果，请尝试产品名或功能。",
              )}
            </p>
          )}
          <button
            onClick={() => setOpen(false)}
            className="btn-ghost !py-1 text-xs"
          >
            {t("Close suggestions", "关闭提示")}
          </button>
        </div>
      )}
    </div>
  );
}
export function CompareButton({ product }: { product: Product }) {
  const { has, toggle } = useCompare();
  const t = useCopy();
  return (
    <button
      className="btn-secondary !px-3 !py-1.5"
      aria-pressed={has(product.slug)}
      onClick={() => toggle(product.slug)}
    >
      {has(product.slug) ? t("Selected", "已选") : t("+ Compare", "+ 对比")}
    </button>
  );
}
export function ProductTable({
  products,
  basis = "all",
  filters,
}: {
  products: Product[];
  basis?: string;
  filters?: Filters;
}) {
  const t = useCopy();
  const lp = useLocalePath();
  if (!products.length)
    return (
      <div className="card p-8 text-center text-ink-2">
        {t(
          "No verified offers match these conditions. Try removing a filter.",
          "没有符合这些条件的已核验方案，请调整筛选。",
        )}
      </div>
    );
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-white">
      <table className="product-table w-full text-left text-sm">
        <thead className="bg-surface-2 text-xs text-ink-2">
          <tr>
            {[
              "Product",
              "Starting Price",
              "Pricing Model",
              "Free Tier",
              "Cost per Unit",
              "Last Verified",
              "Action",
            ].map((x, i) => (
              <th key={x} className="p-3 font-medium">
                {t(
                  x,
                  [
                    "产品",
                    "起始价格",
                    "付费方式",
                    "免费额度",
                    "单位成本",
                    "最后核验",
                    "操作",
                  ][i],
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {products.map((original) => {
            const p = filters
              ? { ...original, plans: matchingPlans(original, filters) }
              : original;
            const plan = startingPlan(p, basis);
            return (
              <tr key={p.id} className="border-t border-line align-top">
                <td data-label={t("Product", "产品")} className="p-3">
                  <Link
                    to={lp(`/tools/${p.slug}`)}
                    className="font-semibold text-ink hover:text-primary"
                  >
                    {p.name}
                  </Link>
                  <div className="mt-1 text-xs text-ink-2">{p.provider}</div>
                </td>
                <td
                  data-label={t("Starting Price", "起始价格")}
                  className="p-3 font-mono text-xs"
                >
                  {plan ? planPrice(plan) : t("Not verified", "未核验")}
                  <span className="mt-1 block font-sans text-ink-2">
                    {plan?.name}
                  </span>
                </td>
                <td data-label={t("Pricing Model", "付费方式")} className="p-3">
                  <div className="flex flex-wrap gap-1">
                    {modes(p).map((m) => (
                      <span className="badge bg-surface-2" key={m}>
                        {PRICING_MODELS[m]}
                      </span>
                    ))}
                  </div>
                </td>
                <td
                  data-label={t("Free Tier", "免费额度")}
                  className="p-3 text-xs"
                >
                  {hasFree(original)
                    ? t("Available — see limits", "提供，查看限制")
                    : t("Not verified / none listed", "未核验 / 未列出")}
                </td>
                <td
                  data-label={t("Cost per Unit", "单位成本")}
                  className="p-3 text-xs"
                >
                  {publicUnits(p)[0] ||
                    t("No fixed published unit rate", "未公布固定单位价")}
                </td>
                <td
                  data-label={t("Last Verified", "最后核验")}
                  className="p-3 text-xs"
                >
                  {p.status === "verified"
                    ? p.verifiedAt
                    : t("Pending verification", "待核验")}
                </td>
                <td className="p-3">
                  <div className="flex flex-wrap gap-2">
                    <CompareButton product={p} />
                    <Link
                      className="text-xs font-medium text-primary"
                      to={lp(`/alternatives/${p.slug}`)}
                    >
                      {t("Alternatives →", "平替 →")}
                    </Link>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
export function SourceList({ ids }: { ids: string[] }) {
  const catalog = useCatalog();
  const t = useCopy();
  return (
    <ul className="space-y-3 text-sm">
      {catalog.sources
        .filter((s) => ids.includes(s.id))
        .map((s) => (
          <li key={s.id}>
            <a
              className="font-medium text-primary underline underline-offset-4"
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              {s.title} ↗
            </a>
            <p className="mt-1 text-xs text-ink-2">
              {t("Checked", "核验于")} {s.checkedAt} · {s.notes}
            </p>
          </li>
        ))}
    </ul>
  );
}
export function PlanCards({ product }: { product: Product }) {
  const t = useCopy();
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {product.plans.map((p) => (
        <article className="card p-5" key={p.id}>
          <div className="flex flex-wrap justify-between gap-2">
            <h3 className="font-semibold">{p.name}</h3>
            <span className="font-mono text-primary">{planPrice(p)}</span>
          </div>
          <p className="mt-2 text-xs text-ink-2">
            {p.pricingModels.map((m) => PRICING_MODELS[m]).join(" · ")}
          </p>
          {p.billing === "annual" && p.amount !== null && (
            <p className="mt-2 text-sm">
              {t(
                "Full year paid upfront; monthly equivalent",
                "全年预付；月均",
              )}{" "}
              {new Intl.NumberFormat("en-US", {
                style: "currency",
                currency: p.currency,
              }).format(p.amount / 12)}
            </p>
          )}
          {p.freeAllowance && <p className="mt-3 text-sm">{p.freeAllowance}</p>}
          <p className="mt-3 text-xs">
            {t("Commercial use", "商用")}:{" "}
            {p.commercial === true
              ? t("Available, subject to vendor terms", "可用，受厂商条款约束")
              : p.commercial === false
                ? t("Not included", "不包含")
                : t("Check vendor terms", "请核对厂商条款")}
          </p>
          {p.features?.length ? (
            <p className="mt-3 text-xs text-ink-2">
              {t("Verified plan capabilities", "已核验套餐功能")}:{" "}
              {p.features.join(", ")}
            </p>
          ) : null}
          <ul className="my-3 list-inside list-disc space-y-1 text-xs text-ink-2">
            {p.limits.map((l) => (
              <li key={l}>{l}</li>
            ))}
            {p.components.map((c) => (
              <li key={c.id}>
                {c.model}
                {c.resolution ? " · " + c.resolution : ""}
                {c.creditAllowance !== null
                  ? ` · ${c.creditAllowance.toLocaleString()} credits`
                  : ""}
                {c.included !== null
                  ? ` · ${c.included.toLocaleString()} ${c.unit} included`
                  : ""}
                {c.overagePerCredit != null
                  ? ` · Overage: ${c.overagePerCredit} ${p.currency}/credit`
                  : ""}
                {c.note ? " · " + c.note : ""}
              </li>
            ))}
          </ul>
          <SourceList ids={p.sourceIds} />
        </article>
      ))}
    </div>
  );
}
export function Section({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="my-9">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-xl font-bold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
export function PlanOption({ p }: { p: Plan }) {
  return (
    <option value={p.id}>
      {p.name} — {planPrice(p)}
    </option>
  );
}
