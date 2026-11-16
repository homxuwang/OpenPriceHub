import { useState } from "react";
import { Link } from "react-router-dom";
import { useLocale, useLocalePath } from "../i18n";
import {
  audioUnits,
  estimateAudio,
  type AudioKind,
  type AudioUnit,
  type AudioOffer,
  type AudioBilling,
} from "../../shared/audioCompare";

const labels: Record<AudioUnit, [string, string]> = {
  characters: ["字符", "characters"],
  minute: ["分钟", "minutes"],
  song: ["首歌曲", "songs"],
  generation: ["次生成", "generations"],
};
const number = (value: string) => (value.trim() === "" ? null : Number(value));
function initialOffer(kind: AudioKind, index: number): AudioOffer {
  return {
    id: `${kind}-${index}`,
    name: "",
    currency: "USD",
    unit: kind === "voice" ? "characters" : "song",
    billing: "usage",
    amount: null,
    unitSize: kind === "voice" ? 1000 : 1,
    allowance: null,
    overage: null,
  };
}
export default function AudioCompare({ kind }: { kind: AudioKind }) {
  const zh = useLocale() === "zh";
  const lp = useLocalePath();
  const tr = (cn: string, en: string) => (zh ? cn : en);
  const [unit, setUnit] = useState<AudioUnit>(
    kind === "voice" ? "characters" : "song",
  );
  const [quantity, setQuantity] = useState<number | null>(
    kind === "voice" ? 100000 : 10,
  );
  const [offers, setOffers] = useState<AudioOffer[]>([
    initialOffer(kind, 1),
    initialOffer(kind, 2),
  ]);
  const [baseline, setBaseline] = useState(`${kind}-1`);
  const [serial, setSerial] = useState(3);
  const patch = (id: string, values: Partial<AudioOffer>) =>
    setOffers((rows) =>
      rows.map((row) => (row.id === id ? { ...row, ...values } : row)),
    );
  const name = (offer: AudioOffer, index: number) =>
    offer.name.trim() || `${tr("方案", "Plan")} ${index + 1}`;
  const results = offers.map((offer) =>
    estimateAudio(offer, quantity ?? NaN, unit),
  );
  const baseIndex = offers.findIndex((offer) => offer.id === baseline);
  const reference = results[baseIndex];
  const money = (value: number, currency: string) =>
    new Intl.NumberFormat(zh ? "zh-CN" : "en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 4,
    }).format(value);
  const title =
    kind === "voice"
      ? tr("TTS 语音成本对比", "TTS voice cost comparison")
      : tr("音乐生成成本对比", "Music generation cost comparison");
  return (
    <div className="space-y-6">
      <header>
        <span className="eyebrow">
          // {kind === "voice" ? "TTS" : "AI MUSIC"} · COMPARE
        </span>
        <h1 className="mt-2 font-display text-3xl font-bold text-ink">
          {title}
        </h1>
        <p className="mt-2 max-w-3xl text-ink-2">
          {tr(
            "填写你实际使用的套餐或单价，比较同等月用量的成本。不会自动推算字符与分钟、歌曲与生成次数之间的关系。",
            "Enter actual plans or unit prices to compare the same monthly workload. Characters, minutes, songs and generations are not automatically converted.",
          )}
        </p>
      </header>
      <div className="flex flex-wrap gap-2">
        <Link className="chip" to={lp("/tools")}>
          {tr("返回工具库", "Tool library")}
        </Link>
        <Link
          className={`chip ${kind === "voice" ? "chip-active" : ""}`}
          to={lp("/compare/tts")}
        >
          TTS
        </Link>
        <Link
          className={`chip ${kind === "music" ? "chip-active" : ""}`}
          to={lp("/compare/music")}
        >
          {tr("音乐生成", "Music generation")}
        </Link>
        <Link className="chip" to={lp(`/calculator?type=${kind === "voice" ? "tts" : "music"}`)}>
          {tr("完整模型成本计算器", "Full model cost calculator")}
        </Link>
      </div>
      <section className="rounded-card border border-primary-100 bg-primary-50/60 p-5">
        <h2 className="font-display text-lg font-semibold">
          {tr("每月用量", "Monthly usage")}
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <label className="text-sm">
            {tr("计量单位", "Usage unit")}
            <select
              className="input mt-1"
              aria-label={tr("计量单位", "Usage unit")}
              value={unit}
              onChange={(e) => setUnit(e.target.value as AudioUnit)}
            >
              {audioUnits(kind).map((u) => (
                <option key={u} value={u}>
                  {labels[u][zh ? 0 : 1]}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            {tr("每月数量", "Monthly quantity")}
            <input
              type="number"
              min="0"
              step="any"
              className="input mt-1"
              value={quantity ?? ""}
              onChange={(e) => setQuantity(number(e.target.value))}
            />
          </label>
          <label className="text-sm">
            {tr("当前方案（节省基准）", "Current plan (savings baseline)")}
            <select
              className="input mt-1"
              aria-label={tr(
                "当前方案（节省基准）",
                "Current plan (savings baseline)",
              )}
              value={baseline}
              onChange={(e) => setBaseline(e.target.value)}
            >
              {offers.map((o, i) => (
                <option key={o.id} value={o.id}>
                  {name(o, i)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>
      <div className="grid gap-4 lg:grid-cols-2">
        {offers.map((offer, index) => (
          <section
            key={offer.id}
            className="card p-5"
            aria-label={`${tr("方案", "Plan")} ${index + 1}`}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold">
                {name(offer, index)}
              </h2>
              <button
                className="text-sm text-ink-2 hover:text-primary disabled:opacity-40"
                disabled={offers.length <= 2}
                onClick={() => {
                  setOffers(offers.filter((o) => o.id !== offer.id));
                  if (baseline === offer.id)
                    setBaseline(offers.find((o) => o.id !== offer.id)!.id);
                }}
              >
                {tr("移除", "Remove")}
              </button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm">
                {tr("产品 / 套餐名称", "Product / plan name")}
                <input
                  className="input mt-1"
                  value={offer.name}
                  placeholder={tr("填写方案名称", "Enter plan name")}
                  onChange={(e) => patch(offer.id, { name: e.target.value })}
                />
              </label>
              <label className="text-sm">
                {tr("结算币种", "Billing currency")}
                <select
                  className="input mt-1"
                  aria-label={tr("结算币种", "Billing currency")}
                  value={offer.currency}
                  onChange={(e) =>
                    patch(offer.id, {
                      currency: e.target.value as AudioOffer["currency"],
                    })
                  }
                >
                  {["USD", "CNY", "EUR"].map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                {tr("计费方式", "Pricing model")}
                <select
                  className="input mt-1"
                  aria-label={tr("计费方式", "Pricing model")}
                  value={offer.billing}
                  onChange={(e) =>
                    patch(offer.id, { billing: e.target.value as AudioBilling })
                  }
                >
                  {[
                    ["usage", tr("按量付费", "Pay as you go")],
                    ["monthly", tr("月付订阅", "Monthly")],
                    ["annual", tr("年付订阅", "Annual")],
                    [
                      "package",
                      tr("可重复购买用量包", "Repeatable usage package"),
                    ],
                    ["free", tr("免费额度", "Free allowance")],
                  ].map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                {tr("套餐计量单位", "Plan unit")}
                <select
                  className="input mt-1"
                  aria-label={tr("套餐计量单位", "Plan unit")}
                  value={offer.unit}
                  onChange={(e) =>
                    patch(offer.id, {
                      unit: e.target.value as AudioUnit,
                      unitSize: e.target.value === "characters" ? 1000 : 1,
                    })
                  }
                >
                  {audioUnits(kind).map((u) => (
                    <option key={u} value={u}>
                      {labels[u][zh ? 0 : 1]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                {tr("每笔单价对应数量", "Units per unit-price charge")}
                <select
                  className="input mt-1"
                  aria-label={tr(
                    "每笔单价对应数量",
                    "Units per unit-price charge",
                  )}
                  value={offer.unitSize}
                  onChange={(e) =>
                    patch(offer.id, { unitSize: Number(e.target.value) })
                  }
                >
                  {(offer.unit === "characters" ? [1, 1000, 1000000] : [1]).map(
                    (n) => (
                      <option key={n} value={n}>
                        {n.toLocaleString()} {labels[offer.unit][zh ? 0 : 1]}
                      </option>
                    ),
                  )}
                </select>
              </label>
              {offer.billing !== "free" && (
                <label className="text-sm">
                  {offer.billing === "usage"
                    ? tr("单价", "Unit price")
                    : offer.billing === "annual"
                      ? tr("年付总额", "Annual upfront price")
                      : offer.billing === "monthly"
                        ? tr("每月订阅费", "Monthly subscription price")
                        : tr("每包价格", "Price per package")}
                  <input
                    className="input mt-1"
                    type="number"
                    min="0"
                    step="any"
                    value={offer.amount ?? ""}
                    onChange={(e) =>
                      patch(offer.id, { amount: number(e.target.value) })
                    }
                  />
                </label>
              )}
              {offer.billing !== "usage" && (
                <label className="text-sm">
                  {offer.billing === "package"
                    ? tr("每包实际包含数量", "Included units per package")
                    : tr("每月包含数量", "Included units per month")}
                  <input
                    className="input mt-1"
                    type="number"
                    min="0"
                    step="any"
                    value={offer.allowance ?? ""}
                    onChange={(e) =>
                      patch(offer.id, { allowance: number(e.target.value) })
                    }
                  />
                </label>
              )}
              {["monthly", "annual", "free"].includes(offer.billing) && (
                <label className="text-sm">
                  {tr(
                    "超额单价（留空表示未知或不可超额）",
                    "Overage unit price (blank if unknown or unavailable)",
                  )}
                  <input
                    className="input mt-1"
                    type="number"
                    min="0"
                    step="any"
                    value={offer.overage ?? ""}
                    onChange={(e) =>
                      patch(offer.id, { overage: number(e.target.value) })
                    }
                  />
                </label>
              )}
            </div>
            {offer.billing === "annual" && (
              <p className="mt-3 text-xs text-ink-2">
                {tr(
                  "按每月重置的额度计算；年付总额按 12 个月摊销，仍需一次性支付全年费用。",
                  "Assumes a monthly resetting allowance. Annual fees are amortized over 12 months and paid upfront.",
                )}
              </p>
            )}
            {offer.billing === "package" && (
              <p className="mt-3 text-xs text-ink-2">
                {tr(
                  "仅适用于本月可重复购买且当月有效的用量包，按整包购买取整。",
                  "Only for packages that can be purchased repeatedly and remain valid for this month; purchases round up to whole packages.",
                )}
              </p>
            )}
          </section>
        ))}
      </div>
      <button
        className="btn-secondary"
        disabled={offers.length >= 6}
        onClick={() => {
          setOffers([...offers, initialOffer(kind, serial)]);
          setSerial(serial + 1);
        }}
      >
        {tr("添加对比方案", "Add comparison plan")} ({offers.length}/6)
      </button>
      <section aria-live="polite">
        <h2 className="mb-4 font-display text-xl font-bold">
          {tr("成本对比结果", "Cost comparison results")}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {offers.map((offer, i) => {
            const r = results[i];
            const canCompare =
              r.cost !== null &&
              reference?.cost !== null &&
              reference?.cost !== undefined &&
              r.basis === reference.basis;
            const delta = canCompare ? reference.cost! - r.cost! : null;
            return (
              <article key={offer.id} className="card p-5">
                <h3 className="font-display font-semibold">{name(offer, i)}</h3>
                {r.cost === null ? (
                  <p className="mt-3 text-sm text-ink-2">
                    {r.reason === "unit"
                      ? tr(
                          "计量单位不同，无法直接比较。",
                          "Different units: cannot directly compare.",
                        )
                      : r.reason === "quota"
                        ? tr(
                            "用量超过额度，缺少超额规则，无法计算完整成本。",
                            "Usage exceeds the allowance; overage terms are required.",
                          )
                        : tr(
                            "请填写有效价格、额度和用量。",
                            "Enter valid prices, allowances and usage.",
                          )}
                  </p>
                ) : (
                  <>
                    <p className="mt-3 font-mono text-2xl font-bold text-primary">
                      {money(r.cost, offer.currency)}
                      <span className="text-xs font-normal text-ink-2">
                        {" "}
                        / {tr("月", "month")}
                      </span>
                    </p>
                    {r.upfront !== null && (
                      <p className="mt-2 text-xs text-ink-2">
                        {tr("年付预付款", "Annual upfront")}:{" "}
                        {money(r.upfront, offer.currency)}
                      </p>
                    )}
                    <p className="mt-3 text-sm">
                      {offer.id === baseline
                        ? tr("当前基准方案", "Current baseline")
                        : delta !== null
                          ? `${tr("相对基准节省", "Savings vs baseline")}: ${money(delta, offer.currency)}${reference.cost! > 0 ? ` (${((delta / reference.cost!) * 100).toFixed(1)}%)` : ""}`
                          : tr(
                              "基准条件或币种不同，不计算节省。",
                              "Baseline conditions or currency differ; savings are not calculated.",
                            )}
                    </p>
                  </>
                )}
              </article>
            );
          })}
        </div>
        <p className="mt-4 text-xs text-ink-2">
          {tr(
            "结果基于你的输入，不含税费、汇率换算或未填写的额外费用。负节省表示成本更高；本页不评价生成质量。",
            "Results use your inputs and exclude taxes, currency conversion and unspecified extra charges. Negative savings mean higher cost; generation quality is not rated.",
          )}
        </p>
      </section>
    </div>
  );
}
