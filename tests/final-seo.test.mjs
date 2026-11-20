import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { defaults } from '../src/defaults.js';
import { renderHtml } from '../src/render.js';
import worker from '../src/index.js';

const origin='https://maher2004.dev';
const sample=()=>{
 const s=structuredClone(defaults);
 s.media=[{id:'first',name:'random123.jpg',type:'image/jpeg',src:'/media/11111111-1111-4111-8111-111111111111',alt:'The hospital dashboard with patient records',altAr:'لوحة متابعة المرضى'}];
 s.projects=[
  {id:'hospital',title:'Smart Hospital',titleAr:'المستشفى الذكي',summary:'Integrated appointment management',summaryAr:'نظام مواعيد',overview:'A web app',tracks:['Backend','AI'],stack:['Python'],category:'Web',published:true,mediaIds:[],coverMediaId:'first'},
  {id:'assistant',title:'Voice Assistant',summary:'A voice-based assistant',tracks:['AI'],stack:['Node.js'],category:'AI',published:true,mediaIds:[],coverMediaId:''},
  {id:'unpublished',title:'Private Work',summary:'Not published',tracks:['AI'],category:'Web',published:false,mediaIds:[]}
 ];
 s.certificates=[{id:'cert1',title:'Training',alt:'An internship certificate from ITI',image:'/media/cert.jpeg',issuer:'ITI',year:'2025'}];
 return s;
};

test('SEO JSON-LD describes existing person and work without injecting tags',()=>{
 const s=sample();s.projects[0].title='Hospital </script><script>alert(1)</script>';
 const html=renderHtml(s,origin+'/projects/hospital',{name:'project',id:'hospital'});
 assert.match(html,/type="application\/ld\+json"/);
 const raw=html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1];
 assert.ok(raw);
 const data=JSON.parse(raw);
 assert.ok(data['@graph'].some(x=>x['@type']==='Person'));
 assert.ok(data['@graph'].some(x=>x['@type']==='CreativeWork'));
 assert.ok(data['@graph'].some(x=>x['@type']==='BreadcrumbList'));
 assert.doesNotMatch(raw,/<script>/);
 assert.doesNotMatch(html,/<meta name="keywords"/);
});

test('Image ALT metadata uses human descriptions in EN and AR; no filename alt',()=>{
 const s=sample();const en=renderHtml(s,origin+'/projects/hospital',{name:'project',id:'hospital'});
 assert.match(en,/alt="The hospital dashboard with patient records"/);
 assert.doesNotMatch(en,/alt="random123\.jpg"/);
 const ar=renderHtml(s,origin+'/projects/hospital?lang=ar',{name:'project',id:'hospital'});
 assert.match(ar,/alt="لوحة متابعة المرضى"/);
 const homepage=renderHtml(s,origin+'/',{name:'home'});
 assert.match(homepage,/An internship certificate from ITI/);
});

test('Only genuinely translated project pages are marked with Arabic alternate and sitemap',()=>{
 const s=sample();const translated=renderHtml(s,origin+'/projects/hospital',{name:'project',id:'hospital'});
 assert.match(translated,/hreflang="ar"/);
 assert.match(translated,/hreflang="x-default"/);
 const notTranslated=renderHtml(s,origin+'/projects/assistant',{name:'project',id:'assistant'});
 assert.doesNotMatch(notTranslated,/hreflang="ar"/);
 assert.doesNotMatch(notTranslated,/hreflang="es"/);
 assert.match(notTranslated,/rel="canonical"/);
});

test('Related projects include relevant published work but never drafts',()=>{
 const s=sample();const html=renderHtml(s,origin+'/projects/hospital',{name:'project',id:'hospital'});
 assert.match(html,/Related projects/);
 assert.match(html,/href="\/projects\/assistant"/);
 assert.doesNotMatch(html,/href="\/projects\/unpublished"/);
});

test('Sitemap includes real lastmod values and only translations that exist',async()=>{
 const s=sample(), timestamp='2026-11-20 08:09:10';
 const items=s.projects.map((p,i)=>({collection:'projects',id:p.id,position:i,content:JSON.stringify(p),updated_at:timestamp}));
 const conf=['hero','settings','brand','sections','sectionsOrder'].map(name=>({name,content:JSON.stringify(s[name]),updated_at:timestamp}));
 const db={prepare(query){return {bind(){return this;},async first(){return {latest:timestamp}},async all(){
   if(query.includes('SELECT collection,id,updated_at'))return {results:items};
   if(query.includes('SELECT collection,id,content'))return {results:items};
   if(query.includes('SELECT name,content FROM configuration'))return {results:conf};
   return {results:[]};
  }};}};
 const resp=await worker.fetch(new Request(origin+'/sitemap.xml'),{DB:db,ALLOWED_ORIGINS:''},{waitUntil(){}});
 assert.equal(resp.status,200);
 const xml=await resp.text();assert.match(xml,/<lastmod>2026-11-20<\/lastmod>/);
 assert.match(xml,/\/projects\/hospital\?lang=ar/);
 assert.doesNotMatch(xml,/\/projects\/assistant\?lang=ar/);
 assert.doesNotMatch(xml,/\/projects\/unpublished/);
 assert.doesNotMatch(xml,/\?lang=es/);
});

test('CMS uses ALT editor, lazy gallery and optimized large upload behavior',()=>{
 const js=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
 for(const token of ['edit-media-alt','media-alt-form','portrait-alt-form','optimizeUploadImage','Related projects'])assert.ok(js.includes(token),token);
 const css=readFileSync(new URL('../public/app.css',import.meta.url),'utf8');assert.ok(css.includes(':root.light .about-signature'));
 const sql=readFileSync(new URL('../src/data.js',import.meta.url),'utf8');assert.ok(sql.includes('content_items.content<>excluded.content'));
});
