/** P1 transport/domain contract. Monetary and quantity values are decimal strings, never floats. */
export type Decimal = string;
export type CategoryId = 'image' | 'video' | 'tts' | 'music' | 'llm';
export type Unit = 'image' | 'second' | 'character' | 'minute' | 'song' | 'generation' | 'input_token' | 'output_token' | 'credit';
export type Billing = 'free' | 'monthly' | 'annual' | 'payg' | 'credits' | 'package' | 'one_time';
export interface Category { id: CategoryId; name: string }
export interface Provider { id: string; name: string }
export interface Product { id: string; name: string; categoryId: CategoryId; providerId: string; tagIds: string[] }
export interface Model { id: string; name: string; developerId: string; categoryId: CategoryId }
export interface Channel { id: string; name: string; providerId: string }
export interface Offer { id: string; productId: string; modelId: string; channelId: string }
export interface Attribute { id: string; name: string }
export interface AttributeValue { modelId: string; attributeId: string; value: string }
export interface Tag { id: string; name: string }
export interface PriceSource { id: string; kind: 'simulation' | 'official'; label: string; url: string | null }
export interface Component { unit: Unit; rate: Decimal | null; per: Decimal }
export interface Entitlement { unit: Unit; quantity: Decimal; period: 'month' | 'purchase'; poolId: string | null }
export interface CreditRule { unit: Unit; creditsPerUnit: Decimal; poolId: string }
export interface Plan {
  id: string; offerId: string; name: string; billing: Billing; currency: string;
  amount: Decimal | null; components: Component[]; entitlement: Entitlement | null;
  creditRule: CreditRule | null; sourceId: string; validUntil: string;
  conditions: Record<string, string>; // explicit resolution / quality / model capability constraints
}
export interface Alternative { originalId: string; alternativeId: string; reason: string; scenario: string }
export interface Criterion { attributeId: string; value: string; kind: 'required' | 'preferred' }
export interface Experience { id: string; name: string; nameZh?: string; categoryId: CategoryId; usage: Partial<Record<Unit, Decimal>>; criteria: Criterion[]; conditions: Record<string, string> }
export interface Catalog {
  schemaVersion: 1; simulated: boolean; categories: Category[]; providers: Provider[];
  products: Product[]; models: Model[]; channels: Channel[]; offers: Offer[]; plans: Plan[];
  attributes: Attribute[]; attributeValues: AttributeValue[]; tags: Tag[];
  sources: PriceSource[]; alternatives: Alternative[]; experiences: Experience[];
}
export interface SearchSelection { kind: 'product' | 'model' | 'provider'; id: string }
export interface SearchChoice extends SearchSelection { name: string }
export interface Request {
  categoryId: CategoryId; usage: Partial<Record<Unit, Decimal>>; criteria: Criterion[];
  conditions: Record<string, string>; query?: string; selections?: SearchSelection[]; billing?: Billing[]; tagId?: string;
}
export interface Quote {
  planId: string; status: 'ok' | 'blocked'; reason: string | null; simulated: boolean;
  currency: string; purchaseExact: { numerator: string; denominator: string } | null; purchase: Decimal | null; consumed: Decimal | null;
  monthlyEquivalent: Decimal | null; remaining: { quantity: Decimal; unit: Unit; poolId: string | null } | null;
  effectiveUnitCost: Decimal | null; basis: string; preferredMatches: number;
}
export const BILLINGS: Billing[] = ['free', 'monthly', 'annual', 'payg', 'credits', 'package', 'one_time'];
export const UNITS: Unit[] = ['image', 'second', 'character', 'minute', 'song', 'generation', 'input_token', 'output_token', 'credit'];
