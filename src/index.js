import { readSite, seedOnce, putState, arrays, configs, listCollection, replaceCollection, getItem, upsertItem, deleteItem } from './data.js';
import { renderHtml, renderAdmin } from './render.js';
import { findMediaReferences } from './media-usage.js';

const json = (value,status=200,extra={})=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...extra}});
const error=(message,status=400)=>json({error:message},status);
const csrfFreeHeader='Authorization';
const MAX_UPLOAD=90*1024*1024;
const responseHeaders={
 'X-Content-Type-Options':'nosniff', 'X-Frame-Options':'DENY',
 'Referrer-Policy':'strict-origin-when-cross-origin',
 'Permissions-Policy':'camera=(),microphone=(),geolocation=()',
 'Content-Security-Policy':"default-src 'self'; base-uri 'self'; frame-ancestors 'none'; object-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; media-src 'self' blob: https:; connect-src 'self'; form-action 'self'; upgrade-insecure-requests"
};
function addHeaders(res,extra={}){
 const headers=new Headers(res.headers);for(const [k,v] of Object.entries(responseHeaders)) headers.set(k,v);
 // PDFs can be previewed inside our own Admin media modal, never by third-party sites.
 if(headers.get('Content-Type')?.startsWith('application/pdf') && headers.get('Content-Disposition')==='inline'){
   headers.set('X-Frame-Options','SAMEORIGIN');
   headers.set('Content-Security-Policy',"frame-ancestors 'self'; default-src 'none'");
 }
 for(const [k,v] of Object.entries(extra))headers.set(k,v);
 return new Response(res.body,{status:res.status,statusText:res.statusText,headers});
}
const cleanText=(val,n=1000)=>String(val??'').trim().slice(0,n);
const safeId=s=>/^[-_a-zA-Z0-9]{1,120}$/.test(s||'');
const utcDay=(d)=>d.toISOString().slice(0,10);
function origins(env){return String(env.ALLOWED_ORIGINS||'').split(',').map(x=>x.trim()).filter(Boolean)}
function cors(req,env){const origin=req.headers.get('Origin');if(!origin)return {};if(!origins(env).includes(origin))return {};return {'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'GET,POST,PUT,PATCH,DELETE,OPTIONS','Access-Control-Allow-Headers':'Authorization,Content-Type','Access-Control-Max-Age':'86400','Vary':'Origin'}}
function isOriginAllowed(req,env){const origin=req.headers.get('Origin');return !origin||origin===new URL(req.url).origin||origins(env).includes(origin)}
async function digest(str){return new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(str)))}
async function secureCompare(a,b){const [x,y]=await Promise.all([digest(a),digest(b)]);let diff=0;for(let i=0;i<x.length;i++)diff|=x[i]^y[i];return diff===0}
async function ipHash(req){return Array.from(await digest(req.headers.get('CF-Connecting-IP')||'127.0.0.1')).slice(0,16).map(x=>x.toString(16).padStart(2,'0')).join('')}
async function throttle(env,table,key,limit,seconds,increment){
 const now=Math.floor(Date.now()/1000);const old=await env.DB.prepare(`SELECT ${table==='auth_attempts'?'failures':'hits'} AS n,window_start FROM ${table} WHERE ip_hash=?`).bind(key).first();
 if(old&& now-old.window_start<seconds && old.n>=limit)return true;
 if(increment){
  await env.DB.prepare(`INSERT INTO ${table}(ip_hash,${table==='auth_attempts'?'failures':'hits'},window_start) VALUES(?,1,?) ON CONFLICT(ip_hash) DO UPDATE SET ${table==='auth_attempts'?'failures':'hits'}=CASE WHEN ?-window_start>? THEN 1 ELSE ${table==='auth_attempts'?'failures':'hits'}+1 END,window_start=CASE WHEN ?-window_start>? THEN ? ELSE window_start END`).bind(key,now,now,seconds,now,seconds,now).run();
 }
 return false;
}
async function authorized(req,env){const header=req.headers.get(csrfFreeHeader)||'';const got=header.startsWith('Bearer ')?header.slice(7):'';if(!env.ADMIN_TOKEN||!got||got.length>256)return false;return secureCompare(got,env.ADMIN_TOKEN)}
async function readBody(req,max=950000){const size=Number(req.headers.get('Content-Length')||'0');if(size>max)throw new Error('Body too large');const text=await req.text();if(text.length>max)throw new Error('Body too large');return JSON.parse(text)}
async function visit(req,env,ctx,path){
 if(req.headers.get('Purpose')==='prefetch'||req.headers.get('Sec-Purpose')==='prefetch')return;
 const cf=req.cf||{};const country=String(cf.country||'XX').slice(0,2);const now=new Date();
 const key=path; // Full page path. Legacy grouped values remain in the database.
 ctx.waitUntil(env.DB.prepare('INSERT INTO visit_hours(date,hour,country,path,views) VALUES(?,?,?,?,1) ON CONFLICT(date,hour,country,path) DO UPDATE SET views=views+1').bind(utcDay(now),now.getUTCHours(),country,key).run().catch(()=>{}));
}
function mediaMime(type){return ['image/png','image/jpeg','image/webp','image/gif','image/avif','video/mp4','video/webm','application/pdf','application/json','text/plain'].includes(type)}
async function upload(req,env,name,forcedId){
 if(!req.body)return error('Missing file body');
 const type=(req.headers.get('Content-Type')||'').split(';')[0].trim().toLowerCase();
 if(!mediaMime(type))return error('Unsupported MIME type (images, MP4/WebM, PDF and JSON supported)',415);
 // R2.put requires a stream with a known length. Passing a request body through
 // TransformStream strips that length and fails on Workers, even for small files.
 // File and Blob uploads from modern browsers set Content-Length automatically.
 const rawSize=req.headers.get('Content-Length')||'';
 if(!/^\d+$/.test(rawSize))return error('Content-Length required for R2 stream upload',411);
 const length=Number(rawSize);
 if(!Number.isSafeInteger(length)||length<1)return error('Empty or invalid upload length');
 if(length>MAX_UPLOAD)return error('File exceeds 90 MiB limit',413);
 const id=forcedId||crypto.randomUUID();
 const ext={'image/png':'png','image/jpeg':'jpg','image/webp':'webp','image/gif':'gif','image/avif':'avif','video/mp4':'mp4','video/webm':'webm','application/pdf':'pdf','application/json':'json','text/plain':'txt'}[type];
 const key=`media/${id}.${ext}`;
 await env.FILES.put(key,req.body,{httpMetadata:{contentType:type,cacheControl:'public, max-age=31536000, immutable'}});
 const title=cleanText(name||`${id}.${ext}`,180);
 try{
   await env.DB.prepare('INSERT INTO media_files(id,object_key,name,mime_type,bytes) VALUES(?,?,?,?,?)').bind(id,key,title,type,length).run();
 }catch(e){
   await env.FILES.delete(key).catch(()=>{});throw e;
 }
 const item={id,name:title,type,src:`/media/${id}`,bytes:length};
 return json(item,201);
}

async function cloudflareAnalytics(env){
 if(!env.CF_ANALYTICS_TOKEN||!env.CLOUDFLARE_ZONE_ID) return {configured:false,message:'Set CF_ANALYTICS_TOKEN secret and CLOUDFLARE_ZONE_ID to enable Cloudflare GraphQL metrics.'};
 const begin=utcDay(new Date(Date.now()-29*864e5)),end=utcDay(new Date());
 const query=`query($zone: String!, $start: Date!, $end: Date!) { viewer { zones(filter: { zoneTag: $zone }) { httpRequests1dGroups(limit: 31, filter: { date_geq: $start, date_leq: $end }) { dimensions { date } sum { requests bytes } } } } }`;
 const resp=await fetch('https://api.cloudflare.com/client/v4/graphql',{method:'POST',headers:{Authorization:`Bearer ${env.CF_ANALYTICS_TOKEN}`,'Content-Type':'application/json'},body:JSON.stringify({query,variables:{zone:env.CLOUDFLARE_ZONE_ID,start:begin,end}})});
 const result=await resp.json();if(!resp.ok||result.errors?.length)return {configured:true,error:result.errors?.[0]?.message||`HTTP ${resp.status}`};
 return {configured:true,source:'Cloudflare zone HTTP request analytics (includes non-portfolio HTTP traffic)',days:result.data?.viewer?.zones?.[0]?.httpRequests1dGroups||[]};
}
async function analytics(env,days=30){
 const daysAllowed=[7,30,90].includes(Number(days))?Number(days):30;
 const earliest=new Date();earliest.setUTCHours(0,0,0,0);earliest.setUTCDate(earliest.getUTCDate()-(daysAllowed-1));
 const start=utcDay(earliest);
 const [byDay,byCountry,byHour,topPaths]=await Promise.all([
  env.DB.prepare('SELECT date,SUM(views) AS views FROM visit_hours WHERE date>=? GROUP BY date ORDER BY date ASC').bind(start).all(),
  env.DB.prepare('SELECT country,SUM(views) AS views FROM visit_hours WHERE date>=? GROUP BY country ORDER BY views DESC LIMIT 30').bind(start).all(),
  env.DB.prepare('SELECT hour,SUM(views) AS views FROM visit_hours WHERE date>=? GROUP BY hour ORDER BY hour').bind(start).all(),
  env.DB.prepare('SELECT path,SUM(views) AS views FROM visit_hours WHERE date>=? GROUP BY path ORDER BY views DESC LIMIT 30').bind(start).all()
 ]);
 return {source:'D1 pageviews (not unique visitors; UTC; may include bots)',periodDays:daysAllowed,startDate:start,
 byDay:byDay.results,byCountry:byCountry.results,byHour:byHour.results,topPaths:topPaths.results,
 total:(byDay.results||[]).reduce((n,r)=>n+Number(r.views||0),0)};
}
async function robots(req){const host=new URL(req.url).origin;return new Response(`User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\nSitemap: ${host}/sitemap.xml\n`,{headers:{'Content-Type':'text/plain; charset=utf-8'}})}
async function sitemap(req,env){
 const s=await readSite(env),host=new URL(req.url).origin;
 const rows=await env.DB.prepare("SELECT collection,id,updated_at FROM content_items WHERE collection IN ('projects','views')").all();
 const changes=new Map((rows.results||[]).map(r=>[r.collection+':'+r.id,r.updated_at]));
 const homeChange=await env.DB.prepare("SELECT MAX(updated_at) AS latest FROM configuration").first();
 const dates=[homeChange?.latest,...(rows.results||[]).filter(r=>r.collection==='projects'&&s.projects.some(p=>p.id===r.id)).map(r=>r.updated_at)].filter(Boolean);
 const xmlEscape=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
 const validDate=x=>/^\d{4}-\d{2}-\d{2}/.test(String(x||''))?String(x).slice(0,10):null;
 const urls=[{path:'/',changed:dates.sort().at(-1)},
  ...s.projects.map(p=>({path:'/projects/'+encodeURIComponent(p.id),changed:changes.get('projects:'+p.id)})),
  ...s.views.map(v=>({path:'/focus/'+encodeURIComponent(v.slug),changed:changes.get('views:'+v.id)}))];
 const items=urls.flatMap(u=>{
   const project=s.projects.find(p=>u.path==='/projects/'+encodeURIComponent(p.id));
   const languages=['en'];
   if(s.hero?.introAr&&(!project||(project.titleAr&&project.summaryAr)))languages.push('ar');
   if(s.settings.enableEs&&s.hero?.introEs&&(!project||(project.titleEs&&project.summaryEs)))languages.push('es');
   return languages.map(lang=>{
   const href=host+u.path+(lang==='en'?'':(u.path.includes('?')?'&':'?')+'lang='+lang);
   const lastmod=validDate(u.changed);
   return `<url><loc>${xmlEscape(href)}</loc>${lastmod?`<lastmod>${lastmod}</lastmod>`:''}</url>`;
   });
 });
 return new Response('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+items.join('')+'</urlset>',{headers:{'Content-Type':'application/xml; charset=utf-8','Cache-Control':'no-cache'}});
}
async function main(req,env,ctx){
 const url=new URL(req.url), path=url.pathname;
 if(req.method==='OPTIONS') return isOriginAllowed(req,env)?new Response(null,{status:204,headers:cors(req,env)}):error('Origin not allowed',403);
 if(path.startsWith('/api/')&&!isOriginAllowed(req,env))return error('Origin not allowed',403);
 if(path.startsWith('/api/admin/')){
   const key=await ipHash(req);
   if(await throttle(env,'auth_attempts',key,12,900,false))return error('Too many failed authorization attempts',429);
   if(!await authorized(req,env)){
     await throttle(env,'auth_attempts',key,12,900,true);
     return error('Unauthorized',401);
   }
   await env.DB.prepare('DELETE FROM auth_attempts WHERE ip_hash=?').bind(key).run();
   if(path==='/api/admin/verify'&&req.method==='POST')return json({ok:true});
   if(path==='/api/admin/seed'&&req.method==='POST')return json({created:await seedOnce(env)});
   if(path==='/api/admin/state'&&req.method==='GET')return json(await readSite(env,{admin:true}));
   if(path==='/api/admin/state'&&req.method==='PUT') {await putState(env,await readBody(req));return json({ok:true})}
   if(path==='/api/admin/analytics'&&req.method==='GET')return json(await analytics(env,url.searchParams.get('days')||30));
   if(path==='/api/admin/analytics/cloudflare'&&req.method==='GET')return json(await cloudflareAnalytics(env));
   if(path==='/api/admin/files'&&req.method==='POST')return upload(req,env,url.searchParams.get('name'));
   if(path==='/api/admin/cv'&&req.method==='PUT'){
     if(req.headers.get('Content-Type')!=='application/pdf')return error('Only PDF accepted',415);
     const uploaded=await upload(req,env,'resume.pdf');if(uploaded.status!==201)return uploaded;
     const result=await uploaded.json();
     const s=await readSite(env,{admin:true});s.settings.cvUrl=result.src;await putState(env,s);return json(result,201);
   }
   if(path==='/api/admin/messages'&&req.method==='GET')return json((await readSite(env,{admin:true})).messages);
   if(/^\/api\/admin\/messages\/[-a-zA-Z0-9_]+$/.test(path)){
     const id=path.split('/').at(-1);if(req.method==='PATCH') {const body=await readBody(req,2048);await env.DB.prepare('UPDATE messages SET is_read=? WHERE id=?').bind(body.read?1:0,id).run();return json({ok:true})}
     if(req.method==='DELETE'){await env.DB.prepare('DELETE FROM messages WHERE id=?').bind(id).run();return json({ok:true})}
   }
   const mediaPath=path.match(/^\/api\/admin\/files\/([0-9a-f-]{36})(?:\/references)?$/i);
   if(mediaPath && (req.method==='DELETE' || req.method==='GET' && path.endsWith('/references'))) {
     const id=mediaPath[1];
     const item=await env.DB.prepare('SELECT object_key FROM media_files WHERE id=?').bind(id).first();
     if(!item)return error('File not found',404);
     // Always re-read D1 immediately before deleting. A UI-only check is bypassable.
     const references=findMediaReferences(await readSite(env,{admin:true}),id);
     if(req.method==='GET')return json({id,used:references.length>0,references});
     if(references.length)return json({error:'File is still used. Remove every reference before deleting.',used:true,references},409);
     await env.FILES.delete(item.object_key);
     // The media library is backed by TWO D1 tables; remove both records.
     await env.DB.batch([
       env.DB.prepare('DELETE FROM media_files WHERE id=?').bind(id),
       env.DB.prepare('DELETE FROM content_items WHERE collection=? AND id=?').bind('media',id)
     ]);
     return json({ok:true,id});
   }
   const match=path.match(/^\/api\/admin\/collections\/([a-zA-Z]+)(?:\/([-_a-zA-Z0-9]+))?$/);
   if(match){const [,collection,id]=match;if(!arrays.includes(collection))return error('Unknown collection',404);
     if(req.method==='GET')return json(id?await getItem(env,collection,id):await listCollection(env,collection));
     if(req.method==='PUT'&&!id){await replaceCollection(env,collection,await readBody(req));return json({ok:true})}
     if(['PUT','POST'].includes(req.method)&&id){const item=await readBody(req);if(item.id!==id)return error('Item ID mismatch');return json(await upsertItem(env,collection,item))}
     if(req.method==='DELETE'&&id){await deleteItem(env,collection,id);return json({ok:true})}
   }
   return error('Not found',404);
 }
 if(path==='/api/site-data'&&req.method==='GET')return json(await readSite(env));
 if(path==='/api/contact'&&req.method==='POST'){
   const key=await ipHash(req);if(await throttle(env,'contact_limits',key,5,3600,true))return error('Too many messages, try later',429);
   const body=await readBody(req,8000);if(body.website)return json({ok:true});
   const name=cleanText(body.name,100),email=cleanText(body.email,200),message=cleanText(body.message,3000);
   if(name.length<2||!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)||message.length<8)return error('Valid name, email and message are required');
   await env.DB.prepare('INSERT INTO messages(id,name,email,message) VALUES(?,?,?,?)').bind(crypto.randomUUID(),name,email,message).run();return json({ok:true},201);
 }
 if(/^\/media\/[0-9a-f-]{36}$/.test(path)&&req.method==='GET'){
   const id=path.slice('/media/'.length),row=await env.DB.prepare('SELECT object_key,mime_type FROM media_files WHERE id=?').bind(id).first();if(!row)return error('Not found',404);
   const hasRange=req.headers.has('Range');
   const file=await env.FILES.get(row.object_key,hasRange?{range:req.headers}:{});if(!file)return error('Not found',404);
   const headers={'Content-Type':row.mime_type,'Cache-Control':row.mime_type==='application/pdf'?'public, max-age=3600':'public, max-age=31536000, immutable','Accept-Ranges':'bytes'};
   if(row.mime_type==='application/pdf')headers['Content-Disposition']='inline';
   const r=file.range;
   if(hasRange&&r&&typeof r.offset==='number'&&typeof r.length==='number'){
     headers['Content-Range']=`bytes ${r.offset}-${r.offset+r.length-1}/${file.size}`;
     headers['Content-Length']=String(r.length);
     return new Response(file.body,{status:206,headers});
   }
   return new Response(file.body,{headers});
 }
 if(/^\/cv\/[-_a-zA-Z0-9]{1,120}$/.test(path)&&req.method==='GET'){
   const id=path.split('/').at(-1);
   const site=await readSite(env);
   const cv=(site.settings.cvs||[]).find(x=>x.id===id);
   if(!cv)return error('CV not found',404);
   const row=await env.DB.prepare('SELECT object_key,mime_type FROM media_files WHERE id=?').bind(cv.mediaId).first();
   if(!row||row.mime_type!=='application/pdf')return error('CV not found',404);
   const file=await env.FILES.get(row.object_key);if(!file)return error('CV not found',404);
   const name=(cv.title||'CV').replace(/[^-a-zA-Z0-9_ ]/g,'').trim().replace(/ +/g,'-').slice(0,80)||'CV';
   return new Response(file.body,{headers:{'Content-Type':'application/pdf','Content-Disposition':`attachment; filename="${name}.pdf"`,'Cache-Control':'no-store'}});
 }
 if(path==='/cv'&&req.method==='GET'){
   const s=await readSite(env),url=s.settings.cvUrl||'';const id=url.split('/').at(-1);if(!/^[0-9a-f-]{36}$/.test(id||''))return error('CV has not been uploaded yet',404);
   const row=await env.DB.prepare('SELECT object_key,mime_type FROM media_files WHERE id=?').bind(id).first();if(!row||row.mime_type!=='application/pdf')return error('CV not found',404);
   const file=await env.FILES.get(row.object_key);if(!file)return error('CV not found',404);
   return new Response(file.body,{headers:{'Content-Type':'application/pdf','Content-Disposition':'attachment; filename="Mohamed-Maher-CV.pdf"','Cache-Control':'no-store'}});
 }
 if(path==='/robots.txt'&&req.method==='GET')return robots(req);
 if(path==='/sitemap.xml'&&req.method==='GET')return sitemap(req,env);
 if(path==='/admin'&&req.method==='GET')return new Response(renderAdmin(),{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Robots-Tag':'noindex,nofollow'}});
 const match=path.match(/^\/projects\/([-a-z0-9]+)\/?$/),focus=path.match(/^\/focus\/([-a-z0-9]+)\/?$/);
 if(req.method==='GET'&&(path==='/'||match||focus)){
   const site=await readSite(env),r=match?{name:'project',id:match[1]}:focus?{name:'focus',slug:focus[1]}:{name:'home'};
   if(focus&&!site.views.some(v=>v.slug===focus[1]&&v.active))return error('Not found',404);
   const html=renderHtml(site,req.url,r);if(!html)return error('Not found',404);
   await visit(req,env,ctx,path);
   return new Response(html,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}});
 }
 if(req.method==='GET'||req.method==='HEAD')return env.ASSETS.fetch(req);
 return error('Not found',404);
}
export default {async fetch(req,env,ctx){
 let response;
 try{response=await main(req,env,ctx)}catch(e){console.error('Request failed:',e?.stack||e);response=error(e instanceof SyntaxError?'Invalid JSON':(e?.message?.startsWith('Invalid')||e?.message?.startsWith('Duplicate')||e?.message?.startsWith('Too many')||e?.message?.startsWith('Use R2')?'Invalid request: '+e.message:'Internal server error'),e?.message?.startsWith('Invalid')||e?.message?.startsWith('Duplicate')||e?.message?.startsWith('Too many')||e?.message?.startsWith('Use R2')||e instanceof SyntaxError?400:500)}
 return addHeaders(response,cors(req,env));
}};
