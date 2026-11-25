import test from 'node:test';
import assert from 'node:assert/strict';
import {pushResultText} from '../public/push-settings.js';
test('remote test messages distinguish transport, provider, expiry and accepted delivery',()=>{
 assert.match(pushResultText({status:0,reason:'network_error'}),/no HTTP response/);
 assert.match(pushResultText({status:0,reason:'timeout'}),/timeout/);
 assert.match(pushResultText({status:0,reason:'signing_failed'}),/sign/);
 assert.match(pushResultText({status:403,reason:'provider_rejected'}),/HTTP 403/);
 assert.match(pushResultText({status:410,expired:true}),/removed/);
 assert.match(pushResultText({status:201,accepted:true}),/accepted.*Check/);
});
