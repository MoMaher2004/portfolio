import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import worker from '../src/index.js';
import { defaults } from '../src/defaults.js';
import { renderHtml } from '../src/render.js';
import { validateState } from '../src/data.js';

const makeState=()=>structuredClone(defaults);
const publicUrl='https://maher2004.dev';

test('V8: SSR CV links are named and backward compatible',()=>{
 const s=makeState();s.settings.cvs=[{id:'backend-cv',title:'Backend Developer CV',mediaId:'12345678-1234-1234-1234-123456789012'},{id:'ai-cv',title:'AI Integration CV',mediaId:'12345678-1234-1234-1234-123456789013'}];
 const html=renderHtml(s,publicUrl+'/',{name:'home'});
 assert.match(html,/Backend Developer CV/);assert.match(html,/AI Integration CV/);
 assert.match(html,/href="\/cv\/backend-cv"/);assert.match(html,/href="\/cv\/ai-cv"/);
 const legacy=makeState();legacy.settings.cvUrl='/media/12345678-1234-1234-1234-123456789012';
 assert.match(renderHtml(legacy,publicUrl+'/',{name:'home'}),/href="\/cv"/);
});

test('V8: plain-language explanation comes before technical implementation in SSR',()=>{
 const s=makeState();s.projects=[{id:'real-project',title:'Software',summary:'Helps customers track orders',overview:'Customers use it to manage orders more easily.',problem:'Manual tracking was difficult.',solution:'One dashboard.',technicalDetails:'PostgreSQL schema, Express API and service-layer validation.',stack:['Node.js','PostgreSQL'],features:['Order history'],published:true,tracks:['Backend'],mediaIds:[],tone:'gold'}];
 const html=renderHtml(s,publicUrl+'/projects/real-project',{name:'project',id:'real-project'});
 assert.match(html,/theme-gold/);
 assert.ok(html.indexOf('Customers use it')<html.indexOf('PostgreSQL schema'));
 assert.ok(html.indexOf('The challenge')<html.indexOf('TECHNICAL DEEP DIVE'));
 assert.match(html,/Order history/);
});

test('V8: project JSON with technical fields and CV settings validates without migration',()=>{
 const s=makeState();s.projects=[{id:'project',title:'Test',tracks:['Backend','AI'],technicalDetails:'REST API',technicalDetailsAr:'واجهات برمجية',published:true}];
 s.settings.cvs=[{id:'cv-x',title:'Backend CV',mediaId:'12345678-1234-1234-1234-123456789012'}];
 assert.equal(validateState(s),s);
 s.settings.cvs.push({...s.settings.cvs[0]});assert.throws(()=>validateState(s),/Invalid CV entry/);
});

test('V8: UI has Enter-to-chip inputs, in-page media viewer and multi-CV controls',()=>{
 const js=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
 const css=readFileSync(new URL('../public/app.css',import.meta.url),'utf8');
 for(const fragment of ['tagField(\'features\'','tagField(\'items\'','tagField(\'stack\'','tagField(\'links\'','remove-tag','media-preview-content','cv-form','technicalDetails'])assert.ok(js.includes(fragment),fragment);
 assert.match(css,/\.theme-gold/);assert.match(css,/\.media-preview-backdrop/);
});

test('V8: CV download retrieves R2 PDF with attachment; only own-origin PDF preview allowed',async()=>{
 const pdfId='12345678-1234-1234-1234-123456789012';const rows={
   collections:[],
   configs:[{name:'settings',content:JSON.stringify({...defaults.settings,cvs:[{id:'backend',title:'Backend Developer',mediaId:pdfId}]})}],
 };
 const env={DB:{prepare(sql){return{
   all:async()=>({results:sql.includes('SELECT collection')?rows.collections:rows.configs}),
   first:async()=>sql.includes('SELECT object_key')?{object_key:'media/'+pdfId+'.pdf',mime_type:'application/pdf'}:null,
   bind(...args){return this}
 } }},FILES:{get:async()=>({body:new Uint8Array([37,80,68,70]),size:4})}};
 const ctx={waitUntil() {}};
 const resp=await worker.fetch(new Request(publicUrl+'/cv/backend'),env,ctx);
 assert.equal(resp.status,200);
 assert.equal(resp.headers.get('content-type'),'application/pdf');
 assert.match(resp.headers.get('content-disposition'),/attachment; filename="Backend-Developer.pdf"/);
 assert.equal(resp.headers.get('x-frame-options'),'DENY');
 const pdf=await worker.fetch(new Request(publicUrl+'/media/'+pdfId),env,ctx);
 assert.equal(pdf.status,200);
 assert.equal(pdf.headers.get('x-frame-options'),'SAMEORIGIN');
 assert.match(pdf.headers.get('content-security-policy'),/frame-ancestors 'self'/);
 const missing=await worker.fetch(new Request(publicUrl+'/cv/missing'),env,ctx);
 assert.equal(missing.status,404);
});


test('V8: cover-only projects render the uploaded cover in SSR instead of fallback',()=>{
 const s=makeState();s.projects=[{id:'cover-only',title:'Cover only',summary:'Short',overview:'Simple story',published:true,tracks:[],tone:'gold',coverMediaId:'cover-1',mediaIds:[]}];
 s.media=[{id:'cover-1',src:'/media/12345678-1234-1234-1234-123456789012',name:'photo.webp',type:'image/webp'}];
 const html=renderHtml(s,publicUrl+'/projects/cover-only',{name:'project',id:'cover-only'});
 assert.match(html,/src="\/media\/12345678-1234-1234-1234-123456789012"/);
 assert.doesNotMatch(html,/detail-fallback theme-gold/);
});
