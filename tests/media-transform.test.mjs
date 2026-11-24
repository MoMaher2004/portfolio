import test from 'node:test';
import assert from 'node:assert/strict';
import {geometry,defaults,mediaKind,mediaType,checkUpload,validateOptions,MAX_UPLOAD,outputName,VIDEO_FORMATS} from '../public/media-transform.js';
test('crop and fit without stretching or enlargement',()=>{
 assert.deepEqual(geometry(4000,2000,{left:10,right:10,top:0,bottom:0,maxSide:1600}),{x:400,y:0,w:3200,h:2000,outWidth:1600,outHeight:1000});
 assert.equal(geometry(80,40,{maxSide:1920}).outWidth,80);
});
test('video output uses even dimensions and rejects empty crop',()=>{
 const g=geometry(1921,1081,{maxSide:1280},true);assert.equal(g.outWidth%2,0);assert.equal(g.outHeight%2,0);
 assert.throws(()=>geometry(200,100,{left:70,right:30}),/non-empty/);
});
test('size limits and output MIME allowlist',()=>{
 assert.throws(()=>geometry(9000,9000,{maxSide:0}),/too large/);
 assert.throws(()=>checkUpload({name:'big.png',type:'image/png',size:MAX_UPLOAD+1}),/90 MiB/);
 assert.throws(()=>checkUpload({name:'x.svg',type:'image/svg+xml',size:10}),/not supported/);
 assert.equal(checkUpload(new File(['x'],'picture.jpg',{type:'image/jpeg'})).type,'image/jpeg');
 assert.throws(()=>checkUpload(new File(['x'],'picture.avif',{type:'image/avif'}),['image/png']),/not supported/);
});
test('defaults preserve animated GIF and use lightweight image/video settings',()=>{
 const caps={images:['image/webp','image/jpeg'],videos:VIDEO_FORMATS};
 assert.equal(defaults({name:'photo.png',type:'image/png'},caps).format,'image/webp');
 assert.equal(defaults({name:'anim.gif',type:'image/gif'},caps).format,'original');
 const video=defaults({name:'clip.mov',type:'video/quicktime'},caps);assert.equal(video.scaleX,null);assert.equal(video.scaleY,null);assert.equal(video.autoBitrate,true);assert.equal(video.fps,24);assert.equal(video.format,VIDEO_FORMATS[0].mime);
 assert.equal(defaults({name:'clip.mov',type:'video/quicktime'},{images:[],videos:[]}).format,'original');
});
test('file detection and validated encoding controls',()=>{
 assert.equal(mediaType({name:'sample.MOV',type:''}),'video/quicktime');assert.equal(mediaKind({name:'clip.MKV',type:''}),'video');assert.equal(outputName('my clip.mov','webm'),'my clip.webm');
 assert.throws(()=>validateOptions({format:'image/webp',quality:200},'image'),/Invalid image/);
 assert.throws(()=>validateOptions({format:VIDEO_FORMATS[0].mime,bitrate:5,fps:24,audioBitrate:96},'video'),/Invalid video/);
});
