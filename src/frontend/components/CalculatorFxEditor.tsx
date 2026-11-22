import { useEffect,useState,useRef } from 'react';
import { exactValue,legacyDecimalText } from '../../shared/creditPurchase';
import { D } from '../../shared/discovery/decimal';
import { rebaseFx,type FxState } from '../../shared/calculatorFx';
export function CalculatorFxEditor({value,onChange,zh}:{value:FxState;onChange:(v:FxState)=>void;zh:boolean}) {
 const [draft,setDraft]=useState<Record<string,string>>({}),[error,setError]=useState(''),[code,setCode]=useState(''),[newRate,setNewRate]=useState('');
 const active=useRef({value,onChange});active.current={value,onChange};
 const [syncing,setSyncing]=useState(false);
 const automatic=async()=>{setSyncing(true);try{const current=active.current;const r=await fetch('/api/operations/fx?base='+encodeURIComponent(current.value.rateMeta?.baseCurrency||'CNY'),{cache:'no-store'});const b=await r.json();if(!r.ok||!b.success)throw Error();current.onChange({...current.value,...b.data});setError('');}catch{setError(zh?'同步汇率暂不可用，保留上次有效汇率；请先由管理员同步来源。':'Synchronized FX unavailable; keeping last valid rates. Ask an administrator to sync the provider first.');}finally{setSyncing(false);}};
 useEffect(()=>{if(value.rateMeta?.mode!=='automatic')return;void automatic();const id=setInterval(()=>void automatic(),600000);return()=>clearInterval(id);},[value.rateMeta?.mode]);
 const base=value.rateMeta?.baseCurrency??'CNY';
 useEffect(()=>{setDraft(Object.fromEntries(Object.entries(value.rates).map(([k,n])=>[k,value.ratesExact?.[k]??legacyDecimalText(n)])));},[value.rates,value.ratesExact]);
 const metadata=()=>value.rateMeta??{mode:'manual' as const,baseCurrency:base,source:zh?'用户手动输入':'Manual entry',updatedAt:''};
 const update=(currency:string,text:string)=>{
  setDraft(prev=>({...prev,[currency]:text}));
  try {const rate=D.parse(text);if(rate.n<=0n||(currency===base&&rate.cmp(D.parse('1'))!==0))throw Error();
   onChange({...value,rates:{...value.rates,[currency]:Number(text)},ratesExact:{...value.ratesExact,[currency]:text},rateRatios:{...value.rateRatios,[currency]:exactValue(rate)},rateMeta:{...metadata(),mode:'manual',updatedAt:new Date().toISOString()}});setError('');
  } catch {setError(zh?'无效汇率未应用；结果仍使用上次有效值。基准币种的汇率必须为 1。':'Invalid rate not applied; results still use the last valid rate. The base currency rate must equal 1.');}
 };
 return <div className="space-y-3"><div className="grid gap-3 sm:grid-cols-2"><label className="label">{zh?'汇率方式':'Rate mode'}<select className="input" aria-label="Rate mode" value={value.rateMeta?.mode||'manual'} onChange={e=>{if(e.target.value==='automatic')void automatic();else onChange({...value,rateMeta:{...metadata(),mode:'manual'}});}}><option value="manual">{zh?'手动汇率':'Manual rates'}</option><option value="automatic">{zh?'自动汇率（已同步来源）':'Automatic (synchronized provider)'}</option></select></label>
 <label className="label">{zh?'基准币种':'Base currency'}<select className="input" aria-label="Rate base" value={base} onChange={e=>{try{onChange(rebaseFx(value,e.target.value));setError('');}catch{setError(zh?'无法切换基准，请先补齐有效汇率。':'Cannot rebase; provide valid rates first.');}}}>{Object.keys(value.rates).map(c=><option key={c}>{c}</option>)}</select></label></div>
 <button type="button" className="btn-secondary" disabled={syncing} onClick={()=>void automatic()}>{zh?'加载已同步汇率':'Load synchronized rates'}</button><div className="grid grid-cols-2 gap-3">{Object.keys(value.rates).map(c=><div key={c}><label className="label">1 {c} = ? {base}</label><input aria-label={`FX ${c}`} className="input tabular" inputMode="decimal" value={draft[c]??''} onChange={e=>update(c,e.target.value)}/></div>)}</div>
 <label className="label">{zh?'汇率来源':'Rate source'}<input aria-label="Rate source" className="input" value={metadata().source} onChange={e=>onChange({...value,rateMeta:{...metadata(),mode:'manual',source:e.target.value}})}/></label>
 <label className="label">{zh?'更新时间（UTC）':'Updated at (UTC)'}<input aria-label="Rate updated at" className="input" placeholder="2026-11-13T12:00:00Z" value={metadata().updatedAt} onChange={e=>onChange({...value,rateMeta:{...metadata(),mode:'manual',updatedAt:e.target.value}})}/></label>
 <p className="text-xs text-ink-2">{value.rateMeta?.updatedAt?(zh?'记录更新时间：':'Recorded update: ')+value.rateMeta.updatedAt:(zh?'旧汇率未记录时间，不代表实时行情。':'Legacy rates have no recorded timestamp and are not live market data.')}</p>
 <div className="flex gap-2"><input aria-label="New currency" className="input min-w-0" placeholder={zh?'新增币种代码，如 CAD':'Currency code, e.g. CAD'} value={code} onChange={e=>setCode(e.target.value.toUpperCase())}/><input aria-label="New currency rate" className="input min-w-0" placeholder={zh?'明确汇率':'Explicit rate'} value={newRate} onChange={e=>setNewRate(e.target.value)}/><button type="button" className="btn-secondary flex-none" onClick={()=>{try{const amount=D.parse(newRate);if(!/^[A-Z]{3}$/.test(code)||Object.hasOwn(value.rates,code)||amount.n<=0n)throw Error();onChange({...value,rates:{...value.rates,[code]:Number(newRate)},ratesExact:{...value.ratesExact,[code]:newRate},rateRatios:{...value.rateRatios,[code]:exactValue(amount)},rateMeta:{...metadata(),mode:'manual',updatedAt:new Date().toISOString()}});setCode('');setNewRate('');setError('');}catch{setError(zh?'请输入新币种代码和明确的正数汇率。':'Enter a new currency code and an explicit positive rate.');}}}>{zh?'添加':'Add'}</button></div>
 {error&&<p role="alert" className="text-sm text-amber-700">{error}</p>}</div>;
}
