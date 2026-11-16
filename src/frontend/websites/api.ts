export async function websiteApi<T>(path:string,options:RequestInit={},key?:string):Promise<T>{
 const res=await fetch(`/api/websites${path}`,{...options,headers:{'Content-Type':'application/json',...(key?{'X-Admin-Key':key}:{}),...options.headers}});
 let body;try{body=await res.json();}catch{throw new Error('网站提交服务未启动 / Website API unavailable');}
 if(!res.ok||!body.success)throw new Error(body.error||`HTTP ${res.status}`);return body.data as T;
}

// getRandomValues also works on HTTP development origins; randomUUID may not.
export function websiteRequestId():string {
 const bytes=new Uint8Array(16);globalThis.crypto.getRandomValues(bytes);
 return Array.from(bytes,v=>v.toString(16).padStart(2,'0')).join('');
}
