import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,verify} from 'node:crypto';
import {loadVapid,vapidAuthorization,validEndpoint,sendPush,deviceId,notifyContact,pushAdmin} from '../src/web-push.js';
const {privateKey,publicKey}=generateKeyPairSync('ec',{namedCurve:'prime256v1'});
const env={PUSH_VAPID_JWK:JSON.stringify(privateKey.export({format:'jwk'}))};
const endpoint='https://fcm.googleapis.com/fcm/send/example';
test('VAPID JWT has correct origin, expiration, uncompressed key and verified ES256 signature',async()=>{
 const c=await loadVapid(env),now=1700000000000;
 const a=await vapidAuthorization(c,endpoint,now),m=/^vapid t=([^,]+), k=(.+)$/.exec(a);
 const [h,p,s]=m[1].split('.');const claims=JSON.parse(Buffer.from(p,'base64url'));
 assert.deepEqual(claims,{aud:'https://fcm.googleapis.com',exp:1700003600,sub:'https://maher2004.dev'});
 assert.equal(JSON.parse(Buffer.from(h,'base64url')).alg,'ES256');assert.equal(Buffer.from(m[2],'base64url').length,65);
 assert.equal(verify('sha256',Buffer.from(h+'.'+p),{key:publicKey,dsaEncoding:'ieee-p1363'},Buffer.from(s,'base64url')),true);
});
test('restrict endpoints to HTTPS push providers, prevent SSRF and redirects',async()=>{
 for(const u of [endpoint,'https://updates.push.services.mozilla.com/wpush/v2/test','https://web.push.apple.com/test','https://region.push.apple.com/test','https://x.notify.windows.com/test'])assert.equal(validEndpoint(u),true,u);
 for(const u of ['http://fcm.googleapis.com/test','https://fcm.googleapis.com.evil.test/a','https://web.push.apple.com.evil.test/a','https://evilpush.apple.com/a','https://127.0.0.1/a','https://fcm.googleapis.com:8080/a','https://user@fcm.googleapis.com/a','https://fcm.googleapis.com/a#x'])assert.equal(validEndpoint(u),false,u);
 const c=await loadVapid(env);const r=await sendPush(c,endpoint,async(url,opts)=>{assert.equal(url,endpoint);assert.equal(opts.redirect,'error');assert.equal(opts.body,undefined);assert.equal(opts.headers.TTL,'3600');return new Response(null,{status:410});});assert.deepEqual(r,{status:410,accepted:false,expired:true});
});
test('device id is stable and does not expose the endpoint',async()=>{assert.match(await deviceId(endpoint),/^[a-f0-9]{64}$/);assert.equal(await deviceId(endpoint),await deviceId(endpoint));assert.notEqual(await deviceId(endpoint),await deviceId(endpoint+'x'));});
test('unconfigured feature does not touch database',async()=>{await notifyContact({});const result=await pushAdmin(new Request('https://maher2004.dev/api/admin/push'),{},'/api/admin/push');assert.deepEqual(await result.json(),{configured:false,devices:[]});});

test('D1-compatible SQL registers five devices, updates existing, and removes expired ones',async(t)=>{
 let DatabaseSync;try{({DatabaseSync}=await import('node:sqlite'));}catch(e){if(e.code==='ERR_UNKNOWN_BUILTIN_MODULE'||e.code==='ERR_MODULE_NOT_FOUND'){t.skip('Node 22+ SQLite required for integration test');return;}throw e;}const sqlite=new DatabaseSync(':memory:');
 const db={prepare(sql){let args=[];return {bind(...v){args=v;return this;},async run(){sqlite.prepare(sql).run(...args);},async first(){return sqlite.prepare(sql).get(...args)||null;},async all(){return {results:sqlite.prepare(sql).all(...args)};}};}};
 const e={...env,DB:db};const c=await loadVapid(e);const req=(path,method='GET')=>new Request('https://maher2004.dev'+path,{method});
 const base='/api/admin/push',register=async(n,label='Phone')=>pushAdmin(req(base+'/subscribe','POST'),e,base+'/subscribe',async()=>({endpoint:endpoint+n,publicKey:c.publicKey,label}));
 for(let n=0;n<5;n++)assert.equal((await register(n)).status,201);
 assert.equal((await register(5)).status,409);assert.equal((await register(0,'Renamed')).status,201);
 const state=await (await pushAdmin(req(base),e,base)).json();assert.equal(state.devices.length,5);assert.equal(state.devices.find(d=>d.label==='Renamed')?.id,await deviceId(endpoint+'0'));assert.equal('endpoint' in state.devices[0],false);
 const original=globalThis.fetch;try{globalThis.fetch=async()=>new Response(null,{status:410});await notifyContact(e);}finally{globalThis.fetch=original;}
 assert.equal((await (await pushAdmin(req(base),e,base)).json()).devices.length,0);sqlite.close();
});
