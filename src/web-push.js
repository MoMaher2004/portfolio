// Web Push with optional end-to-end encrypted previews; legacy subscriptions get generic alerts.
import {encryptPush,validatePushKeys,contactPushPayload} from './push-encryption.js';
const enc = new TextEncoder();
const MAX_DEVICES = 5;
const b64 = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const unb64 = value => Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
const json64 = value => b64(enc.encode(JSON.stringify(value)));
export function validEndpoint(value){
 if(typeof value!=='string'||value.length>2048)return false;
 try{
  const u=new URL(value),h=u.hostname;
  const trusted=h==='fcm.googleapis.com'||h==='updates.push.services.mozilla.com'||h.endsWith('.push.apple.com')||h.endsWith('.notify.windows.com');
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
 )`).run();
 // Separate table avoids ALTER TABLE races and preserves existing subscriptions.
 await db.prepare(`CREATE TABLE IF NOT EXISTS push_device_keys (
 id TEXT PRIMARY KEY REFERENCES push_devices(id) ON DELETE CASCADE,
 vapid_key TEXT NOT NULL, p256dh TEXT NOT NULL, auth TEXT NOT NULL
 )`).run();
}
const response=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
const fail=(error,status=400)=>response({error},status);
const pushFailure=reason=>({status:0,accepted:false,expired:false,reason});
export async function sendPush(config,endpoint,fetcher=(...args)=>globalThis.fetch(...args),preview=null){
 if(!validEndpoint(endpoint))return pushFailure('invalid_endpoint');
 let auth;try{auth=await vapidAuthorization(config,endpoint);}catch{return pushFailure('signing_failed');}
 let body=new Uint8Array(0);const headers={Authorization:auth,TTL:'3600',Urgency:'normal'};
 if(preview){
  try{body=await encryptPush(preview.payload,preview.keys);headers['Content-Encoding']='aes128gcm';headers['Content-Type']='application/octet-stream';}
  catch{return pushFailure('encryption_failed');}
 }
 const controller=new AbortController();let timedOut=false;
 const timer=setTimeout(()=>{timedOut=true;controller.abort();},8000);
 try{
  // Workers supports manual redirects, not redirect:error. Never forward VAPID credentials.
  // Legacy subscriptions receive a zero-length POST; previews are encrypted per device.
  const res=await fetcher(endpoint,{method:'POST',redirect:'manual',headers,body,signal:controller.signal});
  const result={status:res.status,accepted:res.ok,expired:res.status===404||res.status===410};
  if(res.status>=300&&res.status<400)result.reason='redirect_rejected';
  else if(!res.ok&&!result.expired)result.reason='provider_rejected';
  // A cleanup failure must not erase a real HTTP response.
  try{await res.body?.cancel();}catch{}
  return result;
 }catch(e){
  const reason=timedOut?'timeout':'network_error';
  // Do not log the endpoint, request, token, exception message or stack.
  console.warn('Web push transport failure',reason,new URL(endpoint).hostname,e?.name||'Error');
  return pushFailure(reason);
 }finally{clearTimeout(timer);}
}
async function sendDevice(db,config,row,payload){
 if(row.public_key!==config.publicKey)return pushFailure('key_mismatch');
 const preview=payload&&row.p256dh&&row.auth?{payload,keys:{p256dh:row.p256dh,auth:row.auth}}:null;
 const result=await sendPush(config,row.endpoint,undefined,preview);
 if(result.expired){try{await db.prepare('DELETE FROM push_devices WHERE id=? AND public_key=?').bind(row.id,config.publicKey).run();}catch{console.warn('Could not remove expired web push subscription');}}
 return result;
}
// Call only after the contact message transaction commits. Never block or fail the contact request.
export async function notifyContact(env,contact){
 if(!env.PUSH_VAPID_JWK)return;
 const config=await loadVapid(env);await ensure(env.DB);
 const {results=[]}=await env.DB.prepare('SELECT d.id,d.endpoint,d.public_key,k.p256dh,k.auth FROM push_devices d LEFT JOIN push_device_keys k ON k.id=d.id AND k.vapid_key=d.public_key WHERE d.public_key=? LIMIT 5').bind(config.publicKey).all();
 const payload=contact?contactPushPayload(contact.name,contact.message):null;
 const sent=await Promise.all(results.map(row=>sendDevice(env.DB,config,row,payload)));
 if(sent.some(x=>!x.accepted&&!x.expired))console.warn('One or more web push requests were not accepted');
}
// The caller must already have validated the admin bearer token.
export async function pushAdmin(req,env,path,readBody){
 let config;try{config=await loadVapid(env)}catch{return fail('Invalid server VAPID configuration',503);}
 if(path==='/api/admin/push'&&req.method==='GET'){
  if(!config)return response({configured:false,devices:[]});
  await ensure(env.DB);
  const {results=[]}=await env.DB.prepare('SELECT d.id,d.label,d.created_at,d.public_key,CASE WHEN k.id IS NULL THEN 0 ELSE 1 END AS preview FROM push_devices d LEFT JOIN push_device_keys k ON k.id=d.id AND k.vapid_key=d.public_key ORDER BY d.created_at').all();
  return response({configured:true,publicKey:config.publicKey,devices:results.map(({public_key,preview,...row})=>({...row,active:public_key===config.publicKey,preview:Boolean(preview)}))});
 }
 if(!config)return fail('Web Push is not configured',503);
 await ensure(env.DB);
 if(path==='/api/admin/push/subscribe'&&req.method==='POST'){
  const body=await readBody(req,4096),endpoint=body?.endpoint;
  if(!validEndpoint(endpoint)||body.publicKey!==config.publicKey)return fail('Invalid push endpoint or subscription key');
  const id=await deviceId(endpoint),label=String(body.label||'Browser').trim().slice(0,80)||'Browser';
  // Existing clients may omit encryption keys; never erase previously saved keys.
  if(body.keys!==undefined){try{await validatePushKeys(body.keys);}catch{return fail('Invalid push encryption keys');}}
  // Atomically bound subscription count, including registrations made concurrently.
  const registration=env.DB.prepare(`INSERT INTO push_devices(id,endpoint,public_key,label)
   SELECT ?,?,?,? WHERE (SELECT COUNT(*) FROM push_devices)<5 OR EXISTS(SELECT 1 FROM push_devices WHERE id=?)
   ON CONFLICT(id) DO UPDATE SET public_key=excluded.public_key,label=excluded.label RETURNING id`).bind(id,endpoint,config.publicKey,label,id);
  let row;
  if(body.keys!==undefined){
   const [registered]=await env.DB.batch([registration,env.DB.prepare(`INSERT INTO push_device_keys(id,vapid_key,p256dh,auth)
    SELECT id,public_key,?,? FROM push_devices WHERE id=? AND public_key=?
    ON CONFLICT(id) DO UPDATE SET vapid_key=excluded.vapid_key,p256dh=excluded.p256dh,auth=excluded.auth`).bind(body.keys.p256dh,body.keys.auth,id,config.publicKey)]);
   row=registered.results?.[0];
  }else row=await registration.first();
  return row?response({id},201):fail(`Maximum ${MAX_DEVICES} devices; remove an old device first`,409);
 }
 const match=path.match(/^\/api\/admin\/push\/devices\/([a-f0-9]{64})(\/test)?$/);
 if(match){
  const id=match[1];
  if(!match[2]&&req.method==='DELETE'){await env.DB.prepare('DELETE FROM push_devices WHERE id=?').bind(id).run();return response({ok:true});}
  if(match[2]&&req.method==='POST'){
   const row=await env.DB.prepare('SELECT d.id,d.endpoint,d.public_key,k.p256dh,k.auth FROM push_devices d LEFT JOIN push_device_keys k ON k.id=d.id AND k.vapid_key=d.public_key WHERE d.id=?').bind(id).first();
   if(!row)return fail('Device not found',404);
   if(row.public_key!==config.publicKey)return fail('Device must be re-subscribed after key rotation',409);
   return response(await sendDevice(env.DB,config,row,contactPushPayload('Test sender','This is a sample message preview from your portfolio.')));
  }
 }
 return fail('Not found',404);
}
