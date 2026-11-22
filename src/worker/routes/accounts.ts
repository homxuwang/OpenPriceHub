import type { Env } from '../../shared/types';
import { successResponse,errorResponse } from '../utils/response';
import { administrator,principal,sameOrigin,nonce,digest,passwordHash,limited,readJson,audit } from '../services/auth';
import { validateWebsiteDraft } from '../../shared/websiteSubmission';
export async function handleAccounts(request:Request,env:Env,base:Record<string,string>,fetcher:typeof fetch=fetch){
 const headers={...base,'Cache-Control':'no-store'},path=new URL(request.url).pathname.slice('/api/accounts'.length);
 try{
  if(!sameOrigin(request,env))return errorResponse('Origin not allowed',403,headers);
  if(path==='/me'&&request.method==='GET')return successResponse({user:await principal(request,env)},undefined,headers);
  if((path==='/register'||path==='/login')&&request.method==='POST'){
   const x=await readJson(request),email=String(x.email||'').trim().toLowerCase(),password=x.password;
   if(!/^\S+@\S+\.\S+$/.test(email)||email.length>254||typeof password!=='string'||password.length<12||password.length>128)return errorResponse('Valid email and 12–128 character password required',400,headers);
   if(new URL(request.url).protocol!=='https:'&&!['localhost','127.0.0.1'].includes(new URL(request.url).hostname)&&env.ALLOW_HTTP_AUTH!=='true')return errorResponse('HTTPS required for account authentication',400,headers);
   const ip=await digest(request.headers.get('CF-Connecting-IP')||'local');
   if(!await limited(env.DB,`${path}:${ip}`,path==='/register'?3:10,900))return errorResponse('Too many attempts; retry later',429,headers);
   if(path==='/register'){
    const salt=nonce();try{await env.DB.prepare('INSERT INTO users(id,email,password_hash,salt,iterations,role,created_at) VALUES(?,?,?,?,?,?,?)').bind(crypto.randomUUID(),email,await passwordHash(password,salt),salt,100000,'developer',new Date().toISOString()).run();}catch{return errorResponse('Account cannot be created',409,headers);}
    return successResponse({registered:true,emailVerified:false},'Account created; verify domain ownership before self-service updates.',headers);
   }
   const row=await env.DB.prepare('SELECT * FROM users WHERE email=? AND disabled=0').bind(email).first<{id:string;role:string;password_hash:string;salt:string;iterations:number}>();
   const check=await passwordHash(password,row?.salt||'dummy-salt',row?.iterations||100000);
   if(!row||await digest(check)!==await digest(row.password_hash))return errorResponse('Invalid credentials',401,headers);
   const token=nonce(),now=new Date(),expires=new Date(now.getTime()+12*3600000).toISOString();
   await env.DB.prepare('INSERT INTO auth_sessions(token_hash,user_id,expires_at,created_at) VALUES(?,?,?,?)').bind(await digest(token),row.id,expires,now.toISOString()).run();
   const secure=new URL(request.url).protocol==='https:';
   return successResponse({user:{id:row.id,role:row.role}},undefined,{...headers,'Set-Cookie':`oph_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200${secure?'; Secure':''}`});
  }
  if(path==='/logout'&&request.method==='POST'){
   const token=request.headers.get('Cookie')?.match(/(?:^|;\s*)oph_session=([a-f0-9]{64})/)?.[1];
   if(token)await env.DB.prepare('DELETE FROM auth_sessions WHERE token_hash=?').bind(await digest(token)).run();
   return successResponse({},undefined,{...headers,'Set-Cookie':'oph_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0; Secure'});
  }
  const user=await principal(request,env);if(!user)return errorResponse('Sign in required',401,headers);
  if(path.startsWith('/admin/')){
   if(!await administrator(request,env))return errorResponse('Administrator required',403,headers);
   if(path==='/admin/users'&&request.method==='GET')return successResponse({users:(await env.DB.prepare('SELECT id,email,role,disabled,created_at FROM users ORDER BY created_at DESC LIMIT 200').all()).results},undefined,headers);
   if(path==='/admin/users'&&request.method==='POST'){
    const x=await readJson(request);if(!['admin','reviewer','developer'].includes(x.role)||typeof x.email!=='string'||!/^\S+@\S+\.\S+$/.test(x.email)||x.email.length>254||typeof x.password!=='string'||x.password.length<12||x.password.length>128)return errorResponse('Invalid account',400,headers);
    const salt=nonce(),id=crypto.randomUUID();await env.DB.prepare('INSERT INTO users(id,email,password_hash,salt,iterations,role,created_at) VALUES(?,?,?,?,?,?,?)').bind(id,x.email.trim().toLowerCase(),await passwordHash(x.password,salt),salt,100000,x.role,new Date().toISOString()).run();await audit(env,user.id,'create-user',id);return successResponse({id},undefined,headers);
   }
   if(path==='/admin/disable'&&request.method==='POST'){
    const x=await readJson(request);if(x.id===user.id)return errorResponse('Cannot disable current account',400,headers);
    await env.DB.batch([env.DB.prepare('UPDATE users SET disabled=1 WHERE id=?').bind(x.id),env.DB.prepare('DELETE FROM auth_sessions WHERE user_id=?').bind(x.id)]);await audit(env,user.id,'disable-user',String(x.id));return successResponse({},undefined,headers);
   }
   if(path==='/admin/assign'&&request.method==='POST'){
    const x=await readJson(request),u=await env.DB.prepare('SELECT id FROM users WHERE id=? AND disabled=0').bind(x.userId).first();if(!u)return errorResponse('User not found',404,headers);
    await env.DB.prepare('UPDATE website_submissions SET owner_user_id=? WHERE id=?').bind(x.userId,x.submissionId).run();await audit(env,user.id,'assign-submission',String(x.submissionId));return successResponse({},undefined,headers);
   }
   return errorResponse('Not found',404,headers);
  }
  if(path==='/password'&&request.method==='POST'){
   const x=await readJson(request);if(typeof x.currentPassword!=='string'||typeof x.newPassword!=='string'||x.newPassword.length<12||x.newPassword.length>128)return errorResponse('Invalid password',400,headers);
   if(!await limited(env.DB,'password:'+user.id,5,900))return errorResponse('Too many password attempts',429,headers);
   const row=await env.DB.prepare('SELECT password_hash,salt,iterations FROM users WHERE id=?').bind(user.id).first<{password_hash:string;salt:string;iterations:number}>();
   if(!row||await digest(await passwordHash(x.currentPassword,row.salt,row.iterations))!==await digest(row.password_hash))return errorResponse('Invalid credentials',401,headers);
   const salt=nonce();await env.DB.batch([env.DB.prepare('UPDATE users SET password_hash=?,salt=? WHERE id=?').bind(await passwordHash(x.newPassword,salt),salt,user.id),env.DB.prepare('DELETE FROM auth_sessions WHERE user_id=?').bind(user.id)]);return successResponse({signInRequired:true},'Password changed; sign in again',headers);
  }
  if(path==='/domains'&&request.method==='GET')return successResponse({domains:(await env.DB.prepare('SELECT hostname,token,expires_at,verified_at FROM domain_claims WHERE user_id=?').bind(user.id).all()).results},undefined,headers);
  if(path==='/domains'&&request.method==='POST'){
   if(!await limited(env.DB,'domain-create:'+user.id,10,3600))return errorResponse('Too many domain challenges',429,headers);
   const x=await readJson(request),hostname=String(x.hostname||'').toLowerCase();
   if(!/^(?=.{1,253}$)[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$/.test(hostname)||hostname.endsWith('.local')||hostname.endsWith('.localhost'))return errorResponse('Public hostname required',400,headers);
   const token='openpricehub='+nonce(),expires=new Date(Date.now()+86400000).toISOString();
   await env.DB.prepare('INSERT INTO domain_claims(id,user_id,hostname,token,expires_at) VALUES(?,?,?,?,?) ON CONFLICT(user_id,hostname) DO UPDATE SET token=excluded.token,expires_at=excluded.expires_at,verified_at=NULL').bind(crypto.randomUUID(),user.id,hostname,token,expires).run();
   return successResponse({name:`_openpricehub.${hostname}`,type:'TXT',value:token,expiresAt:expires},undefined,headers);
  }
  if(path==='/domains/verify'&&request.method==='POST'){
   const x=await readJson(request),row=await env.DB.prepare('SELECT hostname,token FROM domain_claims WHERE user_id=? AND hostname=? AND expires_at>?').bind(user.id,x.hostname,new Date().toISOString()).first<{hostname:string;token:string}>();
   if(!row)return errorResponse('Challenge missing or expired',400,headers);
   if(!await limited(env.DB,'dns:'+user.id,10,3600))return errorResponse('Too many DNS checks',429,headers);
   const response=await fetcher(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent('_openpricehub.'+row.hostname)}&type=TXT`,{headers:{Accept:'application/dns-json'},signal:AbortSignal.timeout(10000),redirect:'manual'});
   if(!response.ok)throw Error('DNS unavailable');const data=await response.json() as {Status:number;Answer?:{type:number;data:string}[]};
   if(data.Status!==0||!data.Answer?.some(a=>a.type===16&&a.data.replace(/"\s*"/g,'').replace(/^"|"$/g,'')===row.token))return errorResponse('TXT record not found; wait for DNS propagation',409,headers);
   const now=new Date().toISOString();await env.DB.prepare('UPDATE domain_claims SET verified_at=?,expires_at=? WHERE user_id=? AND hostname=? AND token=?').bind(now,new Date(Date.now()+30*86400000).toISOString(),user.id,row.hostname,row.token).run();return successResponse({verified:true},undefined,headers);
  }
  if(path==='/submissions'&&request.method==='GET')return successResponse({submissions:(await env.DB.prepare('SELECT id,draft_json,status,version,admin_notes,updated_at FROM website_submissions WHERE owner_user_id=? ORDER BY updated_at DESC LIMIT 100').bind(user.id).all()).results},undefined,headers);
  const edit=path.match(/^\/submissions\/([a-zA-Z0-9-]+)$/);
  if(edit&&request.method==='PUT'){
   const x=await readJson(request),row=await env.DB.prepare('SELECT id,version FROM website_submissions WHERE id=? AND owner_user_id=?').bind(edit[1],user.id).first<{id:string;version:number}>();
   if(!row)return errorResponse('Submission not found',404,headers);if(row.version!==x.version)return errorResponse('Reload changed submission',409,headers);
   const draft=validateWebsiteDraft(x.draft),host=new URL(draft.website).hostname;
   const claim=await env.DB.prepare('SELECT id FROM domain_claims WHERE user_id=? AND hostname=? AND verified_at IS NOT NULL AND expires_at>?').bind(user.id,host,new Date().toISOString()).first();
   if(!claim)return errorResponse('Verify the exact website hostname first',403,headers);
   const now=new Date().toISOString();await env.DB.batch([
    env.DB.prepare('INSERT INTO website_review_logs(id,submission_id,base_version,action,actor,notes,snapshot_json,created_at) VALUES(?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),row.id,row.version,'save',user.id,'Developer resubmission; public price unchanged',JSON.stringify(draft),now),
    env.DB.prepare("UPDATE website_submissions SET draft_json=?,status='pending',version=version+1,updated_at=? WHERE id=?").bind(JSON.stringify(draft),now,row.id)
   ]);return successResponse({pending:true},'Resubmitted; administrator approval is required',headers);
  }
  return errorResponse('Not found',404,headers);
 }catch(e){void e;console.error('Account operation failed');return errorResponse('Account operation unavailable or invalid request',400,headers);}
}
