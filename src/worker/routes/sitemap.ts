import type { Env } from '../../shared/types';
import { loadCatalog } from './catalog';
import { sitemapXML } from '../../shared/catalog/seo';
export async function handleSitemap(env:Env):Promise<Response>{const {catalog}=await loadCatalog(env);return new Response(sitemapXML(catalog,env.SITE_URL||'https://ai-price-compare.pages.dev'),{headers:{'Content-Type':'application/xml;charset=UTF-8'}});}
