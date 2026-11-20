import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { defaults } from '../src/defaults.js';
import { renderHtml, renderAdmin } from '../src/render.js';
import { readSite, validateState } from '../src/data.js';

const pub=()=>structuredClone(defaults);

test('V7: server-rendered project card uses uploaded cover and favicon',()=>{
 const state=pub();
 state.projects=[{id:'case', title:'Real case', summary:'Implementation detail', published:true, featured:true, tracks:['Backend','AI Integration'], mediaIds:[], coverMediaId:'m1'}];
 state.media=[{id:'m1',type:'image/webp',name:'cover.webp',src:'/media/12345678-1234-1234-1234-123456789012'}];
 const out=renderHtml(state,'https://maher2004.dev/',{name:'home'});
 assert.match(out,/src="\/media\/12345678-1234-1234-1234-123456789012"/);
 assert.match(out,/href="\/favicon\.png"/);
 assert.doesNotMatch(out,/Real case\.slice\(0,2\)/);
 assert.match(out,/Backend/);assert.match(out,/AI Integration/);
});

test('V7: absent cover has neutral background, not project initials',()=>{
 const state=pub();
 state.projects=[{id:'bare',title:'Smart Hospital',summary:'Short',tracks:[],published:true,mediaIds:[]}];
 const out=renderHtml(state,'https://maher2004.dev/',{name:'home'});
 assert.match(out,/cover-gradient cover-empty/);
 assert.doesNotMatch(out,/>SM<|>SH</);
});

test('V7: D1 public state retains a cover-only image in filtered public media',async()=>{
 const state=pub();
 state.projects=[{id:'p',title:'Project',summary:'Short',published:true,tracks:['Backend','Automation'],coverMediaId:'c',mediaIds:[]}];
 state.media=[{id:'c',type:'image/png',src:'/media/cover',name:'cover.png',bytes:99},{id:'u',type:'image/png',src:'/media/unused',name:'private.png'}];
 const rows=Object.entries(state).filter(([k,v])=>Array.isArray(v)).flatMap(([collection,v])=>v.map(x=>({collection,id:x.id,content:JSON.stringify(x)})));
 const conf=Object.entries(state).filter(([k,v])=>!Array.isArray(v)&&!['messages'].includes(k)).map(([name,v])=>({name,content:JSON.stringify(v)}));
 const env={DB:{prepare(sql){return{all:async()=>({results:sql.startsWith('SELECT collection')?rows:conf})}}}};
 const site=await readSite(env);
 assert.deepEqual(site.projects[0].tracks,['Backend','Automation']);
 assert.equal(site.media.length,1);assert.equal(site.media[0].id,'c');
});

test('V7: multiple tracks are valid JSON and dashboard uses safe cover upload + matching Highlights label',()=>{
 const state=pub();
 state.projects=[{id:'multi',title:'Multi',tracks:['Backend','AI','Automation'],coverMediaId:'c',mediaIds:[],published:false}];
 assert.equal(validateState(state),state);
 const js=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
 assert.match(js,/name="trackExisting"/);
 assert.match(js,/project-cover-upload/);
 assert.match(js,/Highlights EN/);
 assert.match(js,/tagField/);
 assert.doesNotMatch(js,/Project images and videos uploaded from the CMS\./);
 assert.match(renderAdmin(),/favicon\.png/);
});
