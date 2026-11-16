export const MANUAL_UNITS = ['per_image','per_video','per_second','per_minute','per_character','per_song','per_generation','per_credit','per_1k_input_tokens','per_1m_input_tokens','per_1k_output_tokens','per_1m_output_tokens','per_1k_cached_tokens','per_1m_cached_tokens'] as const;
export type ManualUnit = typeof MANUAL_UNITS[number];
export interface PriceTier { upTo: string | null; rate: string | null }
export interface ManualUnitDefinition {
  unitType: ManualUnit; value: number | null; exactValue?: string | null;
  included?: string; overageRate?: string | null; tiers?: PriceTier[]; tierMode?: 'graduated' | 'volume';
}
export interface BillingTerms { kind: 'usage' | 'monthly' | 'annual' | 'free'; fixedFee: string | null; minimumSpend: string | null; allowancePeriod?:'month'|'year' }
export const UNIT_LABELS: Record<'zh'|'en', Record<ManualUnit,string>> = {
 zh: { per_image:'每张图片',per_video:'每条视频',per_second:'每秒',per_minute:'每分钟',per_character:'每字符',per_song:'每首歌曲',per_generation:'每次生成',per_credit:'每积分',per_1k_input_tokens:'每 1K 输入 Token',per_1m_input_tokens:'每 1M 输入 Token',per_1k_output_tokens:'每 1K 输出 Token',per_1m_output_tokens:'每 1M 输出 Token',per_1k_cached_tokens:'每 1K 缓存输入 Token',per_1m_cached_tokens:'每 1M 缓存输入 Token' },
 en: { per_image:'Per image',per_video:'Per video',per_second:'Per second',per_minute:'Per minute',per_character:'Per character',per_song:'Per song',per_generation:'Per generation',per_credit:'Per credit',per_1k_input_tokens:'Per 1K input tokens',per_1m_input_tokens:'Per 1M input tokens',per_1k_output_tokens:'Per 1K output tokens',per_1m_output_tokens:'Per 1M output tokens',per_1k_cached_tokens:'Per 1K cached input tokens',per_1m_cached_tokens:'Per 1M cached input tokens' }
};
export const tokenFamily = (unit: ManualUnit) => unit.includes('cached_tokens') ? 'cached' : unit.includes('input_tokens') ? 'input' : unit.includes('output_tokens') ? 'output' : unit;
