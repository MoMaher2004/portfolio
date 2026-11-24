import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {namedOutput,outputExtension} from '../public/media-editor-controls.js';
const source=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const studio=source('../public/media-studio.js');
const app=source('../public/app.js');
const css=source('../public/app.css');
const prefix={value:''};
const nameFn=studio.match(/function rowName\(row\)\{[^\n]+\}/)[0];
const rowName=Function('namedOutput','outputExtension','prefix',nameFn+';return rowName')(namedOutput,outputExtension,prefix);
const row=(base,format='image/webp')=>({base,file:{name:base+'.png'},o:{format}});
test('live prefix applies to a single file and to every batch item without an Apply click',()=>{
 const rows=[row('first'),row('second','image/jpeg')];
 prefix.value='hospital-';assert.equal(rowName(rows[0]),'hospital-first.webp');assert.deepEqual(rows.map(rowName),['hospital-first.webp','hospital-second.jpg']);
 prefix.value='new-';rows[0].base='renamed';assert.deepEqual(rows.map(rowName),['new-renamed.webp','new-second.jpg']);
 prefix.value='';assert.equal(rowName(rows[0]),'renamed.webp');
});
test('prefix preview refreshes live and upload uses validated final names',()=>{
 assert.match(studio,/prefix.addEventListener\('input'/);assert.match(studio,/finalName.textContent=displayName\(rows\[selected\]\)/);
 assert.match(studio,/uploadNames=rows.map\(row=>\{validateOptions\(row.o,row.kind\);return rowName\(row\);\}\)/);
 assert.match(studio,/new File\(\[prepared\],uploadNames\[i\]/);assert.match(studio,/await upload\(renamed\)/);
});
test('one disclosure menu per media card, with type-appropriate actions',()=>{
 const start=app.indexOf('function mediaActions(m){'),end=app.indexOf('// Only one media menu',start);
 const render=Function('esc',app.slice(start,end)+';return mediaActions')(x=>String(x).replaceAll('"','&quot;'));
 const html=render({id:'test',name:'Photo',type:'image/webp'});
 assert.equal((html.match(/<summary/g)||[]).length,1);assert.match(html,/⋮/);
 for(const action of ['preview-media','edit-media-alt','rename-media','reedit-media','delete-media'])assert.match(html,new RegExp('data-action="'+action+'"'));
 const pdf=render({id:'doc',name:'Document',type:'application/pdf'});assert.doesNotMatch(pdf,/edit-media-alt|reedit-media/);
 assert.match(app,/\$\{mediaActions\(m\)\}/);assert.match(css,/media-item:has\(\.media-actions\[open\]\)/);
});
test('portrait uploads send the chosen filename instead of the fixed default',()=>{
 assert.match(app,/api\('\/api\/admin\/portrait\?name='\+encodeURIComponent\(file.name\)/);
 assert.match(source('../src/index.js'),/upload\(req,env,url.searchParams.get\('name'\)\|\|'portrait'\)/);
});
