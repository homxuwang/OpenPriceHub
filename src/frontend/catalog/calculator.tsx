import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { CategoryId } from "../../shared/catalog/types";
import {
  estimate,
  supportsPlanFeature,
  money,
  planPrice,
  savings,
  verifiedPlans,
  type Usage,
} from "../../shared/catalog/logic";
import { useLocalePath } from "../i18n";
import { useCatalog } from "./context";
import { Section, SourceList, useCopy } from "./components";
export function CostCalculator({
  category,
  initialProducts,
  originalId,
}: {
  category: CategoryId;
  initialProducts?: string[];
  originalId?: string;
}) {
  const catalog = useCatalog();
  const t = useCopy();
  const lp = useLocalePath();
  const candidates = catalog.products.filter(
    (p) => p.category === category && verifiedPlans(p).length,
  );
  const [chosen, setChosen] = useState<string[]>(
    initialProducts || candidates.slice(0, 3).map((p) => p.id),
  );
  const [plans, setPlans] = useState<Record<string, string>>({});
  const [components, setComponents] = useState<Record<string, string>>({});
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [reference, setReference] = useState(originalId || chosen[0] || "");
  const [budget, setBudget] = useState("");
  const [usage, setUsage] = useState<Usage>({
    category,
    quantity: category === "image" ? 100 : 10,
    seconds: category === "music" ? 0 : 5,
    characters: 20000,
    minutes: 10,
    voiceUnit: "characters",
    resolution: "",
    quality: "",
  });
  const [required, setRequired] = useState("");
  const rows = useMemo(
    () =>
      chosen
        .map((id) => {
          const product = candidates.find((p) => p.id === id);
          if (!product) return null;
          const available = verifiedPlans(product);
          const plan =
            available.find((p) => p.id === plans[id]) ||
            available.find((p) => p.billing === "monthly") ||
            available.find((p) => p.billing === "annual") ||
            available[0];
          const component =
            plan.components.find((c) => c.id === components[id]) ||
            plan.components[0];
          const result = estimate(plan, component, {
            ...usage,
            category,
            creditsPerOutput: overrides[id] ? Number(overrides[id]) : undefined,
          });
          if (!supportsPlanFeature(plan, required)) {
            result.valid = false;
            result.monthly = null;
            result.reason =
              "Required capability is not verified for this selected plan.";
          }
          return { product, plan, component, result };
        })
        .filter((r): r is NonNullable<typeof r> => r !== null),
    [
      chosen,
      candidates,
      plans,
      components,
      usage,
      category,
      overrides,
      required,
    ],
  );
  const baseline = rows.find((r) => r.product.id === reference)?.result;
  const comparable = baseline?.valid
    ? rows.filter((r) => savings(baseline, r.result) !== null)
    : [];
  const cheapest =
    comparable.length >= 2
      ? Math.min(...comparable.map((r) => r.result.monthly!))
      : null;
  const setNumber = (
    key: "quantity" | "seconds" | "characters" | "minutes",
    value: string,
  ) => setUsage((u) => ({ ...u, [key]: value === "" ? NaN : Number(value) }));
  const features = [...new Set(candidates.flatMap((p) => p.features))];
  return (
    <Section title={t("Estimate monthly cost & savings", "估算月成本与节省")}>
      <div className="card p-5">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {category !== "voice" && (
            <label className="text-xs font-medium">
              {t(
                category === "image"
                  ? "Images per month"
                  : category === "video"
                    ? "Videos per month"
                    : "Songs / generations per month",
                category === "image"
                  ? "每月图片数"
                  : category === "video"
                    ? "每月视频数"
                    : "每月歌曲 / 生成次数",
              )}
              <input
                className="input mt-1"
                type="number"
                min="0"
                step="1"
                value={Number.isNaN(usage.quantity) ? "" : usage.quantity}
                onChange={(e) => setNumber("quantity", e.target.value)}
              />
            </label>
          )}
          {(category === "video" || category === "music") && (
            <label className="text-xs font-medium">
              {t(
                category === "music"
                  ? "Seconds per output (0 = unconstrained)"
                  : "Seconds per output",
                category === "music"
                  ? "每次输出秒数（0 表示不限定）"
                  : "每次输出时长（秒）",
              )}
              <input
                className="input mt-1"
                type="number"
                min={category === "music" ? 0 : 1}
                value={Number.isNaN(usage.seconds) ? "" : usage.seconds}
                onChange={(e) => setNumber("seconds", e.target.value)}
              />
            </label>
          )}
          {category === "voice" && (
            <>
              <label className="text-xs font-medium">
                {t("Usage unit", "用量单位")}
                <select
                  className="input mt-1"
                  value={usage.voiceUnit}
                  onChange={(e) =>
                    setUsage((u) => ({
                      ...u,
                      voiceUnit: e.target.value as "characters" | "minute",
                    }))
                  }
                >
                  <option value="characters">
                    {t("Characters", "字符数")}
                  </option>
                  <option value="minute">{t("Minutes", "分钟数")}</option>
                </select>
              </label>
              <label className="text-xs font-medium">
                {t("Monthly usage", "每月用量")}
                <input
                  className="input mt-1"
                  type="number"
                  min="0"
                  value={
                    usage.voiceUnit === "characters"
                      ? usage.characters
                      : usage.minutes
                  }
                  onChange={(e) =>
                    setNumber(
                      usage.voiceUnit === "characters"
                        ? "characters"
                        : "minutes",
                      e.target.value,
                    )
                  }
                />
              </label>
            </>
          )}
          {(category === "image" || category === "video") && (
            <label className="text-xs font-medium">
              {t("Required resolution", "要求的分辨率")}
              <select
                className="input mt-1"
                value={usage.resolution}
                onChange={(e) =>
                  setUsage((u) => ({ ...u, resolution: e.target.value }))
                }
              >
                <option value="">
                  {t("Any published resolution", "不限定分辨率")}
                </option>
                {["720p", "1080p", "1024x1024", "4K"].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </label>
          )}
          {category === "video" && (
            <label className="text-xs font-medium">
              {t("Required quality setting", "要求的质量档位")}
              <select
                className="input mt-1"
                value={usage.quality}
                onChange={(e) =>
                  setUsage((u) => ({ ...u, quality: e.target.value }))
                }
              >
                <option value="">
                  {t("No shared quality requirement", "不限定共同质量档位")}
                </option>
                <option value="standard">Standard</option>
                <option value="pro">Pro</option>
              </select>
            </label>
          )}
          <label className="text-xs font-medium">
            {t("Required capability", "必须具备的功能")}
            <select
              aria-label={t("Required capability", "必须具备的功能")}
              className="input mt-1"
              value={required}
              onChange={(e) => setRequired(e.target.value)}
            >
              <option value="">
                {t("No additional requirement", "无额外要求")}
              </option>
              {features.map((x) => (
                <option key={x} value={x}>
                  {x.replaceAll("-", " ")}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium">
            {t("Monthly budget · USD (optional)", "每月预算 · 美元（可选）")}
            <input
              className="input mt-1"
              type="number"
              min="0"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              placeholder="100"
            />
          </label>
          <label className="text-xs font-medium">
            {t("Current / reference product", "当前 / 基准产品")}
            <select
              className="input mt-1"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            >
              <option value="">{t("Select reference", "选择基准")}</option>
              {rows.map((r) => (
                <option value={r.product.id} key={r.product.id}>
                  {r.product.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <fieldset className="mt-5">
          <legend className="text-xs font-semibold">
            {t("Products to compare", "选择比较产品")}
          </legend>
          <div className="mt-2 flex flex-wrap gap-3">
            {candidates.map((p) => (
              <label key={p.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={chosen.includes(p.id)}
                  onChange={(e) => {
                    setChosen((v) =>
                      e.target.checked
                        ? [...v, p.id]
                        : v.filter((x) => x !== p.id),
                    );
                    if (!reference && e.target.checked) setReference(p.id);
                  }}
                />
                {p.name}
              </label>
            ))}
          </div>
        </fieldset>
        <p className="mt-4 text-xs text-ink-2">
          {t(
            "A lower estimate is not a quality ranking. Models, licenses, download rights and output limits can differ.",
            "较低估算成本不代表质量更高；模型、授权、下载权益和输出限制可能不同。",
          )}
        </p>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {rows.map(({ product, plan, component, result }) => {
          const delta = baseline ? savings(baseline, result) : null;
          return (
            <article key={product.id} className="card min-w-0 p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h3 className="font-semibold">{product.name}</h3>
                {product.id === reference && (
                  <span className="badge bg-surface-2">
                    {t("Current plan", "当前方案")}
                  </span>
                )}
              </div>
              <label className="mt-4 block text-xs">
                {t("Plan", "套餐")}
                <select
                  className="input mt-1"
                  value={plan.id}
                  onChange={(e) => {
                    setPlans((v) => ({ ...v, [product.id]: e.target.value }));
                    setOverrides((v) => ({ ...v, [product.id]: "" }));
                  }}
                >
                  {verifiedPlans(product).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} · {planPrice(p)}
                    </option>
                  ))}
                </select>
              </label>
              {plan.components.length > 0 && (
                <label className="mt-3 block text-xs">
                  {t("Model / billing rule", "模型 / 计价规则")}
                  <select
                    className="input mt-1"
                    value={component?.id}
                    onChange={(e) =>
                      setComponents((v) => ({
                        ...v,
                        [product.id]: e.target.value,
                      }))
                    }
                  >
                    {plan.components.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.model || plan.name} · {c.resolution || c.unit}{" "}
                        {c.quality}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {component?.creditAllowance !== null &&
                component?.creditAllowance !== undefined &&
                category !== "voice" && (
                  <label className="mt-3 block text-xs">
                    {t(
                      "Actual credits per output (optional override)",
                      "每次输出实际消耗积分（可选覆盖）",
                    )}
                    <input
                      className="input mt-1"
                      type="number"
                      min="0.001"
                      step="any"
                      placeholder={t(
                        "Use published conversion when available",
                        "默认使用已核验换算规则",
                      )}
                      value={overrides[product.id] || ""}
                      onChange={(e) =>
                        setOverrides((v) => ({
                          ...v,
                          [product.id]: e.target.value,
                        }))
                      }
                    />
                  </label>
                )}
              <div
                className={`mt-4 rounded-lg p-4 ${result.valid ? "bg-primary-50" : "bg-surface-2"}`}
                aria-live="polite"
              >
                {result.valid ? (
                  <>
                    <p className="text-xs text-ink-2">
                      {t("Estimated monthly cost", "预计月成本")}
                    </p>
                    <p className="mt-1 font-mono text-2xl font-semibold">
                      {money(result.monthly!, result.currency)}
                    </p>
                    {plan.billing === "annual" && (
                      <p className="mt-1 text-xs">
                        {t("Pay upfront", "实际预付")}:{" "}
                        {money(result.upfront!, result.currency)} / year
                      </p>
                    )}
                    {delta && product.id !== reference && (
                      <p className="mt-2 text-sm">
                        {delta.amount > 0
                          ? t("Monthly savings", "每月节省")
                          : delta.amount < 0
                            ? t("Additional monthly cost", "每月增加成本")
                            : t("Same monthly cost", "月成本相同")}
                        : {money(Math.abs(delta.amount), result.currency)}
                        {delta.percent !== null
                          ? ` (${Math.abs(delta.percent).toFixed(1)}%)`
                          : ""}
                      </p>
                    )}
                    {cheapest !== null &&
                      result.monthly === cheapest &&
                      comparable.some((r) => r.product.id === product.id) && (
                        <p className="mt-2 text-xs font-semibold text-primary">
                          {t(
                            "Cheapest for the selected workload among comparable selected plans",
                            "所选可比方案中，此用量下成本最低",
                          )}
                        </p>
                      )}
                    {cheapest !== null &&
                      required &&
                      result.monthly === cheapest &&
                      comparable.some((r) => r.product.id === product.id) && (
                        <p className="mt-1 text-xs">
                          Best Value ·{" "}
                          {t(
                            "cost + documented required capability; no quality score",
                            "依据成本及已记录必需功能，非质量评分",
                          )}
                        </p>
                      )}
                    {budget !== "" &&
                      Number.isFinite(Number(budget)) &&
                      Number(budget) >= 0 &&
                      result.currency === "USD" && (
                        <p className="mt-2 text-xs">
                          {result.monthly! <= Number(budget)
                            ? t("Within monthly budget", "在月预算内")
                            : t("Over monthly budget", "超出月预算")}
                        </p>
                      )}
                    <p className="mt-3 break-words font-mono text-xs">
                      {result.formula}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="font-semibold">
                      {t("Cannot directly compare", "无法直接比较")}
                    </p>
                    <p className="mt-2 text-sm">{result.reason}</p>
                  </>
                )}
              </div>
              <ul className="mt-3 list-inside list-disc space-y-1 text-xs text-ink-2">
                {result.assumptions.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
              <div className="mt-4">
                <SourceList ids={plan.sourceIds} />
              </div>
            </article>
          );
        })}
      </div>
      {!rows.length && (
        <p className="mt-4 text-sm text-ink-2">
          {t(
            "Select a product with verified plans to begin.",
            "请选择有已核验套餐的产品。",
          )}
        </p>
      )}
      <p className="mt-5 text-sm">
        <Link className="text-primary underline" to={lp("/manual-compare")}>
          {t(
            "Have your own rates? Open the existing manual comparison workspace.",
            "有自己的价格数据？打开原有手动比较工作区。",
          )}
        </Link>
      </p>
    </Section>
  );
}
