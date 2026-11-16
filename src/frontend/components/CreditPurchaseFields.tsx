import type { CreditPurchaseTerms, PurchaseCycle } from '../../shared/creditPurchase';
export const emptyCreditTerms = (): CreditPurchaseTerms => ({ stackable: null, maxPackages: null });
export function CreditPurchaseFields({ terms, onChange, zh, prefix }: { terms?: CreditPurchaseTerms; onChange: (v: CreditPurchaseTerms) => void; zh: boolean; prefix: string }) {
  const value = terms ?? emptyCreditTerms();
  return <div className="grid gap-3 rounded-lg border border-line bg-surface-2/40 p-3 sm:col-span-2 sm:grid-cols-2">
    <label className="label">{zh ? '本次购买的积分能否叠加' : 'Can these packages be combined for this usage?'}<select aria-label={`Stackable ${prefix}`} className="input mt-1" value={value.stackable === null ? 'unknown' : String(value.stackable)} onChange={e => onChange({ ...value, stackable: e.target.value === 'unknown' ? null : e.target.value === 'true' })}>
      <option value="unknown">{zh ? '未确认，暂不计算购买金额' : 'Unconfirmed — purchase amount unavailable'}</option>
      <option value="true">{zh ? '已确认可叠加，且无其他使用限制' : 'Confirmed: combinable without other usage restrictions'}</option>
      <option value="false">{zh ? '不可叠加，最多使用一个套餐' : 'Not combinable — at most one package'}</option>
    </select></label>
    <label className="label">{zh ? '本次最多可购买套餐数（可选）' : 'Maximum purchasable packages (optional)'}<input aria-label={`Max packages ${prefix}`} className="input mt-1" type="number" min="1" step="1" value={value.maxPackages ?? ''} placeholder={zh ? '留空：不另设数量上限' : 'Blank: no additional count limit'} onChange={e => onChange({ ...value, maxPackages: e.target.value === '' ? null : Number(e.target.value) })} /></label>
    <details className="sm:col-span-2"><summary className="cursor-pointer text-sm font-semibold text-primary">{zh?'免费积分、现金超额费与最低消费':'Free credits, cash overage & minimum charge'}</summary><div className="mt-3 grid gap-3 sm:grid-cols-2">
      {([['freeCredits',zh?'无需购包的同池免费积分':'Same-pool free credits without purchase'],['overagePerCredit',zh?'单套餐超额现金单价 / 积分':'Cash overage rate per credit'],['minimumSpend',zh?'购包最低消费（原币种）':'Minimum package charge (source currency)']] as const).map(([key,label])=><label className="label" key={key}>{label}<input className="input mt-1" aria-label={`${key} ${prefix}`} inputMode="decimal" value={value[key]??''} onChange={e=>onChange({...value,[key]:e.target.value===''?null:e.target.value})}/></label>)}
      <p className="text-xs text-ink-2 sm:col-span-2">{zh?'免费积分需确认无需购买即可获得、属于同一积分池，且本次可用。现金超额费仅用于“不可叠加”的单套餐；可叠加时按完整包购买，两种方式不能同时应用。最低消费差额不会产生额外积分。':'Free credits must be available without purchase in the same pool and usage window. Cash overage applies only to one non-combinable package. Combinable packages use whole-package purchases; the two strategies cannot be mixed. Minimum-charge differences do not create extra credits.'}</p>
    </div></details>
    <p className="text-xs text-ink-2 sm:col-span-2">{zh ? '仅在你已确认所有额度能用于同一次使用、且无额外限制时选择“可叠加”。按零余额、新购同一种套餐计算；不跨套餐或积分池合并，不假定订阅能重复购买。' : 'Confirm that all credits apply to the same usage window without other restrictions. Assumes zero starting balance and new purchases of one package type. No combining different plans or credit pools; subscription repurchase is not assumed.'}</p>
  </div>;
}
export function PurchaseCycleField({ value, onChange, zh, prefix }: { value?: PurchaseCycle; onChange: (v: PurchaseCycle | undefined) => void; zh: boolean; prefix: string }) {
  return <label className="label">{zh ? '购买周期 / 承诺' : 'Purchase cycle / commitment'}<select aria-label={`Purchase cycle ${prefix}`} className="input mt-1" value={value ?? ''} onChange={e => onChange(e.target.value ? e.target.value as PurchaseCycle : undefined)}>
    <option value="">{zh ? '未确认' : 'Unconfirmed'}</option><option value="one_time">{zh ? '一次性购买' : 'One-time purchase'}</option><option value="monthly">{zh ? '月度套餐' : 'Monthly package'}</option><option value="yearly">{zh ? '年度预付套餐' : 'Annual prepaid package'}</option><option value="custom">{zh ? '其他 / 自定义周期' : 'Other / custom cycle'}</option>
  </select></label>;
}
