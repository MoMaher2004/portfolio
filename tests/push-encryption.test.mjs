import test from 'node:test';
import assert from 'node:assert/strict';
import {createECDH,createDecipheriv,hkdfSync,randomBytes,generateKeyPairSync} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {encryptPush,validatePushKeys,contactPushPayload} from '../src/push-encryption.js';
import {sendPush,loadVapid,pushAdmin,notifyContact,deviceId} from '../src/web-push.js';
const recipient=()=>{const ecdh=createECDH('prime256v1');ecdh.generateKeys();const auth=randomBytes(16);return {ecdh,auth,keys:{p256dh:ecdh.getPublicKey().toString('base64url'),auth:auth.toString('base64url')}};};
// Independent Node crypto receiver, not the WebCrypto encryption implementation.
function decrypt(body,receiver){
 const b=Buffer.from(body),salt=b.subarray(0,16),keylen=b[20],sender=b.subarray(21,21+keylen),cipher=b.subarray(21+keylen);
 assert.equal(keylen,65);assert.equal(b.readUInt32BE(16),4096);
 const shared=receiver.ecdh.computeSecret(sender),info=Buffer.concat([Buffer.from('WebPush: info\0'),receiver.ecdh.getPublicKey(),sender]);
 const ikm=hkdfSync('sha256',shared,receiver.auth,info,32);
 const cek=hkdfSync('sha256',ikm,salt,Buffer.from('Content-Encoding: aes128gcm\0'),16);
 const nonce=hkdfSync('sha256',ikm,salt,Buffer.from('Content-Encoding: nonce\0'),12);
 const decipher=createDecipheriv('aes-128-gcm',Buffer.from(cek),Buffer.from(nonce));decipher.setAuthTag(cipher.subarray(-16));
 const decoded=Buffer.concat([decipher.update(cipher.subarray(0,-16)),decipher.final()]);assert.equal(decoded.at(-1),2);
 return JSON.parse(decoded.subarray(0,-1).toString());
}
test('encrypted RFC 8291 payload round trips through independent receiver and cannot decrypt with another device',async()=>{
 const a=recipient(),payload=contactPushPayload('أحمد','مرحبا 👋');const one=await encryptPush(payload,a.keys),two=await encryptPush(payload,a.keys);
 assert.deepEqual(decrypt(one,a),payload);assert.deepEqual(decrypt(two,a),payload);assert.notDeepEqual(one,two);assert.throws(()=>decrypt(one,recipient()));assert.equal(Buffer.from(one).includes(Buffer.from('مرحبا')),false);
 const tampered=Buffer.from(one);tampered[tampered.length-1]^=1;assert.throws(()=>decrypt(tampered,a));
});
test('unicode previews limit to 100 code points including ellipsis and normalize whitespace',()=>{
 const p=contactPushPayload('  أحمد\n','😀'.repeat(120));assert.equal(p.title,'New message from أحمد');assert.equal(Array.from(p.body).length,100);assert.ok(p.body.endsWith('…'));assert.equal(contactPushPayload('A','short\n text').body,'short text');
});
test('reject malformed or invalid curve encryption keys',async()=>{
 const a=recipient();await validatePushKeys(a.keys);await assert.rejects(validatePushKeys({...a.keys,auth:'bad'}));await assert.rejects(validatePushKeys({...a.keys,p256dh:Buffer.concat([Buffer.from([4]),Buffer.alloc(64)]).toString('base64url')}));
});
const env={PUSH_VAPID_JWK:JSON.stringify(generateKeyPairSync('ec',{namedCurve:'prime256v1'}).privateKey.export({format:'jwk'}))};
const endpoint='https://fcm.googleapis.com/fcm/send/example';
test('transport sends encrypted bytes with aes128gcm encoding, legacy is empty',async()=>{
 const a=recipient(),c=await loadVapid(env),payload=contactPushPayload('Alice','Hello');
 const result=await sendPush(c,endpoint,async(u,o)=>{assert.equal(o.redirect,'manual');assert.equal(o.headers['Content-Encoding'],'aes128gcm');assert.deepEqual(decrypt(o.body,a),payload);return new Response(null,{status:201});},{payload,keys:a.keys});assert.equal(result.accepted,true);
 await sendPush(c,endpoint,async(u,o)=>{assert.equal(o.body.length,0);assert.equal(o.headers['Content-Encoding'],undefined);return new Response(null,{status:201});});
});
test('legacy registration upgrades in place, keys not returned, contact sends encrypted and generic alerts, deletes keys',async(t)=>{
 let DatabaseSync;try{({DatabaseSync}=await import('node:sqlite'));}catch{t.skip('Node 22+ required');return;}
 const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');
 const db={prepare(query){let args=[];return {bind(...a){args=a;return this;},async first(){return sql.prepare(query).get(...args)||null;},async all(){return {results:sql.prepare(query).all(...args)};},async run(){return sql.prepare(query).run(...args);},exec(){return {results:sql.prepare(query).all(...args)};}};},async batch(stmts){sql.exec('BEGIN');try{const r=stmts.map(s=>s.exec());sql.exec('COMMIT');return r;}catch(e){sql.exec('ROLLBACK');throw e;}}};
 const e={...env,DB:db},c=await loadVapid(e),a=recipient(),base='/api/admin/push';
 const api=(path=base,method='GET',body)=>pushAdmin(new Request('https://maher2004.dev'+path,{method}),e,path,async()=>body);
 const sub=(url,keys)=>api(base+'/subscribe','POST',{endpoint:url,publicKey:c.publicKey,label:'Phone',...(keys?{keys}: {})});
 assert.equal((await sub(endpoint)).status,201);assert.equal((await sub(endpoint+'2')).status,201);
 assert.equal((await sub(endpoint,{...a.keys,auth:'bad'})).status,400);
 assert.equal((await sub(endpoint,a.keys)).status,201);assert.equal((await sub(endpoint)).status,201); // old browser can't erase encryption
 const state=await (await api()).json();assert.equal(state.devices.length,2);const id=await deviceId(endpoint);assert.equal(state.devices.find(d=>d.id===id).preview,true);assert.equal(state.devices.find(d=>d.id!==id).preview,false);assert.equal(JSON.stringify(state).includes(a.keys.auth),false);
 const original=globalThis.fetch;const seen=[];try{globalThis.fetch=async(u,o)=>{seen.push(u);if(u===endpoint){assert.deepEqual(decrypt(o.body,a),contactPushPayload('Alice','Hello'));}else{assert.equal(o.body.length,0);}return new Response(null,{status:201});};await notifyContact(e,{name:'Alice',message:'Hello'});assert.equal(seen.length,2);
 globalThis.fetch=async(u,o)=>{assert.equal(decrypt(o.body,a).title,'New message from Test sender');return new Response(null,{status:201});};assert.equal((await (await api(base+'/devices/'+id+'/test','POST')).json()).accepted,true);
 }finally{globalThis.fetch=original;}
 assert.equal((await api(base+'/devices/'+id,'DELETE')).status,200);assert.equal(sql.prepare('SELECT count(*) n FROM push_device_keys').get().n,0);sql.close();
});
test('service worker displays encrypted preview after browser decrypts and handles old empty pushes',async()=>{
 const listeners={},shown=[];const self={location:{origin:'https://maher2004.dev'},addEventListener:(name,cb)=>listeners[name]=cb,registration:{showNotification:(...args)=>{shown.push(args);return Promise.resolve();}}};
 vm.runInNewContext(await readFile(new URL('../public/push-sw.js',import.meta.url),'utf8'),{self,URL});
 let promise;const emit=async(data)=>{listeners.push({data,waitUntil:p=>promise=p});await promise;};
 await emit({json:()=>contactPushPayload('Alice','Hello')});assert.equal(shown[0][0],'New message from Alice');assert.equal(shown[0][1].body,'Hello');assert.equal(shown[0][1].data.url,'/admin?tab=inbox');await emit(null);assert.equal(shown[1][0],'Portfolio inbox');await emit({json(){throw Error('bad')}});assert.equal(shown[2][0],'Portfolio inbox');
});
