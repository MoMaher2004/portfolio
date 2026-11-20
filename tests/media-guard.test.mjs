import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { findMediaReferences } from '../src/media-usage.js';
import { defaults } from '../src/defaults.js';
import worker from '../src/index.js';

const A = '12345678-1234-4234-8234-123456789abc';
const B = '12345678-1234-4234-8234-123456789abd';
const mediaUrl = '/media/' + A;
const makeState = () => structuredClone(defaults);

test('media usage scanner finds published and draft projects, covers, gallery, home, certs, settings, custom items',()=>{
  const s=makeState();
  s.projects=[
    {id:'project-one',title:'Smart Hospital',published:true,coverMediaId:A,mediaIds:[A]},
    {id:'draft-project',title:'Draft',published:false,mediaIds:[A]}
  ];
  s.hero.portrait=mediaUrl;
  s.brand.logo='https://maher2004.dev'+mediaUrl+'?v=1';
  s.certificates=[{id:'nvidia',title:'NVIDIA',image:mediaUrl}];
  s.customSections=[{id:'custom-1',title:'Awards',items:[{id:'item-1',title:'Achievement',image:mediaUrl}]}];
  s.settings.cvs=[{id:'cv-1',title:'Backend CV',mediaId:A}];
  s.media=[{id:A,src:mediaUrl,alt:'An image'}, {id:B,src:'/media/'+B}];
  const refs=findMediaReferences(s,A);
  assert.ok(refs.some(x=>x.kind==='project'&&x.id==='project-one'&&x.usage==='Project cover'));
  assert.ok(refs.some(x=>x.kind==='project'&&x.id==='project-one'&&x.usage==='Project gallery'));
  assert.ok(refs.some(x=>x.kind==='project'&&x.id==='draft-project'));
  for(const kind of ['hero','brand','certificate','customItem','settings']) assert.ok(refs.some(x=>x.kind===kind),kind);
  assert.equal(findMediaReferences(s,B).length,0,'The media library entry alone is not a use');
});

test('scanner does not mistake partial UUID or normal text for a media reference',()=>{
 const s=makeState();
 s.hero.portrait=mediaUrl+'-extra';
 s.hero.about='This unrelated text contains '+A;
 s.projects=[{id:'example',title:'Example',mediaIds:[],summary:'We used '+A}];
 assert.deepEqual(findMediaReferences(s,A),[]);
});

function mockEnv({used=true}={}){
 const deletions=[];const sqls=[];let batchCount=0;
 const project={id:'smart-hospital',title:'Smart Hospital',published:false,mediaIds:used?[A]:[]};
 const rows=[{collection:'projects',id:project.id,content:JSON.stringify(project)},{collection:'media',id:A,content:JSON.stringify({id:A,src:mediaUrl})}];
 const env={ADMIN_TOKEN:'test-token',ALLOWED_ORIGINS:'',FILES:{delete:async key=>{deletions.push(key)}},DB:{
   prepare(sql){sqls.push(sql);return {
     bind(...params){this.params=params;return this},
     first:async()=>sql.includes('SELECT object_key')?{object_key:'media/'+A+'.png'}:null,
     all:async()=>({results:sql.includes('SELECT collection,id,content')?rows:[]}),
     run:async()=>({success:true})
   }},
   batch:async stmts=>{batchCount++;return stmts.map(()=>({success:true}))}
 }};
 return {env,deletions,sqls,get batchCount(){return batchCount}};
}
const req=(path,method='GET',auth=true)=>new Request('https://maher2004.dev'+path,{method,headers:auth?{Authorization:'Bearer test-token'}:{}});
const ctx={waitUntil(){}};

test('preflight is protected and reports exact project usage',async()=>{
 const {env}=mockEnv();
 const unauthorized=await worker.fetch(req('/api/admin/files/'+A+'/references','GET',false),env,ctx);
 assert.equal(unauthorized.status,401);
 const res=await worker.fetch(req('/api/admin/files/'+A+'/references'),env,ctx);
 assert.equal(res.status,200);
 const body=await res.json();assert.equal(body.used,true);assert.equal(body.references[0].id,'smart-hospital');
});

test('server blocks deletion with 409 and leaves R2 untouched even if caller skips preflight',async()=>{
 const mock=mockEnv({used:true});
 const res=await worker.fetch(req('/api/admin/files/'+A,'DELETE'),mock.env,ctx);
 assert.equal(res.status,409);
 const body=await res.json();assert.equal(body.used,true);
 assert.ok(body.references.some(x=>x.title==='Smart Hospital'));
 assert.equal(mock.deletions.length,0);
 assert.equal(mock.batchCount,0);
});

test('unused file deletes from R2 plus both D1 tables, and old references stay out',async()=>{
 const mock=mockEnv({used:false});
 const check=await worker.fetch(req('/api/admin/files/'+A+'/references'),mock.env,ctx);
 assert.equal((await check.json()).used,false);
 const res=await worker.fetch(req('/api/admin/files/'+A,'DELETE'),mock.env,ctx);
 assert.equal(res.status,200);assert.equal(mock.deletions[0],'media/'+A+'.png');
 assert.equal(mock.batchCount,1);
 assert.ok(mock.sqls.some(sql=>sql.includes('DELETE FROM media_files')));
 assert.ok(mock.sqls.some(sql=>sql.includes('DELETE FROM content_items')));
});

test('dashboard has dependency dialog, clickable jump, and no auto-removal of project references',()=>{
 const js=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
 for(const fragment of ["+'/references'",'mediaDeleteDialog','goto-media-usage','mediaDeleteBusy','ui.mediaDeleteWarning'])assert.ok(js.includes(fragment),fragment);
 assert.ok(!js.includes('db.projects.forEach(p=>p.mediaIds=(p.mediaIds||[]).filter(x=>x!==id))'));
});
