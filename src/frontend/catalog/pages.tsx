import { ProductCard } from "./ProductCard";
import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useLocale, useLocalePath } from "../i18n";
import { useCatalog } from "./context";
import {
  Breadcrumbs,
  CompareButton,
  GlobalSearch,
  PageTitle,
  PlanCards,
  ProductTable,
  Section,
  SourceList,
  useCopy,
} from "./components";
import {
  CATEGORIES,
  PRICING_MODELS,
  type PricingModel,
  type Product,
} from "../../shared/catalog/types";
import {
  alternativeBadges,
  alternativeRelations,
  categoryOf,
  filterCatalog,
  modes,
  money,
  planPrice,
  publicUnits,
  startingPlan,
  verifiedPlans,
} from "../../shared/catalog/logic";
import { CostCalculator } from "./calculator";

export function CatalogHome() {
  const c = useCatalog();
  const t = useCopy();
  const lp = useLocalePath();
  const locale = useLocale();
  return (
    <>
      <div className="rounded-2xl border border-line bg-white p-6 sm:p-10">
        <p className="eyebrow">
          AI TOOLS PRICE COMPARISON & AFFORDABLE ALTERNATIVES
        </p>
        <h1 className="mt-4 max-w-4xl font-display text-4xl font-bold tracking-tight sm:text-5xl">
          Find Better AI Tools.
          <br />
          <span className="text-primary">Spend Less.</span>
        </h1>
        <p className="mb-7 mt-4 max-w-2xl text-ink-2">
          {t(
            "Compare AI tools, discover cheaper alternatives and calculate your real creation costs.",
            "对比 AI 工具，发现更便宜的替代方案，计算真实创作成本。",
          )}
        </p>
        <div className="max-w-2xl">
          <GlobalSearch />
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          {CATEGORIES.map((cat) => (
            <Link
              className="chip"
              key={cat.id}
              to={lp("/category/" + cat.slug)}
            >
              {locale === "zh" ? cat.zh : cat.en}
            </Link>
          ))}
        </div>
        <Link
          className="mt-5 inline-block text-sm font-semibold text-primary"
          to={lp("/alternatives")}
        >
          {t("Find Cheaper Alternatives →", "寻找低价平替 →")}
        </Link>
      </div>
      <Section
        title={t("Verified AI tools", "已核验 AI 工具")}
        action={
          <Link className="text-sm text-primary" to={lp("/tools")}>
            {t("View all →", "查看全部 →")}
          </Link>
        }
      >
        <ProductTable
          products={filterCatalog(c, {})
            .filter((p) => p.status === "verified")
            .slice(0, 5)}
        />
        <p className="mt-2 text-xs text-ink-2">
          {t(
            "Selected from verified listings. No popularity or quality ranking is implied.",
            "从已核验目录中展示，未宣称热度或质量排名。",
          )}
        </p>
      </Section>
      <Section title={t("Lower monthly entry prices", "较低月付入门价")}>
        <ProductTable
          products={filterCatalog(c, { basis: "monthly", sort: "price" }).slice(
            0,
            4,
          )}
          basis="monthly"
        />
        <p className="mt-2 text-xs text-ink-2">
          {t(
            "USD monthly subscriptions only. Included usage and features differ.",
            "仅对比美元月付订阅的入门金额，包含用量和功能不同。",
          )}
        </p>
      </Section>
      <Section
        title={t("Find value for your workload", "按实际用量寻找高性价比方案")}
      >
        <div className="grid gap-3 sm:grid-cols-3">
          {["midjourney", "runway", "elevenlabs"].map((id) => {
            const p = c.products.find((p) => p.id === id);
            return (
              p && (
                <Link
                  className="card p-5 hover:border-primary"
                  key={id}
                  to={lp("/alternatives/" + id)}
                >
                  <span className="text-xs text-primary">
                    AFFORDABLE ALTERNATIVES
                  </span>
                  <h3 className="mt-2 font-semibold">{p.name}</h3>
                  <p className="mt-2 text-sm text-ink-2">
                    {t(
                      "See pricing, functional differences and savings conditions.",
                      "查看价格、功能差异和节省成立的条件。",
                    )}
                  </p>
                  <span className="mt-3 block text-sm text-primary">
                    {t("Explore alternatives →", "查找平替 →")}
                  </span>
                </Link>
              )
            );
          })}
        </div>
      </Section>
      <Section title={t("Calculate your creation costs", "计算你的创作成本")}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {CATEGORIES.map((cat) => (
            <Link
              className="card p-5 hover:border-primary"
              key={cat.id}
              to={lp("/calculator/" + cat.id)}
            >
              <h3 className="font-semibold">
                {locale === "zh" ? cat.zh : cat.en}
              </h3>
              <p className="mt-2 text-sm text-ink-2">
                {t(
                  "Choose a plan. Enter usage. Compare real costs.",
                  "选择套餐，输入用量，对比实际成本。",
                )}
              </p>
              <span className="mt-3 block text-sm text-primary">
                {t("Open calculator →", "打开计算器 →")}
              </span>
            </Link>
          ))}
        </div>
      </Section>
      <Section title={t("Recently verified prices", "最近核验价格")}>
        <div className="card divide-y divide-line">
          {c.products
            .filter((p) => p.status === "verified")
            .slice(0, 5)
            .map((p) => (
              <Link
                className="flex flex-wrap justify-between gap-3 p-4 text-sm"
                key={p.id}
                to={lp("/tools/" + p.slug)}
              >
                <span>{p.name}</span>
                <span className="text-ink-2">
                  {t("Verified", "已核验")} {p.verifiedAt}
                </span>
              </Link>
            ))}
        </div>
        <p className="mt-2 text-xs text-ink-2">
          {t(
            "Verification dates are not claims of a price change.",
            "核验日期不代表价格发生了变化。",
          )}
        </p>
      </Section>
      <Section title={t("Comparisons to explore", "值得查看的对比")}>
        <div className="flex flex-wrap gap-3">
          {c.alternatives.slice(0, 4).map((a) => (
            <Link
              className="chip"
              key={a.id}
              to={lp(`/compare/${a.original}-vs-${a.alternative}`)}
            >
              {c.products.find((p) => p.id === a.original)?.name} vs{" "}
              {c.products.find((p) => p.id === a.alternative)?.name}
            </Link>
          ))}
        </div>
      </Section>
    </>
  );
}

export function CatalogDirectory({
  alternativeMode = false,
}: {
  alternativeMode?: boolean;
}) {
  const c = useCatalog();
  const [drawer, setDrawer] = useState(false);
  const t = useCopy();
  const lp = useLocalePath();
  const locale = useLocale();
  const { category, pricing } = useParams();
  const [params, setParams] = useSearchParams();
  const cat = categoryOf(category || params.get("category") || undefined);
  const basis =
    params.get("basis") ||
    (pricing && ["monthly", "annual", "free", "one-time"].includes(pricing)
      ? pricing
      : pricing === "usage-based-package"
        ? "package"
        : "all");
  const selected = pricing ? [pricing] : params.getAll("pricing");
  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key === "basis") {
      next.delete("range");
      if (value === "all") next.delete("sort");
    }
    setParams(next, { replace: true });
  };
  const toggle = (m: string) => {
    const next = new URLSearchParams(params);
    const values = next.getAll("pricing");
    next.delete("pricing");
    (values.includes(m)
      ? values.filter((x) => x !== m)
      : [...values, m]
    ).forEach((x) => next.append("pricing", x));
    setParams(next, { replace: true });
  };
  if (
    (category && !cat) ||
    (pricing && !Object.hasOwn(PRICING_MODELS, pricing))
  )
    return <NotFound />;
  const products = filterCatalog(c, {
    q: params.get("q") || "",
    category: cat?.id,
    pricing: selected,
    basis,
    range: params.get("range") || "all",
    free: params.get("free") === "1",
    api: params.get("api") === "1",
    noSubscription: params.get("noSubscription") === "1",
    commercial: params.get("commercial") === "1",
    sort: params.get("sort") || "updated",
    feature: params.get("feature") || "",
  });
  const title = alternativeMode
    ? t("Affordable Alternatives", "低价平替")
    : cat
      ? locale === "zh"
        ? cat.zh
        : cat.en
      : pricing
        ? `${PRICING_MODELS[pricing as PricingModel]} AI Tools`
        : t("Explore AI tools & prices", "探索 AI 工具与价格");
  return (
    <>
      <Breadcrumbs items={[{ name: title }]} />
      <PageTitle
        title={title}
        description={
          alternativeMode
            ? t(
                "Find the tool you use, then inspect alternatives with explicit evidence and tradeoffs.",
                "找到正在使用的工具，查看有明确依据与限制的替代方案。",
              )
            : t(
                "Compare published offers in a consistent billing unit. Unknown prices are never treated as free.",
                "按一致的计价口径筛选已公布方案，未知价格不会被视为免费。",
              )
        }
      />
      <div className="mb-6">
        <GlobalSearch alternatives={alternativeMode} />
      </div>
      <div className="mb-6 flex flex-wrap items-center gap-2 border-b border-line pb-4">
        <Link
          className={`chip ${!cat ? "chip-active" : ""}`}
          to={lp(alternativeMode ? "/alternatives" : "/tools")}
        >
          {t("All", "全部")}
        </Link>
        {CATEGORIES.map((x) => (
          <Link
            className={`chip ${cat?.id === x.id ? "chip-active" : ""}`}
            key={x.id}
            to={lp("/category/" + x.slug)}
          >
            {locale === "zh" ? x.zh : x.en}
          </Link>
        ))}
        <Link className="chip" to={lp("/tools?category=llm-api")}>
          LLM / API
        </Link>
        <Link className="chip" to={lp("/tools?dataset=legacy")}>
          {t("Original filters (demo)", "原目录筛选（示例）")}
        </Link>
        {!alternativeMode && (
          <Link className="chip" to={lp("/alternatives")}>
            {t("Affordable Alternatives", "低价平替")}
          </Link>
        )}
      </div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <button
          className="btn-secondary !py-1.5 lg:hidden"
          onClick={() => setDrawer(true)}
        >
          {t("Filters", "筛选")}
        </button>
        <span className="text-xs text-ink-2">
          {t(
            "Official prices use their billing currency; filters use the selected USD basis.",
            "官方价格保留原结算币种；价格筛选按所选美元口径。",
          )}
        </span>
        {!alternativeMode && (
          <div className="inline-flex overflow-hidden rounded-lg border border-line text-sm font-medium">
            {["table", "card"].map((view) => (
              <button
                key={view}
                aria-pressed={(params.get("view") || "table") === view}
                onClick={() => set("view", view)}
                className={`px-3 py-1.5 ${(params.get("view") || "table") === view ? "bg-primary text-white" : "bg-surface text-ink-2"}`}
              >
                {view === "table" ? t("Table", "表格") : t("Cards", "卡片")}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="flex gap-6">
        {drawer && (
          <button
            aria-label={t("Close filters", "关闭筛选")}
            className="fixed inset-0 z-40 bg-ink/30 lg:hidden"
            onClick={() => setDrawer(false)}
          />
        )}
        <aside
          aria-label={t("Catalog filters", "目录筛选")}
          className={`${drawer ? "fixed inset-y-0 right-0 z-50 block w-80 max-w-[85vw] overflow-y-auto bg-surface p-5 shadow-pop" : "hidden"} lg:static lg:z-auto lg:block lg:w-56 lg:max-w-none lg:flex-none lg:overflow-visible lg:bg-transparent lg:p-0 lg:shadow-none`}
        >
          <button
            className="btn-secondary mb-4 lg:hidden"
            onClick={() => setDrawer(false)}
          >
            {t("Apply / close", "应用 / 关闭")}
          </button>
          <div className="grid gap-4">
            <label className="text-xs font-medium">
              {t("Search within results", "在结果中搜索")}
              <input
                className="input mt-1"
                value={params.get("q") || ""}
                onChange={(e) => set("q", e.target.value)}
              />
            </label>
            <label className="text-xs font-medium">
              {t("Price basis · USD", "价格口径 · 美元")}
              <select
                aria-label={t("Price basis · USD", "价格口径 · 美元")}
                className="input mt-1"
                value={basis}
                onChange={(e) => set("basis", e.target.value)}
              >
                {[
                  ["all", "All billing units / 不混排价格"],
                  ["monthly", "Monthly subscription / 月付"],
                  ["annual", "Annual upfront / 年付总额"],
                  ["free", "Free plans / 免费套餐"],
                  ["one-time", "One-time purchase / 一次性购买"],
                  ["package", "Fixed package entry / 固定套餐入门费"],
                  ["image", "Per image / 每张图片"],
                  ["second", "Per second / 每秒"],
                  ["characters", "Per 1M characters / 每百万字符"],
                  ["minute", "Per minute / 每分钟"],
                  ["song", "Per song / 每首"],
                  ["generation", "Per generation / 每次生成"],
                ].map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-medium">
              {t("Price range in selected basis", "按所选口径筛选价格")}
              <select
                className="input mt-1"
                disabled={basis === "all"}
                value={params.get("range") || "all"}
                onChange={(e) => set("range", e.target.value)}
              >
                {[
                  ["all", "Any / 全部"],
                  ["free", "$0"],
                  ["under-10", "Under $10"],
                  ["10-30", "$10–<30"],
                  ["30-100", "$30–<100"],
                  ["100+", "$100+"],
                ].map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-medium">
              {t("Sort", "排序")}
              <select
                aria-label={t("Sort", "排序")}
                className="input mt-1"
                value={params.get("sort") || "updated"}
                onChange={(e) => set("sort", e.target.value)}
              >
                <option value="updated">
                  {t("Recently verified", "最近核验")}
                </option>
                <option value="price" disabled={basis === "all"}>
                  {t(
                    [
                      "monthly",
                      "annual",
                      "free",
                      "one-time",
                      "package",
                    ].includes(basis)
                      ? "Lowest Starting Price"
                      : "Lowest Cost per Unit",
                    [
                      "monthly",
                      "annual",
                      "free",
                      "one-time",
                      "package",
                    ].includes(basis)
                      ? "最低起始价格"
                      : "最低单位成本",
                  )}
                </option>
              </select>
            </label>
          </div>
          {!pricing && (
            <fieldset className="mt-4">
              <legend className="mb-2 text-xs font-semibold">
                Pricing Model ·{" "}
                {t(
                  "Match any selected model on a plan",
                  "套餐匹配任一所选付费方式",
                )}
              </legend>
              <div className="flex flex-wrap gap-2">
                {Object.entries(PRICING_MODELS).map(([v, l]) => (
                  <button
                    key={v}
                    onClick={() => toggle(v)}
                    aria-pressed={selected.includes(v)}
                    className={`chip !text-xs ${selected.includes(v) ? "chip-active" : ""}`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </fieldset>
          )}
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-3">
            {[
              ["free", t("Has free tier", "提供免费额度")],
              ["noSubscription", t("No subscription required", "无需订阅")],
              ["api", t("API available", "提供 API")],
              ["commercial", t("Commercial use available", "提供可商用套餐")],
            ].map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={params.get(key) === "1"}
                  onChange={(e) => set(key, e.target.checked ? "1" : "")}
                />
                {label}
              </label>
            ))}
            <button
              onClick={() => setParams({})}
              className="text-xs text-primary underline"
            >
              {t("Reset filters", "重置筛选")}
            </button>
          </div>
          {cat && (
            <label className="mt-4 block text-xs">
              {t("Capability", "功能")}
              <select
                className="input mt-1 max-w-sm"
                value={params.get("feature") || ""}
                onChange={(e) => set("feature", e.target.value)}
              >
                <option value="">{t("Any capability", "全部功能")}</option>
                {cat.features.map((f) => (
                  <option key={f} value={f}>
                    {f.replaceAll("-", " ")}
                  </option>
                ))}
              </select>
            </label>
          )}
        </aside>
        <div className="min-w-0 flex-1">
          <div className="mb-3 flex flex-wrap justify-between gap-2 text-xs text-ink-2">
            <span>
              {products.length} {t("products", "个产品")}
            </span>
            <span>
              {t(
                "No popularity or quality scores without evidence. Compare usage costs for value.",
                "无可靠数据不提供热度或质量评分；性价比请按实际用量计算。",
              )}
            </span>
          </div>
          {alternativeMode ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {products.map((p) => (
                <Link
                  key={p.id}
                  className="card p-5 hover:border-primary"
                  to={lp("/alternatives/" + p.slug)}
                >
                  <h2 className="font-semibold">{p.name}</h2>
                  <p className="mt-2 text-sm text-ink-2">
                    {startingPlan(p)
                      ? planPrice(startingPlan(p)!)
                      : t("Price awaiting verification", "价格待核验")}
                  </p>
                  <span className="mt-4 block text-sm text-primary">
                    {t("Find Cheaper Alternatives →", "查找更便宜的平替 →")}
                  </span>
                </Link>
              ))}
            </div>
          ) : params.get("view") === "card" && products.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {products.map((p) => (
                <ProductCard
                  key={p.id}
                  product={p}
                  filters={{
                    basis,
                    pricing: selected,
                    commercial: params.get("commercial") === "1",
                    noSubscription: params.get("noSubscription") === "1",
                    range: params.get("range") || "all",
                  }}
                />
              ))}
            </div>
          ) : (
            <ProductTable
              products={products}
              basis={basis}
              filters={{
                basis,
                pricing: selected,
                commercial: params.get("commercial") === "1",
                noSubscription: params.get("noSubscription") === "1",
                range: params.get("range") || "all",
              }}
            />
          )}
        </div>
      </div>
    </>
  );
}

export function ProductDetail() {
  const { slug } = useParams();
  const c = useCatalog();
  const p = c.products.find((p) => p.slug === slug);
  const lp = useLocalePath();
  const t = useCopy();
  const locale = useLocale();
  if (!p) return <NotFound />;
  const cat = CATEGORIES.find((x) => x.id === p.category)!;
  const relations = alternativeRelations(c, p.id);
  return (
    <>
      <Breadcrumbs
        items={[
          { name: cat.en, path: "/category/" + cat.slug },
          { name: p.name },
        ]}
      />
      <PageTitle
        title={`${p.name} ${t("pricing & alternatives", "价格与平替")}`}
        description={locale === "zh" ? p.summaryZh : p.summary}
      >
        <div className="mt-5 flex flex-wrap gap-3">
          <a
            className="btn-primary"
            href={p.website}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t("Visit official platform ↗", "访问官方平台 ↗")}
          </a>
          <Link className="btn-secondary" to={lp("/alternatives/" + p.slug)}>
            {t("Find Cheaper Alternatives", "寻找更便宜的替代品")}
          </Link>
          <CompareButton product={p} />
        </div>
      </PageTitle>
      <p className="text-xs text-ink-2">
        {t("Last verified", "最后核验")}:{" "}
        {p.verifiedAt || t("Pending", "待核验")} · {p.provider}
      </p>
      <Section title={t("Capabilities", "核心功能")}>
        <div className="flex flex-wrap gap-2">
          {p.features.map((f) => (
            <span className="chip !cursor-default" key={f}>
              {f.replaceAll("-", " ")}
            </span>
          ))}
          {!p.features.length && (
            <p>{t("Capabilities await verification.", "功能资料待核验。")}</p>
          )}
        </div>
      </Section>
      <Section title={t("Plans & pricing", "套餐与计价")}>
        {p.plans.length ? (
          <PlanCards product={p} />
        ) : (
          <div className="card p-6">
            {t(
              "Pricing is awaiting official verification. This listing does not participate in price rankings.",
              "官方价格待核验，本产品暂不参与价格排名。",
            )}
          </div>
        )}
      </Section>
      <Section title="Affordable Alternatives">
        <AlternativeCards product={p} />
        {relations.length > 0 && (
          <Link
            className="mt-4 inline-block text-sm text-primary"
            to={lp("/alternatives/" + p.slug)}
          >
            {t(
              "Compare alternatives and estimate savings →",
              "比较平替并计算节省 →",
            )}
          </Link>
        )}
      </Section>
      <Section title={t("Official sources", "官方来源")}>
        <SourceList ids={p.sourceIds} />
        {c.affiliateLinks
          ?.filter((a) => a.productId === p.id && a.active)
          .map((a) => (
            <p key={a.id} className="mt-4 text-xs text-ink-2">
              <a
                href={a.url}
                target="_blank"
                rel="sponsored nofollow noopener noreferrer"
                className="text-primary underline"
              >
                {t("Affiliate link ↗", "推广链接 ↗")}
              </a>{" "}
              · {a.disclosure}
            </p>
          ))}
      </Section>
      <Section
        title={t(
          "Related products — no cheaper claim",
          "相关产品，不代表更便宜",
        )}
      >
        <ProductTable
          products={c.products
            .filter((x) => x.category === p.category && x.id !== p.id)
            .slice(0, 3)}
        />
      </Section>
    </>
  );
}

export function AlternativeCards({ product }: { product: Product }) {
  const c = useCatalog();
  const t = useCopy();
  const lp = useLocalePath();
  const rel = alternativeRelations(c, product.id);
  if (!rel.length)
    return (
      <div className="card p-5 text-sm text-ink-2">
        {t(
          "No verified alternative relationship yet. Browse this category or submit official evidence.",
          "暂无已核验的平替关系，可浏览同类产品或提交官方资料。",
        )}
      </div>
    );
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {rel.map((a) => {
        const p = c.products.find((p) => p.id === a.alternative)!;
        return (
          <article key={a.id} className="card p-5">
            <Link className="text-lg font-semibold" to={lp("/tools/" + p.slug)}>
              {p.name}
            </Link>
            <p className="mt-1 font-mono text-sm text-primary">
              {startingPlan(p) ? planPrice(startingPlan(p)!) : "Not verified"}
            </p>
            <div className="my-3 flex flex-wrap gap-1">
              {alternativeBadges(product, p).map((b) => (
                <span className="badge bg-primary-50 text-primary-700" key={b}>
                  {b}
                </span>
              ))}
            </div>
            <p className="text-sm">{a.reason}</p>
            <p className="mt-2 text-sm text-ink-2">{a.difference}</p>
            <p className="mt-2 text-xs text-ink-2">
              {t("Use case", "适用场景")}: {a.scenario}
            </p>
            <p className="mt-2 text-xs">{a.priceAdvantage}</p>
            <div className="my-4 flex flex-wrap gap-3">
              <Link
                className="btn-secondary"
                to={lp(`/compare/${product.slug}-vs-${p.slug}`)}
              >
                {t("Compare", "比较")}
              </Link>
              <a
                className="text-sm text-primary"
                href={p.website}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t("Official platform ↗", "官方平台 ↗")}
              </a>
            </div>
            <SourceList ids={a.sourceIds} />
          </article>
        );
      })}
    </div>
  );
}
function AlternativeSummary({ product }: { product: Product }) {
  const c = useCatalog();
  const t = useCopy();
  const lp = useLocalePath();
  const relations = alternativeRelations(c, product.id);
  const reference = startingPlan(product, "monthly");
  const entries = [
    {
      p: product,
      difference: t("Reference product", "原产品"),
      original: true,
    },
    ...relations.map((a) => ({
      p: c.products.find((p) => p.id === a.alternative)!,
      difference: a.difference,
      original: false,
    })),
  ];
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-white">
      <table className="product-table w-full text-left text-sm">
        <thead className="bg-surface-2 text-xs text-ink-2">
          <tr>
            {[
              "Product",
              "Starting Price",
              "Pricing Model",
              "Monthly entry difference",
              "Key Difference",
              "Action",
            ].map((h) => (
              <th key={h} className="p-3">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {entries.map(({ p, difference, original }) => {
            const start = startingPlan(p);
            const monthly = startingPlan(p, "monthly");
            const comparable =
              reference &&
              monthly &&
              reference.currency === monthly.currency &&
              reference.amount !== null &&
              monthly.amount !== null;
            const delta = comparable
              ? reference!.amount! - monthly!.amount!
              : null;
            return (
              <tr className="border-t border-line align-top" key={p.id}>
                <td className="p-3 font-semibold" data-label="Product">
                  {p.name}
                  {original && (
                    <span className="mt-1 block text-xs font-normal text-ink-2">
                      {t("Reference", "原方案")}
                    </span>
                  )}
                </td>
                <td
                  className="p-3 font-mono text-xs"
                  data-label="Starting Price"
                >
                  {start ? planPrice(start) : t("Not verified", "未核验")}
                </td>
                <td className="p-3 text-xs" data-label="Pricing Model">
                  {modes(p)
                    .map((m) => PRICING_MODELS[m])
                    .join(" / ")}
                </td>
                <td className="p-3 text-xs" data-label="Monthly difference">
                  {original
                    ? "—"
                    : delta === null
                      ? t("No matching monthly offers", "没有相同月付口径")
                      : delta === 0
                        ? t("Same entry price", "入门价相同")
                        : `${money(Math.abs(delta), reference!.currency)} ${delta > 0 ? t("less / month", "/ 月更低") : t("more / month", "/ 月更高")}`}
                </td>
                <td className="p-3 text-xs" data-label="Key Difference">
                  {difference}
                </td>
                <td className="p-3">
                  <Link
                    className="text-primary"
                    to={lp(
                      original
                        ? "/tools/" + p.slug
                        : `/compare/${product.slug}-vs-${p.slug}`,
                    )}
                  >
                    {original ? t("View", "查看") : t("Compare", "比较")}
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="border-t border-line p-3 text-xs text-ink-2">
        {t(
          "Monthly entry differences compare regular subscription fees only, not included output or actual savings. Use the calculator for workload costs.",
          "月付入门价差仅比较常规订阅费，不代表相同输出量或实际节省；请使用计算器按用量计算。",
        )}
      </p>
    </div>
  );
}
export function AlternativesPage() {
  const { slug } = useParams();
  const c = useCatalog();
  const p = c.products.find((p) => p.slug === slug);
  const t = useCopy();
  if (!p) return <NotFound />;
  const rel = alternativeRelations(c, p.id);
  const ids = [p.id, ...rel.map((a) => a.alternative)];
  return (
    <>
      <Breadcrumbs
        items={[
          { name: "Affordable Alternatives", path: "/alternatives" },
          { name: p.name },
        ]}
      />
      <PageTitle
        title={t(
          `Cheaper Alternatives to ${p.name}`,
          `${p.name} 的低价替代方案`,
        )}
        description={t(
          "Check the original plan, compare functional differences, then calculate savings for your workload. A shared feature is not a quality-equivalence score.",
          "查看原套餐、比较功能差异，再按实际用量计算节省；共享功能不代表质量相同。",
        )}
      />
      <Section
        title={t("Reference product & current offers", "原产品与当前方案")}
      >
        <PlanCards product={p} />
        {!p.plans.length && (
          <p className="text-ink-2">
            {t(
              "Original pricing is not verified; savings cannot be established.",
              "原产品价格未核验，无法得出节省结论。",
            )}
          </p>
        )}
      </Section>
      <Section title={t("At-a-glance comparison", "价格与功能速览")}>
        <AlternativeSummary product={p} />
      </Section>
      <Section title={t("Evidence-based alternatives", "有依据的平替方案")}>
        <AlternativeCards product={p} />
      </Section>
      {rel.length > 0 && (
        <CostCalculator
          category={p.category}
          initialProducts={ids}
          originalId={p.id}
        />
      )}
    </>
  );
}

export function ComparePage() {
  const compareLp = useLocalePath();
  const { pair } = useParams();
  const [params, setParams] = useSearchParams();
  const c = useCatalog();
  const t = useCopy();
  const [adding, setAdding] = useState("");
  const ids = (
    pair ? pair.split("-vs-") : (params.get("tools") || "").split(",")
  ).filter(Boolean);
  const products = [...new Set(ids)]
    .map((id) => c.products.find((p) => p.slug === id))
    .filter((p): p is Product => !!p)
    .slice(0, 4);
  if (pair && (ids.length !== 2 || products.length !== 2)) return <NotFound />;
  const fields: [string, (p: Product) => string][] = [
    [
      "Starting price",
      (p) => (startingPlan(p) ? planPrice(startingPlan(p)!) : "Not verified"),
    ],
    [
      "Pricing models",
      (p) =>
        modes(p)
          .map((m) => PRICING_MODELS[m])
          .join(", ") || "Not verified",
    ],
    [
      "Free allowance",
      (p) =>
        verifiedPlans(p)
          .map((x) => x.freeAllowance)
          .filter(Boolean)
          .join(" / ") || "Not verified / none listed",
    ],
    [
      "Published unit costs",
      (p) => publicUnits(p).join(" / ") || "No fixed published unit rate",
    ],
    ["Capabilities", (p) => p.features.join(", ") || "Pending verification"],
    [
      "Limits",
      (p) =>
        verifiedPlans(p)
          .flatMap((x) => x.limits)
          .join(" / ") || "See official terms",
    ],
    ["Last verified", (p) => p.verifiedAt || "Pending"],
  ];
  return (
    <>
      <Breadcrumbs items={[{ name: t("Compare products", "产品比较") }]} />
      {ids.some((id) => !c.products.some((p) => p.slug === id)) && (
        <p
          role="status"
          className="mb-4 rounded-lg border border-line bg-surface-2 p-4 text-sm"
        >
          {t(
            "Some selected tools only exist in the original demo directory and have no verified plans. They are excluded from price calculations; you can enter their actual prices in the manual calculator.",
            "部分所选工具仅存在于原示例目录，尚无核验套餐，不参与价格计算；可以在原手动计算器中输入实际价格。",
          )}{" "}
          <Link
            className="text-primary underline"
            to={compareLp("/calculator")}
          >
            {t("Manual calculator", "手动计算器")}
          </Link>
        </p>
      )}
      <PageTitle
        title={
          products.length === 2
            ? products.map((p) => p.name).join(" vs ")
            : t("Compare AI tools", "比较 AI 工具")
        }
        description={t(
          "Compare up to four products. Starting prices are shown with their billing conditions; savings require a matching workload.",
          "最多比较四个产品；起始价同时展示计费条件，节省金额须按一致用量计算。",
        )}
      />
      {!pair && (
        <div className="mb-5 flex flex-wrap gap-2">
          <label className="flex-1">
            <span className="sr-only">{t("Add product", "添加产品")}</span>
            <select
              className="input"
              value={adding}
              onChange={(e) => setAdding(e.target.value)}
            >
              <option value="">{t("Choose a product", "选择产品")}</option>
              {c.products
                .filter((p) => !ids.includes(p.slug))
                .map((p) => (
                  <option key={p.id} value={p.slug}>
                    {p.name}
                  </option>
                ))}
            </select>
          </label>
          <button
            disabled={!adding || products.length >= 4}
            className="btn-primary"
            onClick={() => {
              setParams({
                tools: [...products.map((p) => p.slug), adding].join(","),
              });
              setAdding("");
            }}
          >
            {t("Add to comparison", "添加比较")}
          </button>
        </div>
      )}
      {!products.length ? (
        <div className="card p-8">
          {t(
            "Choose products above or use + Compare in the directory.",
            "请在上方选择产品，或在目录中使用“+ 对比”。",
          )}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {products.map((p) => (
            <article key={p.id} className="card min-w-0 p-5">
              <h2 className="text-lg font-semibold">{p.name}</h2>
              {!pair && (
                <button
                  className="mt-1 text-xs text-ink-2 underline"
                  onClick={() =>
                    setParams({
                      tools: products
                        .filter((x) => x.id !== p.id)
                        .map((x) => x.slug)
                        .join(","),
                    })
                  }
                >
                  {t("Remove", "移除")}
                </button>
              )}
              <dl className="mt-5 space-y-4">
                {fields.map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-xs font-semibold text-ink-2">
                      {label}
                    </dt>
                    <dd className="mt-1 break-words text-sm">{value(p)}</dd>
                  </div>
                ))}
              </dl>
              <a
                className="btn-secondary mt-5"
                href={p.website}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t("Official pricing ↗", "官方价格 ↗")}
              </a>
              <div className="mt-4">
                <SourceList ids={p.sourceIds} />
              </div>
            </article>
          ))}
        </div>
      )}
      {products.length > 0 &&
        (products.every((p) => p.category === products[0].category) ? (
          <CostCalculator
            key={products.map((p) => p.id).join(",")}
            category={products[0].category}
            initialProducts={products.map((p) => p.id)}
            originalId={products[0].id}
          />
        ) : (
          <p className="mt-5 rounded-lg bg-warn-soft p-4 text-sm">
            {t(
              "Different product categories cannot be ranked by a shared unit cost.",
              "不同产品类别无法按统一单位成本排名。",
            )}
          </p>
        ))}
    </>
  );
}
export function CalculatorPage() {
  const { kind } = useParams();
  const cat = categoryOf(kind);
  const t = useCopy();
  if (!cat) return <NotFound />;
  return (
    <>
      <Breadcrumbs items={[{ name: cat.en + " Cost Calculator" }]} />
      <PageTitle
        title={t(cat.en + " Cost Calculator", cat.zh + "成本计算器")}
        description={t(
          "Use published plans and explicit workload assumptions. Unsupported conversions remain unranked.",
          "使用已公布的套餐与明确用量条件；缺少换算依据的方案不参与排名。",
        )}
      />
      <CostCalculator category={cat.id} />
    </>
  );
}
export function MethodologyPage() {
  const t = useCopy();
  const lp = useLocalePath();
  return (
    <>
      <PageTitle
        title={t(
          "How OpenPriceHub compares prices",
          "OpenPriceHub 如何比较价格",
        )}
        description="AI Tools Price Comparison & Affordable Alternatives Platform"
      />
      <div className="card max-w-3xl space-y-5 p-6 text-sm leading-7">
        <p>
          {t(
            "Find Better AI Tools. Spend Less. We link every published price to a source and show when it was checked. Unknown means unknown, not free.",
            "找到更适合的 AI 工具，减少支出。每项价格关联来源与核验日期，未知价格不等于免费。",
          )}
        </p>
        <p>
          {t(
            "Pricing models belong to offers and plans. Monthly, annual, per-character, per-image and credit charges stay in separate comparison groups. Annual equivalents always show the upfront commitment.",
            "付费方式属于方案与套餐。月付、年付、字符、图片和积分价格分别比较，年付折算同时展示全年预付款。",
          )}
        </p>
        <p>
          {t(
            "Alternative relationships are directional editorial assessments of documented capabilities. They are not quality scores. Cheapest and best value require a stated workload and comparable results.",
            "平替是基于已记录功能的定向编辑判断，不是质量评分。最低成本和性价比结论需要明确使用场景与可比结果。",
          )}
        </p>
        <p>
          {t(
            "We do not have reliable popularity measurements, so we do not publish popularity rankings. Affiliate commissions are excluded from every price calculation and ordering function. Sponsored links, if added, must be labeled.",
            "当前没有可靠热度数据，因此不发布热度排名。佣金不参与价格计算和排序，赞助链接须显式标记。",
          )}
        </p>
        <p>
          {t(
            "Calculations exclude tax, failed generations, retries and unverified overage charges. A free tier may restrict commercial use or downloads. Verify vendor terms before purchasing.",
            "计算不含税费、失败重试和未经核验的超额费用。免费方案可能限制商用或下载，请以厂商条款为准。",
          )}
        </p>
        <Link className="text-primary underline" to={lp("/submit")}>
          {t("Submit a source or correction", "提交来源或更正")}
        </Link>
      </div>
    </>
  );
}
export function NotFound() {
  const t = useCopy();
  const lp = useLocalePath();
  return (
    <>
      <PageTitle
        title={t("Page not found", "页面不存在")}
        description={t(
          "This product or page is not in the verified directory.",
          "目录中没有此产品或页面。",
        )}
      />
      <Link className="btn-primary" to={lp("/tools")}>
        {t("Browse tools", "浏览工具")}
      </Link>
    </>
  );
}
