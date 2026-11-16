import type {
  Alternative,
  Catalog,
  CategoryId,
  Component,
  Plan,
  PricingModel,
  Product,
  Unit,
} from "./types";
import { CATEGORIES, PRICING_MODELS } from "./types";
import seed from "./seed.json";
export const bundledCatalog = seed as Catalog;
export const isVerified = (p: { status: string; verifiedAt: string | null }) =>
  p.status === "verified" && !!p.verifiedAt;
export const verifiedPlans = (p: Product) =>
  isVerified(p) ? p.plans.filter(isVerified) : [];
export const modes = (p: Product) => [
  ...new Set(verifiedPlans(p).flatMap((x) => x.pricingModels)),
];
export const hasFree = (p: Product) =>
  verifiedPlans(p).some((x) => x.billing === "free" || !!x.freeAllowance);
export const noSubscription = (p: Product) =>
  verifiedPlans(p).some((x) =>
    ["free", "pay-as-you-go", "one-time", "package"].includes(x.billing),
  );
export const categoryOf = (slug?: string) =>
  CATEGORIES.find(
    (c) =>
      c.slug === slug ||
      c.id === slug ||
      (slug === "ai-tts" && c.id === "voice"),
  );
export const money = (n: number, currency = "USD") =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: n > 0 && n < 0.01 ? 6 : 3,
  }).format(n);
export function planPrice(p: Plan): string {
  if (!isVerified(p) || p.amount === null) return "Price not verified";
  if (p.billing === "pay-as-you-go") {
    const c = p.components.find((c) => c.rate !== null);
    return c
      ? `${money(c.rate!, p.currency)} / ${c.unitSize > 1 ? c.unitSize.toLocaleString() + " " : ""}${c.unit}`
      : "Usage rate not verified";
  }
  return `${money(p.amount, p.currency)}${p.billing === "monthly" ? " / month" : p.billing === "annual" ? " / year" : p.billing === "free" ? " · Free" : " one-time"}`;
}
export function startingPlan(p: Product, basis?: string): Plan | undefined {
  const plans = verifiedPlans(p);
  if (basis && basis !== "all")
    return plans
      .filter((x) => metric(x, basis) !== null)
      .sort((a, b) => metric(a, basis)! - metric(b, basis)!)[0];
  for (const billing of ["free", "monthly", "annual"] as const) {
    const group = plans.filter((plan) => plan.billing === billing);
    if (group.length) {
      // Different currencies are never numerically ranked against one another.
      return group
        .filter((plan) => plan.currency === group[0].currency)
        .sort((a, b) => (a.amount ?? Infinity) - (b.amount ?? Infinity))[0];
    }
  }
  return plans[0];
}
export function metric(p: Plan, basis: string): number | null {
  if (!isVerified(p) || p.currency !== "USD") return null;
  if (basis === "monthly") return p.billing === "monthly" ? p.amount : null;
  if (basis === "annual") return p.billing === "annual" ? p.amount : null;
  if (basis === "free") return p.billing === "free" ? 0 : null;
  if (basis === "one-time" || basis === "package")
    return p.billing === basis ? p.amount : null;
  // Credits are vendor-specific and are deliberately not a cross-product sorting basis.
  if (basis === "credit" || basis === "all") return null;
  const c = p.components.find(
    (c) => c.unit === basis && c.rate !== null && p.billing === "pay-as-you-go",
  );
  return c
    ? (c.rate! / c.unitSize) * (basis === "characters" ? 1000000 : 1)
    : null;
}
export function publicUnits(p: Product): string[] {
  return verifiedPlans(p).flatMap((plan) =>
    plan.components
      .filter((c) => c.rate !== null)
      .map(
        (c) =>
          `${money(c.rate!, plan.currency)} / ${c.unitSize > 1 ? c.unitSize.toLocaleString() + " " : ""}${c.unit} · ${c.model}${c.resolution ? " · " + c.resolution : ""}`,
      ),
  );
}
const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
function distance(a: string, b: string) {
  let row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    for (let j = 1; j <= b.length; j++)
      next[j] = Math.min(
        next[j - 1] + 1,
        row[j] + 1,
        row[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    row = next;
  }
  return row[b.length];
}
export function searchScore(p: Product, q: string, catalog: Catalog): number {
  const n = normalize(q);
  if (!n) return 1;
  const aliases = catalog.alternatives
    .filter((a) => a.alternative === p.id && a.status === "verified")
    .map((a) => catalog.products.find((x) => x.id === a.original)?.name || "");
  const hay = normalize(
    [
      p.name,
      p.provider,
      p.slug,
      p.summary,
      p.summaryZh,
      ...p.models,
      ...p.features,
      ...aliases,
    ].join(" "),
  );
  return n
    .split(" ")
    .every(
      (w) =>
        hay.includes(w) ||
        (w.length >= 4 && hay.split(" ").some((h) => distance(w, h) <= 1)),
    )
    ? normalize(p.name).includes(n)
      ? 3
      : 1
    : 0;
}
export interface Filters {
  q?: string;
  category?: string;
  pricing?: string[];
  basis?: string;
  range?: string;
  free?: boolean;
  noSubscription?: boolean;
  api?: boolean;
  commercial?: boolean;
  sort?: string;
  feature?: string;
}
export function matchingPlans(p: Product, f: Filters): Plan[] {
  const basis = f.basis || "all";
  const bounds: Record<string, [number, number]> = {
    "under-10": [0, 10],
    "10-30": [10, 30],
    "30-100": [30, 100],
    "100+": [100, Infinity],
    free: [0, 0],
  };
  return verifiedPlans(p).filter((plan) => {
    if (
      f.pricing?.length &&
      !f.pricing.some((m) => plan.pricingModels.includes(m as PricingModel))
    )
      return false;
    if (f.commercial && plan.commercial !== true) return false;
    if (
      f.noSubscription &&
      !["free", "pay-as-you-go", "one-time", "package"].includes(plan.billing)
    )
      return false;
    const n = metric(plan, basis);
    if (basis !== "all" && n === null) return false;
    if (f.range && f.range !== "all") {
      if (n === null) return false;
      const [low, high] = bounds[f.range] || [0, Infinity];
      if (n < low || (high === 0 ? n !== 0 : n >= high)) return false;
    }
    return true;
  });
}
export function filterCatalog(c: Catalog, f: Filters): Product[] {
  const basis = f.basis || "all";
  const candidates = c.products.filter((p) => {
    if (f.category && p.category !== f.category) return false;
    if (f.q && !searchScore(p, f.q, c)) return false;
    if (f.feature && !p.features.includes(f.feature)) return false;
    if (f.free && !hasFree(p)) return false;
    if (f.noSubscription && !noSubscription(p)) return false;
    if (f.api && p.api !== true) return false;
    if (
      (f.pricing?.length ||
        f.commercial ||
        f.noSubscription ||
        basis !== "all" ||
        (f.range && f.range !== "all")) &&
      !matchingPlans(p, f).length
    )
      return false;
    return true;
  });
  return candidates.sort((a, b) => {
    if ((f.sort === "price" || f.sort === "unit") && basis !== "all") {
      const val = (p: Product) =>
        Math.min(
          ...matchingPlans(p, f).map((x) => metric(x, basis) ?? Infinity),
        );
      return val(a) - val(b) || a.name.localeCompare(b.name);
    }
    if (f.q)
      return (
        searchScore(b, f.q, c) - searchScore(a, f.q, c) ||
        a.name.localeCompare(b.name)
      );
    return (
      (b.verifiedAt || "").localeCompare(a.verifiedAt || "") ||
      a.name.localeCompare(b.name)
    );
  });
}
export function alternativeRelations(
  c: Catalog,
  id: string,
  direction: "outgoing" | "incoming" = "outgoing",
): Alternative[] {
  return c.alternatives.filter(
    (a) =>
      isVerified(a) &&
      (direction === "outgoing" ? a.original === id : a.alternative === id),
  );
}
export function alternativeBadges(
  original: Product,
  candidate: Product,
): string[] {
  const tags: string[] = [];
  const a = startingPlan(original, "monthly"),
    b = startingPlan(candidate, "monthly");
  if (
    a &&
    b &&
    a.currency === b.currency &&
    a.amount !== null &&
    b.amount !== null &&
    b.amount < a.amount
  )
    tags.push("Lower monthly entry price");
  if (hasFree(candidate)) tags.push("Free Alternative");
  if (modes(candidate).includes("pay-as-you-go"))
    tags.push("Pay-as-you-go Alternative");
  return tags;
}
export function supportsPlanFeature(plan: Plan, feature: string): boolean {
  return !feature || (isVerified(plan) && !!plan.features?.includes(feature));
}
export interface Usage {
  category: CategoryId;
  quantity: number;
  seconds: number;
  characters: number;
  minutes: number;
  voiceUnit: "characters" | "minute";
  resolution: string;
  quality: string;
  model?: string;
  creditsPerOutput?: number;
}
export interface Estimate {
  valid: boolean;
  monthly: number | null;
  upfront: number | null;
  currency: string;
  reason: string;
  formula: string;
  assumptions: string[];
  basis: string;
}
export function estimate(
  plan: Plan,
  component: Component | undefined,
  u: Usage,
): Estimate {
  const base: Estimate = {
    valid: false,
    monthly: null,
    upfront: null,
    currency: plan.currency,
    reason: "",
    formula: "",
    assumptions: [...plan.limits],
    basis: [
      u.category,
      u.resolution,
      u.quality,
      u.category === "voice"
        ? u.voiceUnit
        : u.category === "music"
          ? component?.unit
          : "output",
    ].join(":"),
  };
  const fail = (reason: string) => ({ ...base, reason });
  if (!isVerified(plan) || plan.amount === null)
    return fail("Price is not verified.");
  if (!component) return fail("No verified usage conversion for this plan.");
  const c = component;
  if (
    [u.quantity, u.seconds, u.characters, u.minutes].some(
      (n) => !Number.isFinite(n) || n < 0,
    ) ||
    !Number.isInteger(u.quantity) ||
    (u.category === "voice" &&
      u.voiceUnit === "characters" &&
      !Number.isInteger(u.characters))
  )
    return fail("Enter finite non-negative usage and a whole output count.");
  if (u.resolution && c.resolution !== u.resolution)
    return fail("Requested resolution is not verified for this offer.");
  if (u.quality && c.quality !== u.quality)
    return fail("Requested quality is not verified for this offer.");
  if (u.model && u.model !== c.model)
    return fail("Select a supported model for this plan.");
  if (c.maxDuration !== null && u.seconds > c.maxDuration)
    return fail("Duration exceeds this plan’s published limit.");
  if (c.durations.length && !c.durations.includes(u.seconds))
    return fail(`Supported durations: ${c.durations.join(", ")} seconds.`);
  if (
    (u.category === "video" ||
      (u.category === "music" && c.unit === "minute")) &&
    u.quantity > 0 &&
    u.seconds <= 0
  )
    return fail("Enter a positive output duration.");
  if (u.category === "music" && u.seconds > 0 && c.maxDuration === null)
    return fail("Requested song duration is not verified for this offer.");
  if (u.category === "music" && u.seconds === 0)
    base.assumptions.push(
      "No output-duration requirement selected. Songs and generation requests remain separate comparison units.",
    );
  const allowed: Record<CategoryId, Unit[]> = {
    image: ["image"],
    video: ["second", "video", "minute"],
    voice: [u.voiceUnit],
    music: ["song", "generation", "minute"],
  };
  if (!allowed[u.category].includes(c.unit))
    return fail(
      "Billing units do not match this workload; no automatic conversion is available.",
    );
  let units =
    c.unit === "characters"
      ? u.characters
      : c.unit === "second"
        ? u.quantity * u.seconds
        : c.unit === "minute"
          ? u.category === "voice"
            ? u.minutes
            : (u.quantity * u.seconds) / 60
          : u.quantity;
  if (
    c.allowancePeriod !== "month" &&
    (c.included !== null || c.creditAllowance !== null)
  )
    return fail(
      "Daily or one-time allowances cannot be assumed to recur as a monthly pool.",
    );
  if (plan.billing === "one-time" || plan.billing === "package")
    return fail(
      "Package validity and repeat-purchase conditions are needed for a monthly estimate.",
    );
  const fee = plan.billing === "annual" ? plan.amount / 12 : plan.amount;
  let cost = fee;
  let formula = "";
  if (c.creditAllowance !== null) {
    let credits: number;
    if (u.creditsPerOutput !== undefined) {
      if (!Number.isFinite(u.creditsPerOutput) || u.creditsPerOutput <= 0)
        return fail("Actual credits per output must be positive.");
      credits = u.quantity * u.creditsPerOutput;
      base.assumptions.push(
        "Uses your actual credits per output, not a published unit rate.",
      );
    } else if (c.creditsPerUnit !== null) {
      credits = Math.ceil(units / c.unitSize) * c.creditsPerUnit;
    } else
      return fail(
        "Enter actual credits per output; the vendor does not publish an exact conversion for this offer.",
      );
    if (credits > c.creditAllowance) {
      if (c.overagePerCredit == null)
        return fail(
          `Requires ${credits.toLocaleString()} credits; allowance ${c.creditAllowance.toLocaleString()}. Extra credit cost is not verified.`,
        );
      cost = fee + (credits - c.creditAllowance) * c.overagePerCredit;
      formula = `${money(fee, plan.currency)} + (${credits.toLocaleString()} − ${c.creditAllowance.toLocaleString()}) × ${money(c.overagePerCredit, plan.currency)} per extra credit`;
    } else {
      formula = `${credits.toLocaleString()} credits ≤ ${c.creditAllowance.toLocaleString()} included; ${money(fee, plan.currency)} monthly plan cost`;
    }
  } else if (c.rate !== null) {
    const billable = Math.max(0, units - (c.included || 0));
    cost = fee + (billable / c.unitSize) * c.rate;
    formula = `${money(fee, plan.currency)} + max(0, ${units.toLocaleString()} − ${c.included || 0}) ÷ ${c.unitSize} × ${money(c.rate, plan.currency)}`;
  } else if (c.included !== null && units <= c.included) {
    formula = `${units} ≤ ${c.included} included; ${money(fee, plan.currency)} monthly`;
  } else
    return fail("No verified rate or sufficient allowance for this workload.");
  if (!Number.isFinite(cost))
    return fail("Usage exceeds supported numeric range.");
  if (plan.billing === "annual")
    base.assumptions.push(
      `Annual prepayment ${money(plan.amount, plan.currency)}; monthly value is an annual average.`,
    );
  base.assumptions.push(
    "Taxes, retries and other feature usage are excluded. Output quality is not assumed equivalent.",
  );
  return {
    ...base,
    valid: true,
    monthly: cost,
    upfront: plan.billing === "annual" ? plan.amount : cost,
    formula,
  };
}
export function savings(
  a: Estimate,
  b: Estimate,
): { amount: number; percent: number | null } | null {
  if (
    !a.valid ||
    !b.valid ||
    a.monthly === null ||
    b.monthly === null ||
    a.currency !== b.currency ||
    a.basis !== b.basis
  )
    return null;
  const amount = a.monthly - b.monthly;
  return { amount, percent: a.monthly > 0 ? (amount / a.monthly) * 100 : null };
}
export function validateCatalog(value: unknown): string[] {
  try {
    return validateCatalogData(value);
  } catch {
    return ["Malformed catalog shape. Check field types and nested records."];
  }
}
function validateCatalogData(value: unknown): string[] {
  const errors: string[] = [];
  const text = (value: unknown) =>
    typeof value === "string" && value.trim().length > 0;
  const strings = (value: unknown): value is string[] =>
    Array.isArray(value) && value.every((item) => typeof item === "string");
  const nullableBool = (value: unknown) =>
    value === null || typeof value === "boolean";
  const v = value as Catalog;
  if (
    !v ||
    !Array.isArray(v.products) ||
    !Array.isArray(v.sources) ||
    !Array.isArray(v.alternatives)
  )
    return ["Expected catalog with products, sources and alternatives arrays."];
  const safeUrl = (url: unknown) => {
    try {
      const u = new URL(String(url));
      return u.protocol === "https:" && !u.username && !u.password;
    } catch {
      return false;
    }
  };
  const date = (s: unknown) =>
    typeof s === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(s) &&
    Number.isFinite(Date.parse(s)) &&
    new Date(s).toISOString().slice(0, 10) === s &&
    s <= new Date().toISOString().slice(0, 10);
  if (!Number.isInteger(v.version) || v.version < 1 || !date(v.updatedAt))
    errors.push("Invalid catalog version or updatedAt date.");
  const ids = new Set<string>();
  const register = (id: string) => {
    if (!text(id) || ids.has(id)) errors.push(`Missing/duplicate ID: ${id}`);
    ids.add(id);
  };
  const sourceIds = new Set(v.sources.map((s) => s.id));
  const productIds = new Set(v.products.map((p) => p.id));
  for (const s of v.sources) {
    register(s.id);
    if (
      !safeUrl(s.url) ||
      !date(s.checkedAt) ||
      !text(s.title) ||
      !text(s.notes)
    )
      errors.push(`Invalid source: ${s.id}`);
  }
  const verify = (
    x: { status: string; verifiedAt: string | null; sourceIds: string[] },
    name: string,
  ) => {
    if (
      !["verified", "pending", "stale"].includes(x.status) ||
      !strings(x.sourceIds) ||
      x.sourceIds.some((id) => !sourceIds.has(id))
    )
      errors.push(`Invalid verification: ${name}`);
    if (
      x.status === "verified" &&
      (!date(x.verifiedAt) || !x.sourceIds?.length)
    )
      errors.push(`Verified record needs evidence/date: ${name}`);
  };
  for (const p of v.products) {
    register(p.id);
    if (
      p.slug !== p.id ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(p.slug) ||
      !text(p.name) ||
      !text(p.provider) ||
      !text(p.summary) ||
      !text(p.summaryZh) ||
      !safeUrl(p.website) ||
      !CATEGORIES.some((c) => c.id === p.category) ||
      !Array.isArray(p.plans) ||
      !strings(p.features) ||
      !strings(p.models) ||
      !nullableBool(p.api)
    ) {
      errors.push(`Invalid product: ${p.id}`);
      continue;
    }
    verify(p, p.id);
    for (const plan of p.plans) {
      register(plan.id);
      verify(plan, plan.id);
      if (
        !["USD", "EUR", "GBP", "CNY", "JPY", "HKD"].includes(plan.currency) ||
        ![
          "free",
          "monthly",
          "annual",
          "pay-as-you-go",
          "one-time",
          "package",
        ].includes(plan.billing) ||
        !strings(plan.pricingModels) ||
        !plan.pricingModels.length ||
        plan.pricingModels.some((m) => !Object.hasOwn(PRICING_MODELS, m)) ||
        !Array.isArray(plan.components) ||
        !strings(plan.limits) ||
        !text(plan.name) ||
        !nullableBool(plan.commercial) ||
        typeof plan.freeAllowance !== "string"
      ) {
        errors.push(`Invalid plan: ${plan.id}`);
        continue;
      }
      if (
        plan.amount !== null &&
        (!Number.isFinite(plan.amount) || plan.amount < 0)
      )
        errors.push(`Invalid price: ${plan.id}`);
      if (plan.status === "verified" && plan.amount === null)
        errors.push(`Verified plan has no price: ${plan.id}`);
      if (
        plan.features !== undefined &&
        (!strings(plan.features) ||
          plan.features.some((f) => !p.features.includes(f)))
      )
        errors.push(`Invalid plan capability evidence: ${plan.id}`);
      const billingMode =
        plan.billing === "package" ? "usage-based-package" : plan.billing;
      if (!plan.pricingModels.includes(billingMode))
        errors.push(`Billing cycle and pricing models disagree: ${plan.id}`);
      if (plan.billing !== "free" && plan.pricingModels.includes("free"))
        errors.push(`Paid plan mislabeled as free: ${plan.id}`);
      if (plan.billing === "free" && plan.amount !== 0)
        errors.push(`Free plan must cost zero: ${plan.id}`);
      for (const c of plan.components) {
        register(c.id);
        if (
          ![
            "image",
            "second",
            "video",
            "characters",
            "minute",
            "song",
            "generation",
            "credit",
          ].includes(c.unit) ||
          ![c.model, c.resolution, c.quality, c.note].every(
            (v) => typeof v === "string",
          ) ||
          (c.overagePerCredit != null &&
            (!Number.isFinite(c.overagePerCredit) || c.overagePerCredit < 0)) ||
          !Number.isFinite(c.unitSize) ||
          c.unitSize <= 0 ||
          ![
            c.rate,
            c.included,
            c.creditAllowance,
            c.creditsPerUnit,
            c.maxDuration,
          ].every((n) => n === null || (Number.isFinite(n) && n >= 0)) ||
          !["month", "day", "once"].includes(c.allowancePeriod) ||
          !Array.isArray(c.durations) ||
          c.durations.some((n) => !Number.isFinite(n) || n <= 0)
        )
          errors.push(`Invalid component: ${c.id}`);
      }
    }
  }
  if (v.affiliateLinks !== undefined && !Array.isArray(v.affiliateLinks))
    errors.push("affiliateLinks must be an array.");
  for (const link of Array.isArray(v.affiliateLinks) ? v.affiliateLinks : []) {
    register(link.id);
    if (
      !productIds.has(link.productId) ||
      !safeUrl(link.url) ||
      !text(link.disclosure) ||
      typeof link.active !== "boolean"
    )
      errors.push(`Invalid affiliate disclosure/link: ${link.id}`);
  }
  for (const a of v.alternatives) {
    register(a.id);
    verify(a, a.id);
    const original = v.products.find((p) => p.id === a.original),
      alt = v.products.find((p) => p.id === a.alternative);
    if (
      !productIds.has(a.original) ||
      !productIds.has(a.alternative) ||
      a.original === a.alternative ||
      !text(a.reason) ||
      !text(a.difference) ||
      !text(a.scenario) ||
      !text(a.priceAdvantage) ||
      a.similarityType !== "shared-function" ||
      !strings(a.featureMatch) ||
      !a.featureMatch.length ||
      original?.category !== alt?.category ||
      a.featureMatch.some(
        (f) => !original?.features.includes(f) || !alt?.features.includes(f),
      )
    )
      errors.push(`Invalid directional relationship: ${a.id}`);
  }
  return errors;
}
