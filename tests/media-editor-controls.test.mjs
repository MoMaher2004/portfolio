import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {filenameParts,namedOutput,outputExtension,draggedCrop} from '../public/media-editor-controls.js';
import {geometry} from '../public/media-transform.js';
const source=path=>readFileSync(new URL(path,import.meta.url),'utf8');
test('individual name and bulk prefix preserve the selected output extension',()=>{
 assert.deepEqual(filenameParts('my.image.png'),{base:'my.image',ext:'.png'});
 assert.equal(namedOutput('new screenshot','SHS-',outputExtension({name:'old.png'},{format:'image/webp'})),'SHS-new screenshot.webp');
 assert.equal(namedOutput('original','','.png'),'original.png');
 assert.equal(outputExtension({name:'clip.mov'},{format:'video/webm;codecs=vp8,opus'}),'.webm');
 assert.throws(()=>namedOutput('../a','','.webp'),/valid file name/);
 assert.throws(()=>namedOutput('','prefix-','.webp'),/valid file name/);
 assert.throws(()=>namedOutput('a'.repeat(180),'x','.webp'),/180 characters/);
});
test('corner drag crops source, clamps bounds and never creates an empty crop',()=>{
 const start={left:0,top:0,right:0,bottom:0};
 const crop=draggedCrop(start,'nw',15,25);assert.deepEqual(crop,{left:15,top:25,right:0,bottom:0});
 const g=geometry(1000,1000,{...crop,maxSide:400});assert.equal(g.w,850);assert.equal(g.h,750);assert.equal(g.outWidth,400);
 const extreme=draggedCrop(start,'se',-200,-200);assert.equal(extreme.right,98);assert.equal(extreme.bottom,98);
});
test('dragging crop interior preserves its size and stays within the source',()=>{
 assert.deepEqual(draggedCrop({left:20,top:20,right:20,bottom:20},'move',99,-99),{left:40,top:0,right:0,bottom:40});
});
test('pagination filters the whole library before slicing and clamps page numbers',()=>{
 const js=source('../public/app.js');const start=js.indexOf('function mediaPageSlice('),end=js.indexOf('\nfunction mediaLibraryResults',start);
 const page=Function(js.slice(start,end)+';return mediaPageSlice')();const items=Array.from({length:60},(_,i)=>({name:'photo-'+i,type:i%2?'image/webp':'video/mp4'}));
 assert.equal(page(items,'',1,24).items.length,24);assert.equal(page(items,'',99,24).items.length,12);
 assert.equal(page(items,'webp',2,24).count,30);assert.equal(page(items,'webp',2,24).items.length,6);
 assert.equal(page(items,'notfound',5,24).page,1);
});
test('rename metadata is authenticated and edit copy uses new upload, never overwrites R2 object',()=>{
 const js=source('../public/app.js'),server=source('../src/index.js');
 assert.match(js,/api\('\/api\/admin\/files\/'\+encodeURIComponent\(id\),\{method:'PATCH'/);
 assert.match(server,/UPDATE media_files SET name=\?/);assert.match(server,/UPDATE content_items SET content=json_set\(content,'\$\.name',\?\)/);
 const copy=js.slice(js.indexOf('async function reeditMedia('),js.indexOf('let libraryUploadInProgress=false;'));
 assert.match(copy,/await uploadPreparedMedia\(prepared\)/);assert.doesNotMatch(copy,/method:'DELETE'|method:'PUT'/);
 assert.match(copy,/db\.media\.unshift\(item\)/);
});
