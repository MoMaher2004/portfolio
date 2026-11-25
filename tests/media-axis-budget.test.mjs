import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {geometry, axisScales, videoBudget, MAX_UPLOAD} from '../public/media-transform.js';
test('independent width and height use the same geometry for both media types',()=>{
 const g=geometry(1200,800,{left:10,right:10,scaleX:50,scaleY:75});
 assert.deepEqual(g,{x:120,y:0,w:960,h:800,outWidth:480,outHeight:600});
 assert.deepEqual(geometry(1200,800,{left:10,right:10,...axisScales(960,800,480,600)},true),g);
 assert.equal(geometry(641,479,{scaleX:null,scaleY:null},true).outWidth,640);
});
test('default dimensions are preserved when safe; large video is bounded',()=>{
 assert.deepEqual(geometry(1000,750,{scaleX:null,scaleY:null}),{x:0,y:0,w:1000,h:750,outWidth:1000,outHeight:750});
 const g=geometry(3840,2160,{scaleX:null,scaleY:null},true);assert.equal(g.outWidth,1920);assert.equal(g.outHeight,1080);
 assert.throws(()=>geometry(640,480,{scaleX:0,scaleY:100}),/Scale/);
 assert.throws(()=>geometry(640,480,{scaleX:NaN,scaleY:100}),/Scale/);
});
test('quality-first automatic bitrate protects screen detail without exceeding upload budget',()=>{
 const b=videoBudget(10*1048576,20,{autoBitrate:true,audio:true,audioBitrate:96,fps:24},{outWidth:1920,outHeight:1080});
 assert.ok(b.videoKbps>=7000);assert.ok(b.estimatedBytes>10*1048576);assert.ok(b.estimatedBytes<=MAX_UPLOAD*.92);
 assert.throws(()=>videoBudget(10*1048576,600,{autoBitrate:true,audio:true,audioBitrate:96,fps:24},{outWidth:1920,outHeight:1080}),/readable conversion/);
});
test('manual bitrate remains explicit',()=>{
 const b=videoBudget(10*1048576,600,{autoBitrate:false,bitrate:1500,audio:true,audioBitrate:96});assert.equal(b.videoKbps,1500);assert.ok(b.estimatedBytes>MAX_UPLOAD);
});
test('encoder uses calculated bitrate and axis editor uses shared geometry',()=>{
 const studio=readFileSync(new URL('../public/media-studio.js',import.meta.url),'utf8');
 const editor=readFileSync(new URL('../public/media-editor-controls.js',import.meta.url),'utf8');
 assert.match(studio,/videoBitsPerSecond:budget\.videoKbps\*1000/);
 assert.match(studio,/audioBitsPerSecond:budget\.audioKbps\*1000/);
 assert.doesNotMatch(studio,/o\.autoBitrate&&blob\.size>=file\.size/);assert.match(studio,/track\.contentHint='detail'/);assert.match(studio,/await indexWebM\(blob,/);
 assert.match(editor,/\['e','s','se'\]/);assert.match(editor,/axisScales\(g\.w,g\.h/);
 assert.doesNotMatch(studio,/number\('Maximum side/);
});
