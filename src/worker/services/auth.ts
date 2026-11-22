import type { Env } from '../../shared/types';
export interface Principal {id:string;role:'admin'|'reviewer'|'developer'|'bootstrap'}
export const hex=(b:ArrayBuffer|Uint8Array)=>Array.from(new Uint8Array(b),v=>v.toString(16).padStart(2,'0')).join('');
export const nonce=()=>hex(crypto.getRandomValues(new Uint8Array(32)));
export const digest=async(s:string)=>hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)));
export async function principal(request:Request,env:Env):Promise<Principal|null>{
 const key=request.headers.get('X-Admin-Key');
 if(key&&env.ADMIN_KEY&&!/^(your-|dev-admin-key|replace)/.test(env.ADMIN_KEY)&&await digest(key)===await digest(env.ADMIN_KEY))return {id:'bootstrap',role:'bootstrap'};
 const token=request.headers.get('Cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith('oph_session='))?.slice(12);
 if(!token||! /^[a-f0-9]{64}$/.test(token))return null;
 const row=await env.DB.prepare('SELECT u.id,u.role FROM auth_sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>? AND u.disabled=0').bind(await digest(token),new Date().toISOString()).first<Principal>();
 return row||null;
}
export function sameOrigin(request:Request,env:Env){
 const origin=request.headers.get('Origin');
 return !origin||origin===new URL(request.url).origin||origin===env.SITE_URL;
}
export async function administrator(request:Request,env:Env,publish=true){
 if(!['GET','HEAD','OPTIONS'].includes(request.method)&&!sameOrigin(request,env))return null;
 const p=await principal(request,env);return p&&(p.role==='bootstrap'||p.role==='admin'||(!publish&&p.role==='reviewer'))?p:null;
}
export async function passwordHash(password:string,salt:string,iterations=100000){
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);
 return hex(await crypto.subtle.deriveBits({name:'PBKDF2',salt:new TextEncoder().encode(salt),iterations,hash:'SHA-256'},key,256));
}
export async function limited(db:D1Database,bucket:string,max:number,seconds:number){
 const now=new Date(),expires=new Date(now.getTime()+seconds*1000).toISOString();
 const result=await db.prepare('INSERT INTO auth_limits(bucket,count,expires_at) VALUES(?,1,?) ON CONFLICT(bucket) DO UPDATE SET count=CASE WHEN expires_at<? THEN 1 ELSE count+1 END,expires_at=CASE WHEN expires_at<? THEN excluded.expires_at ELSE expires_at END RETURNING count').bind(bucket,expires,now.toISOString(),now.toISOString()).first<{count:number}>();
 return !!result&&result.count<=max;
}
export async function audit(env:Env,actor:string,action:string,target:string){await env.DB.prepare('INSERT INTO operations_audit(id,actor,action,target,created_at) VALUES(?,?,?,?,?)').bind(crypto.randomUUID(),actor,action,target,new Date().toISOString()).run();}
export async function readJson(request:Request){
 const reader=request.body?.getReader();if(!reader)throw new Error('JSON body required');let size=0,text='';const decoder=new TextDecoder();
 while(true){const r=await reader.read();if(r.done)break;size+=r.value.length;if(size>65536){await reader.cancel();throw new Error('Request too large');}text+=decoder.decode(r.value,{stream:true});}text+=decoder.decode();return JSON.parse(text);
}
