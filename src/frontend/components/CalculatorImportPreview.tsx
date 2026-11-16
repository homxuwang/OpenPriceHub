import { useRef } from 'react';
import type { ManualCompareState } from '../../shared/manualCompare';
import type { DetailedCompareState } from '../../shared/detailedCompare';
import type { ImportPreview } from '../../shared/calculatorIo';
export function CalculatorImportPreview({preview,currentCount,onConfirm,onCancel,zh,transfer=false}:{preview:ImportPreview<unknown>;currentCount:number;onConfirm:()=>void;onCancel:()=>void;zh:boolean;transfer?:boolean}){
 const dialog=useRef<HTMLElement>(null);
 const data=preview.data as ManualCompareState|DetailedCompareState;
 const names='items' in data?data.items.map(i=>`${i.platformName} · ${i.modelName} · ${i.currency}`):data.rules.map(r=>`${data.platforms.find(p=>p.id===r.platformId)?.name??'—'} · ${data.models.find(m=>m.id===r.modelId)?.name??'—'} · ${r.currency}`);
 const labels:Record<string,string>=zh?{rules:'价格规则',models:'模型',plans:'套餐',platforms:'网站 / 服务商'}:{};
 return <div className="fixed inset-0 z-[70] flex items-center justify-center bg-ink/40 p-4" onKeyDown={e=>{if(e.key==='Escape')onCancel();if(e.key==='Tab'){const nodes=dialog.current?.querySelectorAll<HTMLButtonElement>('button');if(nodes?.length){const first=nodes[0],last=nodes[nodes.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}}}}><section ref={dialog} role="dialog" aria-modal="true" aria-label="Import preview" className="max-h-[85vh] w-full max-w-xl overflow-y-auto rounded-card border border-line bg-surface p-5 shadow-pop">
 <h2 className="font-display text-xl font-bold">{transfer?(zh?'保存到详细模式预览':'Save to detailed mode preview'):(zh?'JSON 导入预览':'JSON import preview')}</h2>
 <p className="mt-3 text-sm">{zh?'文件版本':'File version'}: {preview.fileVersion} · {preview.mode==='quick'?(zh?'快速模式':'Quick mode'):(zh?'详细模式':'Detailed mode')}</p><dl className="my-3 grid grid-cols-2 gap-2 text-sm">{Object.entries(preview.counts).map(([k,n])=><div key={k}>{labels[k]??k}: <strong>{n}</strong></div>)}</dl>
 <p className="text-sm text-ink-2">{transfer?(zh?'新增独立的网站、模型和规则，不按同名自动合并。保留已有详细模式价格；有已有档案时保留其用量和汇率，空档案采用快速模式设置。':'Adds independent platforms, models and rules without merging by name. Existing prices remain. Existing settings are retained; an empty archive adopts quick settings.'):(zh?`确认后替换当前模式整个档案（现有价格规则 ${currentCount} 条）；确认前不更改数据。`:`Confirm to replace this mode’s entire archive (${currentCount} existing price rules). Nothing changes before confirmation.`)}</p>
 <p className="mt-3 text-xs text-ink-2">{zh?'结果币种':'Result currency'}: {data.targetCurrency} · {zh?'用量范围':'Usage period'}: {zh?({request:'单次任务',month:'月度',year:'年度'}[data.scenario.usagePeriod??'request']):(data.scenario.usagePeriod??'request')} · {zh?'汇率来源':'Rate source'}: {data.rateMeta?.source||(zh?'未记录':'Unrecorded')}</p>
 <ul className="mt-3 space-y-1 rounded-lg border border-line p-3 text-xs">{names.slice(0,5).map((name,i)=><li key={i} className="break-words">{name}</li>)}{names.length>5&&<li>+ {names.length-5} {zh?'条规则':'rules'}</li>}</ul>
 {!!preview.warnings.length&&<ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-amber-700">{preview.warnings.map(w=><li key={w}>{w}</li>)}</ul>}
 <p className="mt-3 text-xs text-ink-2">{zh?'确认前会保留当前模式上一版的本地备份；导入不会写入数据库。':'The previous local state is backed up before confirmation. Import does not write to the database.'}</p>
 <div className="mt-5 flex flex-wrap gap-3"><button autoFocus type="button" className="btn-secondary" onClick={onCancel}>{zh?'取消':'Cancel'}</button><button type="button" className="btn-primary" onClick={onConfirm}>{transfer?(zh?'确认追加到详细模式':'Confirm save to detailed mode'):(zh?'确认导入并替换':'Confirm import and replace')}</button></div>
 </section></div>;
}
