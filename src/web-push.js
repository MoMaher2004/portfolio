// Payload-free Web Push (RFC 8030 / RFC 8292). No visitor data leaves D1.
const enc = new TextEncoder();
const MAX_DEVICES = 5;
const b64 = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const unb64 = value => Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
const json64 = value => b64(enc.encode(JSON.stringify(value)));
export function validEndpoint(value){
 if(typeof value!=='string'||value.length>2048)return false;
 try{
  const u=new URL(value),h=u.hostname;
  const trusted=h==='fcm.googleapis.com'||h==='updates.push.services.mozilla.com'||h==='web.push.apple.com'||h.endsWith('.notify.windows.com');
  return trusted&&u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&!u.hash&&u.pathname.length>1&&u.href===value;
 }catch{return false;}
}
export async function loadVapid(env){
 if(!env.PUSH_VAPID_JWK)return null;
 const jwk=JSON.parse(env.PUSH_VAPID_JWK);
 if(jwk.kty!=='EC'||jwk.crv!=='P-256'||![jwk.x,jwk.y,jwk.d].every(s=>typeof s==='string'&&/^[A-Za-z0-9_-]{43}$/.test(s)))throw Error('Invalid VAPID key');
 const raw=new Uint8Array(65);raw[0]=4;raw.set(unb64(jwk.x),1);raw.set(unb64(jwk.y),33);
 const key=await crypto.subtle.importKey('jwk',jwk,{name:'ECDSA',namedCurve:'P-256'},false,['sign']);
 return {key,publicKey:b64(raw),subject:'https://maher2004.dev'};
}
export async function vapidAuthorization(config,endpoint,now=Date.now()){
 if(!validEndpoint(endpoint))throw Error('Invalid push endpoint');
 const input=json64({typ:'JWT',alg:'ES256'})+'.'+json64({aud:new URL(endpoint).origin,exp:Math.floor(now/1000)+3600,sub:config.subject});
 const signature=await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},config.key,enc.encode(input));
 return `vapid t=${input}.${b64(signature)}, k=${config.publicKey}`;
}
export async function deviceId(endpoint){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(endpoint))),v=>v.toString(16).padStart(2,'0')).join('');}
async function ensure(db){await db.prepare(`CREATE TABLE IF NOT EXISTS push_devices (
 id TEXT PRIMARY KEY, endpoint TEXT NOT NULL, public_key TEXT NOT NULL,
 label TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
 )`).run();}
const response=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
const fail=(error,status=400)=>response({error},status);
export async function sendPush(config,endpoint,fetcher=fetch){
 if(!validEndpoint(endpoint))return {status:0,accepted:false,expired:false};
 const auth=await vapidAuthorization(config,endpoint);
 const res=await fetcher(endpoint,{method:'POST',redirect:'error',headers:{Authorization:auth,TTL:'3600',Urgency:'normal'},signal:AbortSignal.timeout(8000)});
 if(res.body)await res.body.cancel().catch(()=>{});
 return {status:res.status,accepted:res.ok,expired:res.status===404||res.status===410};
}
async function sendDevice(db,config,row){
 if(row.public_key!==config.publicKey)return {accepted:false,status:0,expired:false};
 try{
  const result=await sendPush(config,row.endpoint);
  if(result.expired)await db.prepare('DELETE FROM push_devices WHERE id=? AND public_key=?').bind(row.id,config.publicKey).run();
  return result;
 }catch{return {accepted:false,status:0,expired:false};}
}
// Call only after the contact message transaction commits. Never block or fail the contact request.
export async function notifyContact(env){
 if(!env.PUSH_VAPID_JWK)return;
 const config=await loadVapid(env);await ensure(env.DB);
 const {results=[]}=await env.DB.prepare('SELECT id,endpoint,public_key FROM push_devices WHERE public_key=? LIMIT 5').bind(config.publicKey).all();
 const sent=await Promise.all(results.map(row=>sendDevice(env.DB,config,row)));
 if(sent.some(x=>!x.accepted&&!x.expired))console.warn('One or more web push requests were not accepted');
}
// The caller must already have validated the admin bearer token.
export async function pushAdmin(req,env,path,readBody){
 let config;try{config=await loadVapid(env)}catch{return fail('Invalid server VAPID configuration',503);}
 if(path==='/api/admin/push'&&req.method==='GET'){
  if(!config)return response({configured:false,devices:[]});
  await ensure(env.DB);
  const {results=[]}=await env.DB.prepare('SELECT id,label,created_at,public_key FROM push_devices ORDER BY created_at').all();
  return response({configured:true,publicKey:config.publicKey,devices:results.map(({public_key,...row})=>({...row,active:public_key===config.publicKey}))});
 }
 if(!config)return fail('Web Push is not configured',503);
 await ensure(env.DB);
 if(path==='/api/admin/push/subscribe'&&req.method==='POST'){
  const body=await readBody(req,4096),endpoint=body?.endpoint;
  if(!validEndpoint(endpoint)||body.publicKey!==config.publicKey)return fail('Invalid push endpoint or subscription key');
  const id=await deviceId(endpoint),label=String(body.label||'Browser').trim().slice(0,80)||'Browser';
  // Atomically bound subscription count, including registrations made concurrently.
  const row=await env.DB.prepare(`INSERT INTO push_devices(id,endpoint,public_key,label)
   SELECT ?,?,?,? WHERE (SELECT COUNT(*) FROM push_devices)<5 OR EXISTS(SELECT 1 FROM push_devices WHERE id=?)
   ON CONFLICT(id) DO UPDATE SET public_key=excluded.public_key,label=excluded.label RETURNING id`).bind(id,endpoint,config.publicKey,label,id).first();
  return row?response({id},201):fail(`Maximum ${MAX_DEVICES} devices; remove an old device first`,409);
 }
 const match=path.match(/^\/api\/admin\/push\/devices\/([a-f0-9]{64})(\/test)?$/);
 if(match){
  const id=match[1];
  if(!match[2]&&req.method==='DELETE'){await env.DB.prepare('DELETE FROM push_devices WHERE id=?').bind(id).run();return response({ok:true});}
  if(match[2]&&req.method==='POST'){
   const row=await env.DB.prepare('SELECT id,endpoint,public_key FROM push_devices WHERE id=?').bind(id).first();
   if(!row)return fail('Device not found',404);
   if(row.public_key!==config.publicKey)return fail('Device must be re-subscribed after key rotation',409);
   return response(await sendDevice(env.DB,config,row));
  }
 }
 return fail('Not found',404);
}
