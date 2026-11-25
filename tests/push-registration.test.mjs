import test from 'node:test';
import assert from 'node:assert/strict';
import {preparePushRegistration} from '../public/push-registration.js';
const asset=async()=>new Response('// service worker',{headers:{'Content-Type':'application/javascript'}});
const active={active:{state:'activated'},pushManager:{}};
test('uses the requested registration and bypasses cached worker script',async()=>{
 const container={register:async(path,options)=>{assert.equal(path,'/push-sw.js');assert.deepEqual(options,{scope:'/admin',updateViaCache:'none'});return active;}};
 assert.equal(await preparePushRegistration(container,{fetcher:asset}),active);
});
test('retries a transient AbortError without changing scope or keys',async()=>{
 let calls=0;const container={register:async()=>{if(++calls===1)throw new DOMException('aborted','AbortError');return active;}};
 assert.equal(await preparePushRegistration(container,{fetcher:asset,retryDelay:0}),active);assert.equal(calls,2);
});
test('detects wrong script response before attempting registration',async()=>{
 await assert.rejects(preparePushRegistration({register:()=>assert.fail('unexpected registration')},{fetcher:async()=>new Response('<html>',{headers:{'Content-Type':'text/html'}})}),/script unavailable/);
});
test('reports persistent registration failures and installation failure',async()=>{
 await assert.rejects(preparePushRegistration({register:async()=>{throw new DOMException('aborted','AbortError');}},{fetcher:asset,retryDelay:0}),/AbortError/);
 await assert.rejects(preparePushRegistration({register:async()=>({active:null})},{fetcher:asset}),/installation failed/);
});
