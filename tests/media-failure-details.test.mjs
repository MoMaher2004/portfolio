import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {failureMessage} from '../public/media-studio.js';

test('video and upload failures retain browser error names and HTTP status',()=>{
 assert.equal(failureMessage(new DOMException('Cannot encode','NotSupportedError')),'NotSupportedError: Cannot encode');
 assert.equal(failureMessage(Object.assign(Error('File too large'),{status:413})),'HTTP 413: File too large');
 assert.equal(failureMessage('Encoder unavailable'),'Encoder unavailable');
 assert.match(failureMessage(undefined),/No error details/);
});
test('failure reporting distinguishes conversion from upload and remains visible',()=>{
 const js=readFileSync(new URL('../public/media-studio.js',import.meta.url),'utf8');
 assert.match(js,/phase==='uploading'\?'Upload \/ save'/);
 assert.match(js,/role:'alert'/);
 assert.match(js,/console\.error\('\[Media Studio\] File failed'/);
 assert.match(js,/errors\.scrollIntoView\(\{block:'start'\}\)/);
 assert.match(js,/stage='MediaRecorder initialization'/);
});
