// Original homepage composition and visual system, extended with verified catalog data.
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useT, useLocale, useLocalePath } from "../i18n";
import { ScenarioCard } from "../components/ScenarioCard";
import { GlobalSearch } from "../catalog/components";
import { ProductCard } from "../catalog/ProductCard";
import { useCatalog } from "../catalog/context";
import { CATEGORIES } from "../../shared/catalog/types";
import { filterCatalog } from "../../shared/catalog/logic";
import { SCENE_TEXT } from "../lib/scene";
function SectionHeader({
  title,
  action,
}: {
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <h2 className="font-display text-xl font-bold text-ink sm:text-2xl">
        {title}
      </h2>
      {action}
    </div>
  );
}
export default function Home() {
  const t = useT();
  const zh = useLocale() === "zh";
  const lp = useLocalePath();
  const c = useCatalog();
  const verified = filterCatalog(c, { sort: "updated" }).filter(
    (p) => p.status === "verified",
  );
  const cheapest = filterCatalog(c, { basis: "monthly", sort: "price" }).slice(
    0,
    4,
  );
  const relations = c.alternatives.filter((a) => a.status === "verified");
  return (
    <div className="space-y-16">
      <section className="animate-fade-up pt-4 text-center">
        <h1 className="mx-auto max-w-3xl font-display text-3xl font-bold leading-tight tracking-tight text-ink sm:text-5xl">
          Find Better AI Tools. Spend Less.
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-base text-ink-2 sm:text-lg">
          {zh
            ? "比较 AI 工具，发现低价平替，计算你的真实创作成本。"
            : "Compare AI tools, discover cheaper alternatives and calculate your real creation costs."}
        </p>
        <div className="mx-auto mt-8 max-w-2xl">
          <GlobalSearch />
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-sm text-ink-2">
          <Link to={lp("/alternatives")} className="chip">
            {zh ? "查找低价平替" : "Find Cheaper Alternatives"} →
          </Link>
          <Link to={lp("/tools?category=llm-api")} className="chip">
            LLM / API
          </Link>
          <Link to={lp("/calculator")} className="chip">
            {t("nav.calculator")}
          </Link>
        </div>
      </section>
      <section>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {CATEGORIES.map((cat) => (
            <ScenarioCard
              key={cat.id}
              category={cat.id}
              title={zh ? cat.zh : cat.en}
              desc={
                zh
                  ? {
                      image: "文生图、图片编辑、增强与放大",
                      video: "文生视频、图生视频、编辑与增强",
                      voice: "文字转语音、声音克隆与语音处理",
                      music: "歌曲、配乐、音乐编辑与音效生成",
                    }[cat.id]
                  : cat.features
                      .slice(0, 3)
                      .map((f) => f.replaceAll("-", " "))
                      .join(" · ")
              }
              to={lp(`/category/${cat.slug}`)}
            />
          ))}
        </div>
      </section>
      <section className="overflow-hidden rounded-card border border-primary-100 bg-primary-50/60">
        <div className="flex flex-col gap-6 p-6 sm:p-8 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <span className="eyebrow">CALCULATOR</span>
            <h2 className="mt-2 font-display text-2xl font-bold text-ink">
              {t("home.calcTitle")}
            </h2>
            <p className="mt-2 max-w-xl text-ink-2">{t("home.calcSubtitle")}</p>
            <Link
              className="mt-3 inline-block text-sm font-semibold text-primary"
              to={lp("/calculator")}
            >
              {zh
                ? "打开原手动计算器（快速 / 详细 / 导入导出）"
                : "Open manual workspace (quick / detailed / import / export)"}{" "}
              →
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {CATEGORIES.map((cat) => (
              <Link
                key={cat.id}
                to={lp(`/calculator/${cat.id}`)}
                className="btn-secondary justify-start"
              >
                {zh ? cat.zh : cat.en}
              </Link>
            ))}
          </div>
        </div>
      </section>
      {CATEGORIES.map((cat) => (
        <section key={cat.id}>
          <SectionHeader
            title={`${zh ? "已核验" : "Verified"} · ${zh ? cat.zh : cat.en}`}
            action={
              <Link
                to={lp(`/category/${cat.slug}`)}
                className={`text-sm font-semibold ${SCENE_TEXT[cat.id]}`}
              >
                {t("common.viewAll")} →
              </Link>
            }
          />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {verified
              .filter((p) => p.category === cat.id)
              .slice(0, 4)
              .map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
          </div>
        </section>
      ))}
      <section>
        <SectionHeader
          title={zh ? "低起价月付方案" : "Lowest monthly entry prices"}
        />
        <p className="-mt-2 mb-4 text-xs text-ink-2">
          {zh
            ? "仅按美元月付入门费排序；实际性价比请按功能和用量计算。"
            : "USD monthly entry fees only. Compare capabilities and usage to assess value."}
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cheapest.map((p) => (
            <ProductCard
              key={p.id}
              product={p}
              filters={{ basis: "monthly" }}
            />
          ))}
        </div>
      </section>
      <section>
        <SectionHeader
          title={zh ? "平替与成本比较" : "Alternatives & cost comparisons"}
          action={
            <Link
              to={lp("/alternatives")}
              className="text-sm font-semibold text-primary"
            >
              {t("common.viewAll")} →
            </Link>
          }
        />
        <div className="grid gap-4 sm:grid-cols-2">
          {relations.slice(0, 4).map((a) => {
            const original = c.products.find((p) => p.id === a.original);
            const alternative = c.products.find((p) => p.id === a.alternative);
            return original && alternative ? (
              <Link
                key={a.id}
                to={lp(`/alternatives/${original.slug}`)}
                className="card card-hover flex items-center gap-4 p-5"
              >
                <span className="flex h-10 w-10 flex-none items-center justify-center rounded-lg bg-surface-2 text-ink-2">
                  ⇄
                </span>
                <div className="min-w-0 flex-1">
                  <div className="font-display font-semibold text-ink">
                    {original.name} → {alternative.name}
                  </div>
                  <p className="mt-1 text-sm text-ink-2">{a.scenario}</p>
                </div>
                <span className="text-primary">→</span>
              </Link>
            ) : null;
          })}
        </div>
        <p className="mt-3 text-xs text-ink-2">
          {zh
            ? "推荐有具体场景与限制；不使用无依据的热门或质量排名。"
            : "Recommendations have explicit scenarios and limits; no unsupported popularity or quality rankings."}
        </p>
      </section>
      <section>
        <SectionHeader
          title={zh ? "最近核验的价格" : "Recently verified prices"}
        />
        <div className="overflow-hidden rounded-card border border-line bg-surface">
          {verified.slice(0, 6).map((p, i) => (
            <Link
              to={lp(`/tools/${p.slug}`)}
              key={p.id}
              className={`flex items-center gap-4 px-5 py-3.5 ${i ? "border-t border-line-2" : ""}`}
            >
              <span className="min-w-0 flex-1 font-medium text-ink">
                {p.name}
              </span>
              <span className="text-xs text-ink-2">
                {zh ? "官方来源" : "Official sources"}
              </span>
              <span className="text-xs text-ink-2">{p.verifiedAt}</span>
            </Link>
          ))}
        </div>
      </section>
      <section className="rounded-card border border-line bg-surface p-6 sm:p-8">
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-xl font-bold text-ink">
              {t("home.submitTitle")}
            </h2>
            <p className="mt-1 text-ink-2">{t("home.submitDesc")}</p>
          </div>
          <Link to={lp("/submit")} className="btn-primary flex-none">
            {t("home.submitCta")} →
          </Link>
        </div>
      </section>
      <section>
        <SectionHeader title={t("home.guidesTitle")} />
        <div className="grid gap-4 md:grid-cols-3">
          {[
            ["/about", zh ? "价格与推荐方法" : "Pricing methodology"],
            [
              "/calculator",
              zh ? "手动比较与成本计算" : "Manual cost comparison",
            ],
            [
              "/tools?dataset=legacy",
              zh
                ? "原目录与扩展筛选（示例）"
                : "Original directory & filters (demo)",
            ],
          ].map(([path, label]) => (
            <Link
              to={lp(path)}
              key={path}
              className="card card-hover flex flex-col p-5"
            >
              <span className="text-xs font-semibold uppercase tracking-label text-ink-2">
                GUIDE
              </span>
              <h3 className="mt-2 font-display font-semibold text-ink">
                {label}
              </h3>
              <span className="mt-4 text-sm font-semibold text-primary">
                {t("common.viewDetails")} →
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
