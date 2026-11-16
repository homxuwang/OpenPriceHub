import type { Scenario } from '../../shared/types';
import type { ManualCategory } from '../../shared/manualCompare';
export function CalculatorScenarioFields({value,onChange,zh,category=null}:{value:Scenario;onChange:(v:Scenario)=>void;zh:boolean;category?:ManualCategory|null}) {
 const groups:{category:ManualCategory;title:string;fields:[keyof Scenario,string,string][]}[]=[
  {category:'image',title:zh?'图片':'Images',fields:[['imageCount','图片张数','Images']]},
  {category:'video',title:zh?'视频':'Video',fields:[['videoSeconds','视频总秒数','Video seconds'],['videoCount','视频条数','Video count'],['videoSecondsPerVideo','每条视频秒数（可选）','Seconds per video (optional)']]},
  {category:'tts',title:'TTS',fields:[['ttsMinutes','TTS 分钟','TTS minutes'],['ttsCharacters','TTS 字符数','TTS characters']]},
  {category:'music',title:zh?'音乐':'Music',fields:[['musicMinutes','音乐总分钟','Music minutes'],['musicSongs','歌曲数量','Song count'],['musicGenerations','生成次数','Generation count'],['musicSecondsPerSong','每首歌曲秒数（可选）','Seconds per song (optional)']]},
  {category:'text',title:'LLM/API',fields:[['textInputTokens','非缓存输入 Token','Non-cached input tokens'],['textOutputTokens','输出 Token','Output tokens'],['textCachedTokens','缓存输入 Token','Cached input tokens']]},
  {category:'audio',title:zh?'未分类音频':'Unclassified audio',fields:[['audioMinutes','未分类音频分钟','Unclassified audio minutes']]},
 ];
 return <div className="space-y-4"><label className="label">{zh?'本次用量范围':'Usage period'}<select aria-label="Usage period" className="input mt-1" value={value.usagePeriod??'request'} onChange={e=>onChange({...value,usagePeriod:e.target.value as Scenario['usagePeriod']})}><option value="request">{zh?'单次任务':'One workload'}</option><option value="month">{zh?'一个月':'One month'}</option><option value="year">{zh?'一年':'One year'}</option></select></label>
 {groups.filter(g=>!category||g.category===category).map(g=><fieldset key={g.category} className="rounded-lg border border-line p-3"><legend className="text-sm font-semibold">{g.title}</legend><div className="grid grid-cols-2 gap-3">{g.fields.map(([key,cn,en])=><div key={key}><label className="label">{zh?cn:en}</label><input aria-label={`Usage ${key}`} className="input tabular" type="number" min="0" step="any" value={typeof value[key]==='number'?value[key]:key==='videoCount'?1:0} onChange={e=>onChange({...value,[key]:Math.max(0,Number(e.target.value)||0)})}/></div>)}</div></fieldset>)}
 <label className="label">{zh?'直接按积分计价时的积分用量':'Credits for direct per-credit pricing'}<input aria-label="Usage creditCount" className="input mt-1" type="number" min="0" step="any" value={value.creditCount??0} onChange={e=>onChange({...value,creditCount:Math.max(0,Number(e.target.value)||0)})}/></label>
 <p className="text-xs text-ink-2">{zh?'填写单条/单曲时长时，时间用量 = 数量 × 时长；否则采用总时长。字符与分钟、歌曲与生成次数不自动互换。输入 Token 不含缓存，缓存另计。':'With explicit per-video/song duration, time usage = count × duration; otherwise total duration applies. Characters/minutes and songs/generations are not automatically converted. Cached input is separate from non-cached input.'}</p></div>;
}
