import test from 'node:test';
import assert from 'node:assert/strict';
import {pushResultText,enrollmentState} from '../public/push-settings.js';
test('remote test messages distinguish transport, provider, expiry and accepted delivery',()=>{
 assert.match(pushResultText({status:0,reason:'network_error'}),/no HTTP response/);
 assert.match(pushResultText({status:0,reason:'timeout'}),/timeout/);
 assert.match(pushResultText({status:0,reason:'signing_failed'}),/sign/);
 assert.match(pushResultText({status:403,reason:'provider_rejected'}),/HTTP 403/);
 assert.match(pushResultText({status:410,expired:true}),/removed/);
 assert.match(pushResultText({status:201,accepted:true}),/accepted.*Check/);
});


test('registration stays visible when browser permission is blocked or unavailable',()=>{
 const config={configured:true};
 assert.deepEqual(enrollmentState(config,true,'denied',false).show,true);
 assert.equal(enrollmentState(config,true,'denied',false).disabled,false);
 assert.match(enrollmentState(config,true,'denied',false).message,/blocked/);
 assert.equal(enrollmentState(config,false,'unavailable',false).show,true);
 assert.equal(enrollmentState(config,false,'unavailable',false).disabled,true);
 assert.equal(enrollmentState(config,true,'granted',false).show,true);
 assert.equal(enrollmentState(config,true,'granted',true).show,false);
 assert.equal(enrollmentState(config,true,'default',false).disabled,false);
});
test('redirect rejection is explicit',()=>assert.match(pushResultText({status:302,reason:'redirect_rejected'}),/not followed/));
