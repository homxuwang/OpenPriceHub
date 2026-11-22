import { createContext,useContext,useEffect,useState,type ReactNode } from 'react';
import { UnifiedApiRepository,unifiedTools,type UnifiedCatalog } from '../../shared/unifiedCatalog';
import { MOCK_TOOLS } from '../mock/tools';
const mode=import.meta.env.VITE_CATALOG_MODE==='mock'?'mock':'api';
const Context=createContext({tools:mode==='mock'?MOCK_TOOLS:[],catalog:null as UnifiedCatalog|null,loading:mode!=='mock',error:null as string|null,simulated:mode==='mock'});
export function UnifiedProvider({children}:{children:ReactNode}){
 const [catalog,setCatalog]=useState<UnifiedCatalog|null>(null),[loading,setLoading]=useState(mode!=='mock'),[error,setError]=useState<string|null>(null);
 useEffect(()=>{if(mode==='mock')return;let active=true,controller:AbortController|undefined;const refresh=()=>{controller?.abort();controller=new AbortController();new UnifiedApiRepository().load(controller.signal).then(c=>{if(active){setCatalog(c);setError(null);}}).catch(e=>{if(active&&e.name!=='AbortError')setError('真实目录暂时不可用 / Published catalog unavailable');}).finally(()=>{if(active)setLoading(false);});};refresh();const interval=setInterval(refresh,300000);window.addEventListener('focus',refresh);return()=>{active=false;controller?.abort();clearInterval(interval);window.removeEventListener('focus',refresh);};},[]);
 return <Context.Provider value={{tools:mode==='mock'?MOCK_TOOLS:catalog?unifiedTools(catalog):[],catalog,loading,error,simulated:mode==='mock'}}>{children}</Context.Provider>;
}
export const useUnified=()=>useContext(Context);
export function CatalogStatus(){const {simulated,loading,error}=useUnified();return <p className="mb-4 rounded-lg border border-line p-3 text-sm text-ink-2" role="status">{simulated?'模拟目录 / Mock catalog':error|| (loading?'加载已发布目录… / Loading published catalog…':'已发布数据库目录 · 原币种价格 · 无价不等于免费 / Published database catalog · Original currencies · Unknown prices are not free')}</p>;}
