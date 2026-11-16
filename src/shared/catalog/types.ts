export type CategoryId = "image" | "video" | "voice" | "music";
export type Verification = "verified" | "pending" | "stale";
export type PricingModel =
  | "free"
  | "monthly"
  | "annual"
  | "pay-as-you-go"
  | "credit-based"
  | "usage-based-package"
  | "freemium"
  | "one-time";
export type Unit =
  | "image"
  | "second"
  | "video"
  | "characters"
  | "minute"
  | "song"
  | "generation"
  | "credit";
export interface Source {
  id: string;
  url: string;
  title: string;
  checkedAt: string;
  notes: string;
}
export interface Component {
  id: string;
  unit: Unit;
  unitSize: number;
  rate: number | null;
  included: number | null;
  /** Verified currency charge per extra credit beyond the allowance. */
  overagePerCredit?: number | null;
  creditAllowance: number | null;
  creditsPerUnit: number | null;
  allowancePeriod: "month" | "day" | "once";
  model: string;
  resolution: string;
  quality: string;
  durations: number[];
  maxDuration: number | null;
  note: string;
}
export interface Plan {
  /** Capabilities verified for this plan and the modeled workload. */
  features?: string[];
  id: string;
  name: string;
  pricingModels: PricingModel[];
  billing:
    "free" | "monthly" | "annual" | "pay-as-you-go" | "one-time" | "package";
  amount: number | null;
  currency: string;
  freeAllowance: string;
  commercial: boolean | null;
  limits: string[];
  sourceIds: string[];
  verifiedAt: string | null;
  status: Verification;
  components: Component[];
}
export interface Product {
  id: string;
  slug: string;
  name: string;
  category: CategoryId;
  provider: string;
  website: string;
  summary: string;
  summaryZh: string;
  features: string[];
  models: string[];
  api: boolean | null;
  status: Verification;
  verifiedAt: string | null;
  sourceIds: string[];
  plans: Plan[];
}
export interface Alternative {
  id: string;
  original: string;
  alternative: string;
  similarityType: "shared-function";
  featureMatch: string[];
  priceAdvantage: string;
  scenario: string;
  reason: string;
  difference: string;
  status: Verification;
  verifiedAt: string | null;
  sourceIds: string[];
}
export interface AffiliateLink {
  id: string;
  productId: string;
  url: string;
  disclosure: string;
  active: boolean;
}
export interface Catalog {
  affiliateLinks?: AffiliateLink[];
  version: number;
  updatedAt: string;
  sources: Source[];
  products: Product[];
  alternatives: Alternative[];
}
export const CATEGORIES: {
  id: CategoryId;
  slug: string;
  en: string;
  zh: string;
  features: string[];
}[] = [
  {
    id: "image",
    slug: "ai-image",
    en: "AI Image Generation",
    zh: "AI 图片生成",
    features: [
      "text-to-image",
      "image-editing",
      "image-enhancement",
      "background-removal",
      "image-upscaling",
    ],
  },
  {
    id: "video",
    slug: "ai-video",
    en: "AI Video Generation",
    zh: "AI 视频生成",
    features: [
      "text-to-video",
      "image-to-video",
      "video-editing",
      "video-enhancement",
      "ai-avatar-video",
    ],
  },
  {
    id: "voice",
    slug: "ai-voice",
    en: "AI Voice & TTS",
    zh: "AI 语音与 TTS",
    features: [
      "text-to-speech",
      "voice-cloning",
      "ai-voice-generation",
      "speech-to-speech",
      "speech-processing",
    ],
  },
  {
    id: "music",
    slug: "ai-music",
    en: "AI Music Generation",
    zh: "AI 音乐生成",
    features: [
      "text-to-music",
      "ai-song-generation",
      "instrumental-generation",
      "music-editing",
      "sound-effects-generation",
    ],
  },
];
export const PRICING_MODELS: Record<PricingModel, string> = {
  free: "Free",
  monthly: "Monthly",
  annual: "Annual",
  "pay-as-you-go": "Pay As You Go",
  "credit-based": "Credit-based",
  "usage-based-package": "Usage-based Package",
  freemium: "Freemium",
  "one-time": "One-time Purchase",
};
export const UNIT_LABELS: Record<Unit, string> = {
  image: "image",
  second: "second",
  video: "video",
  characters: "characters",
  minute: "minute",
  song: "song",
  generation: "generation",
  credit: "credit",
};
