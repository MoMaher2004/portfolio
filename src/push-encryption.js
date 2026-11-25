// RFC 8291 / RFC 8188 single-record aes128gcm Web Push encryption.
const enc=new TextEncoder();
const concat=(...parts)=>{const out=new Uint8Array(parts.reduce((n,p)=>n+p.length,0));let offset=0;for(const p of parts){out.set(p,offset);offset+=p.length;}return out;};
const b64=bytes=>btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
function decode(value,length){
 if(typeof value!=='string'||! /^[A-Za-z0-9_-]+$/.test(value)||value.length!==Math.ceil(length*8/6))throw Error('Invalid push encryption key');
 const bytes=Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
 if(bytes.length!==length||b64(bytes)!==value)throw Error('Invalid push encryption key');
 return bytes;
}
export async function validatePushKeys(keys){
 const p256dh=decode(keys?.p256dh,65),auth=decode(keys?.auth,16);
 if(p256dh[0]!==4)throw Error('Invalid push encryption key');
 const receiver=await crypto.subtle.importKey('raw',p256dh,{name:'ECDH',namedCurve:'P-256'},false,[]);
 return {p256dh,auth,receiver};
}
async function hkdf(ikm,salt,info,bytes){
 const key=await crypto.subtle.importKey('raw',ikm,'HKDF',false,['deriveBits']);
 return new Uint8Array(await crypto.subtle.deriveBits({name:'HKDF',hash:'SHA-256',salt,info},key,bytes*8));
}
export async function encryptPush(payload,keys){
 const plaintext=enc.encode(JSON.stringify(payload));
 if(plaintext.length>3993)throw Error('Push payload too large');
 const {p256dh,auth,receiver}=await validatePushKeys(keys);
 // Fresh ephemeral key and salt for every recipient and message.
 const sender=await crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveBits']);
 const senderPublic=new Uint8Array(await crypto.subtle.exportKey('raw',sender.publicKey));
 const shared=new Uint8Array(await crypto.subtle.deriveBits({name:'ECDH',public:receiver},sender.privateKey,256));
 const ikm=await hkdf(shared,auth,concat(enc.encode('WebPush: info\0'),p256dh,senderPublic),32);
 const salt=crypto.getRandomValues(new Uint8Array(16));
 const cek=await hkdf(ikm,salt,enc.encode('Content-Encoding: aes128gcm\0'),16);
 const nonce=await hkdf(ikm,salt,enc.encode('Content-Encoding: nonce\0'),12);
 const key=await crypto.subtle.importKey('raw',cek,'AES-GCM',false,['encrypt']);
 const ciphertext=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv:nonce,tagLength:128},key,concat(plaintext,Uint8Array.of(2))));
 const header=new Uint8Array(21);header.set(salt);new DataView(header.buffer).setUint32(16,4096);header[20]=senderPublic.length;
 return concat(header,senderPublic,ciphertext);
}
// Count Unicode code points, not UTF-16 units; the ellipsis is included in the limit.
function preview(value,max){
 const chars=Array.from(String(value??'').replace(/\s+/gu,' ').trim());
 return chars.length>max?chars.slice(0,max-1).join('')+'…':chars.join('');
}
export function contactPushPayload(name,message){
 return {title:'New message from '+(preview(name,100)||'a visitor'),body:preview(message,100)||'Tap to check your inbox.'};
}
