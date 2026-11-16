import type { WebsiteDraft } from '../../shared/websiteSubmission';
import { CHANNEL_RELATIONSHIPS,WEBSITE_CATEGORIES,WEBSITE_PRICING_MODELS,emptyWebsitePlan,emptyWebsiteComponent } from '../../shared/websiteSubmission';
import { UNIT_LABELS,MANUAL_UNITS } from '../../shared/manualUnits';
import { useLocale } from '../i18n';

export default function WebsiteEditor({value,onChange}:{value:WebsiteDraft;onChange:(d:WebsiteDraft)=>void}){
 const lang=useLocale(),zh=lang==='zh',tr=(a:string,b:string)=>zh?a:b;
 const set=(k:keyof WebsiteDraft,v:unknown)=>onChange({...value,[k]:v});
 const text=(label:string,v:string,setter:(v:string)=>void,type='text')=><label className="block"><span className="label">{label}</span><input className="input" type={type} value={v} onChange={e=>setter(e.target.value)} /></label>;
 const rel={official:tr('官方渠道（需管理员核对）','Official (subject to review)'),third_party:tr('第三方服务渠道','Third-party channel'),independent:tr('独立开发者产品','Independent developer product')};
 const cats={image:tr('AI 生图','AI Image'),video:tr('AI 生视频','AI Video'),voice:tr('语音 / TTS','Voice / TTS'),music:tr('音乐生成','Music'),'llm-api':'LLM / API'};
 return <div className="space-y-5">
  <section className="card grid gap-4 p-5 sm:grid-cols-2">
   {text(tr('网站 / 产品名称','Website / product name'),value.name,v=>set('name',v))}
   {text(tr('网站地址（HTTPS）','Website URL (HTTPS)'),value.website,v=>set('website',v),'url')}
   {text(tr('价格来源地址（HTTPS）','Pricing source URL (HTTPS)'),value.pricingUrl,v=>set('pricingUrl',v),'url')}
   <label><span className="label">{tr('渠道关系','Channel relationship')}</span><select aria-label={tr('渠道关系','Channel relationship')} className="input" value={value.relationship} onChange={e=>set('relationship',e.target.value)}>{CHANNEL_RELATIONSHIPS.map(x=><option key={x} value={x}>{rel[x]}</option>)}</select></label>
   <label><span className="label">{tr('产品分类','Category')}</span><select aria-label={tr('产品分类','Category')} className="input" value={value.category} onChange={e=>set('category',e.target.value)}>{WEBSITE_CATEGORIES.map(x=><option key={x} value={x}>{cats[x]}</option>)}</select></label>
   <label className="sm:col-span-2"><span className="label">{tr('功能与产品说明','Features and description')}</span><textarea className="input" value={value.description} onChange={e=>set('description',e.target.value)} rows={3}/></label>
  </section>
  <p className="text-sm text-ink-2">{tr('可以只提交网站，稍后由管理员补齐价格。空价格表示未知，免费必须明确填 0。所有价格以原币种保存。','You may submit a website without prices. Empty means unknown; free requires an explicit 0. Prices retain their original currency.')}</p>
  {value.plans.map((p,i)=>{
   const setPlan=(patch:Partial<typeof p>)=>set('plans',value.plans.map((x,j)=>i===j?{...p,...patch}:x));
   return <section className="card space-y-4 p-5" key={i}>
    <div className="flex items-center justify-between"><h2 className="font-semibold">{tr('套餐','Plan')} {i+1}</h2><button type="button" className="btn-secondary" onClick={()=>set('plans',value.plans.filter((_,j)=>j!==i))}>{tr('删除套餐','Remove plan')}</button></div>
    <div className="grid gap-4 sm:grid-cols-2">
     {text(tr('套餐名称','Plan name'),p.name,v=>setPlan({name:v}))}
     {text(tr('币种（如 CNY / USD）','Currency (e.g. CNY / USD)'),p.currency,v=>setPlan({currency:v.toUpperCase()}))}
     {text(tr('购买金额（空表示未知）','Purchase amount (empty = unknown)'),p.amount??'',v=>setPlan({amount:v||null}))}
     <label><span className="label">{tr('购买周期','Billing cycle')}</span><select aria-label={tr('购买周期','Billing cycle')} className="input" value={p.billing} onChange={e=>setPlan({billing:e.target.value as typeof p.billing})}>{[['usage',tr('按量','Usage')],['monthly',tr('月付','Monthly')],['annual',tr('年付','Annual')],['package',tr('固定套餐','Package')],['one-time',tr('一次性','One-time')],['free',tr('免费','Free')]].map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
     {text(tr('套餐官方价格来源（空则采用网站价格页）','Plan pricing source (defaults to website pricing URL)'),p.sourceUrl,v=>setPlan({sourceUrl:v}),'url')}
     {text(tr('免费额度（含单位与有效期）','Free allowance (with unit and validity)'),p.freeAllowance,v=>setPlan({freeAllowance:v}))}
     {text(tr('积分数量','Included credits'),p.creditAmount??'',v=>setPlan({creditAmount:v||null}))}
     {text(tr('积分池标识（不同池不可混用）','Credit pool ID (different pools cannot be combined)'),p.creditPool,v=>setPlan({creditPool:v}))}
     <label><span className="label">{tr('套餐可叠加','Stackable packages')}</span><select aria-label={tr('套餐可叠加','Stackable packages')} className="input" value={p.stackable===null?'unknown':String(p.stackable)} onChange={e=>setPlan({stackable:e.target.value==='unknown'?null:e.target.value==='true'})}><option value="unknown">{tr('未知','Unknown')}</option><option value="true">{tr('是','Yes')}</option><option value="false">{tr('否','No')}</option></select></label>
     {text(tr('使用限制、超额条件、商用条款','Limits, overage conditions, commercial terms'),p.restrictions,v=>setPlan({restrictions:v}))}
    </div>
    <fieldset><legend className="label">{tr('付费方式（多选）','Pricing models (multiple)')}</legend><div className="flex flex-wrap gap-3">{WEBSITE_PRICING_MODELS.map(m=><label key={m} className="text-sm"><input type="checkbox" checked={p.pricingModels.includes(m)} onChange={e=>setPlan({pricingModels:e.target.checked?[...p.pricingModels,m]:p.pricingModels.filter(x=>x!==m)})}/> {m}</label>)}</div></fieldset>
    {p.components.map((c,k)=>{
     const setC=(patch:Partial<typeof c>)=>setPlan({components:p.components.map((x,j)=>j===k?{...c,...patch}:x)});
     return <fieldset key={k} className="rounded-lg border border-line p-3"><legend>{tr('计价组件','Price component')} {k+1}</legend><div className="grid gap-3 sm:grid-cols-2">
      <label><span className="label">{tr('计价单位','Unit')}</span><select aria-label={tr('计价单位','Unit')} className="input" value={c.unit} onChange={e=>setC({unit:e.target.value})}>{MANUAL_UNITS.map(u=><option key={u} value={u}>{UNIT_LABELS[lang][u]}</option>)}</select></label>
      {text(tr('现金单价（不是积分消耗）','Cash rate (not credit consumption)'),c.rate??'',v=>setC({rate:v||null}))}
      {text(tr('包含的免费计量数量','Included free units'),c.included??'',v=>setC({included:v||null}))}
      {text(tr('超额现金单价','Cash overage rate'),c.overage??'',v=>setC({overage:v||null}))}
      {text(tr('每单位消耗积分','Credits consumed per unit'),c.creditsPerUnit??'',v=>setC({creditsPerUnit:v||null}))}
      {text(tr('模型名称（仅描述，不自动认定关联）','Model name (descriptive, no automatic mapping)'),c.modelName,v=>setC({modelName:v}))}
      {text(tr('分辨率','Resolution'),c.resolution,v=>setC({resolution:v}))}
      {text(tr('质量','Quality'),c.quality,v=>setC({quality:v}))}
      {text(tr('适用时长（秒）','Applicable duration (seconds)'),c.durationSeconds??'',v=>setC({durationSeconds:v||null}))}
     </div><button type="button" className="mt-3 text-sm text-primary" onClick={()=>setPlan({components:p.components.filter((_,j)=>j!==k)})}>{tr('删除组件','Remove component')}</button></fieldset>;
    })}
    <button type="button" className="btn-secondary" onClick={()=>{const c=emptyWebsiteComponent();c.unit=value.category==='video'?'per_second':value.category==='voice'?'per_character':value.category==='music'?'per_song':value.category==='llm-api'?'per_1m_input_tokens':'per_image';setPlan({components:[...p.components,c]});}}>{tr('添加计价组件','Add price component')}</button>
   </section>;
  })}
  <button type="button" className="btn-secondary" onClick={()=>set('plans',[...value.plans,emptyWebsitePlan()])}>{tr('添加套餐','Add plan')}</button>
 </div>;
}
