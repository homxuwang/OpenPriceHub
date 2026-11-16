export type AudioKind = "voice" | "music";
export type AudioUnit = "characters" | "minute" | "song" | "generation";
export type AudioBilling = "usage" | "monthly" | "annual" | "package" | "free";
export interface AudioOffer {
  id: string;
  name: string;
  currency: "USD" | "CNY" | "EUR";
  unit: AudioUnit;
  billing: AudioBilling;
  amount: number | null;
  unitSize: number;
  allowance: number | null;
  overage: number | null;
}
export interface AudioResult {
  cost: number | null;
  upfront: number | null;
  reason: "missing" | "quota" | "unit" | null;
  basis: string;
}
export const audioUnits = (kind: AudioKind): AudioUnit[] =>
  kind === "voice"
    ? ["characters", "minute"]
    : ["song", "generation", "minute"];
export function estimateAudio(
  offer: AudioOffer,
  quantity: number,
  unit: AudioUnit,
): AudioResult {
  const result: AudioResult = {
    cost: null,
    upfront: null,
    reason: null,
    basis: `${offer.currency}:${unit}`,
  };
  if (offer.unit !== unit) return { ...result, reason: "unit" };
  const valid = (n: number | null): n is number =>
    n !== null && Number.isFinite(n) && n >= 0;
  if (
    !valid(quantity) ||
    !valid(offer.unitSize) ||
    offer.unitSize <= 0 ||
    (offer.billing !== "free" && !valid(offer.amount))
  )
    return { ...result, reason: "missing" };
  const amount = offer.amount ?? 0;
  if (offer.billing === "usage")
    return { ...result, cost: (amount * quantity) / offer.unitSize };
  if (!valid(offer.allowance)) return { ...result, reason: "missing" };
  if (offer.billing === "package") {
    if (offer.allowance <= 0) return { ...result, reason: "missing" };
    return { ...result, cost: Math.ceil(quantity / offer.allowance) * amount };
  }
  const base =
    offer.billing === "free"
      ? 0
      : offer.billing === "annual"
        ? amount / 12
        : amount;
  const excess = Math.max(0, quantity - offer.allowance);
  if (excess > 0 && !valid(offer.overage))
    return { ...result, reason: "quota" };
  return {
    ...result,
    cost: base + (excess / offer.unitSize) * (offer.overage ?? 0),
    upfront: offer.billing === "annual" ? amount : null,
  };
}
