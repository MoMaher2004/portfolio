import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaults } from '../src/defaults.js';
import { renderHtml, renderAdmin } from '../src/render.js';
import { validateState } from '../src/data.js';
import worker from '../src/index.js';

test('new deployment has zero projects, fake offers, sample messages, portraits',()=>{
 assert.equal(defaults.projects.length,0);
 assert.equal(defaults.messages.length,0);
 assert.equal(defaults.offers.length,0);
 assert.equal(defaults.certificates.length,0);
 assert.equal(defaults.hero.portrait,'');
 assert.ok(defaults.hardSkills.find(x=>x.items.includes('Node.js')));
 assert.ok(defaults.hardSkills.find(x=>x.items.includes('PHP')));
});
test('SSR home has title, canonical, content and no placeholder projects',()=>{
 const html=renderHtml(defaults,'https://portfolio.example/','home'.constructor===String?{name:'home'}:{name:'home'});
 assert.match(html,/<title>Mohamed Maher/);
 assert.match(html,/<link rel="canonical" href="https:\/\/portfolio.example\/">/);
 assert.match(html,/Engineering ideas into/);
 assert.doesNotMatch(html,/MFG ERP System|Sample visitor|Your portrait/);
 assert.match(html,/<script id="server-state" type="application\/json">/);
});
test('SSR HTML escapes user content and produces real project path',()=>{
 const s=structuredClone(defaults);
 s.projects=[{id:'one',title:'My <script>alert(1)</script>',summary:'" tricky',category:'Backend',overview:'Implementation',problem:'Test',solution:'Code',year:'2026',tracks:['Backend'],stack:['Node.js'],published:true,featured:true,mediaIds:[]}];
 const homepage=renderHtml(s,'https://p.test/',{name:'home'});
 assert.match(homepage,/href="\/projects\/one/);
 assert.doesNotMatch(homepage,/<script>alert\(1\)<\/script>/);
 const project=renderHtml(s,'https://p.test/projects/one',{name:'project',id:'one'});
 assert.match(project,/My &lt;script&gt;/);
 assert.match(project,/<meta name="description"/);
});
test('admin is noindex and does not embed authentication token',()=>{
 const html=renderAdmin();assert.match(html,/noindex,nofollow/);assert.doesNotMatch(html,/ADMIN_TOKEN|demo/);
});
test('state validation rejects repeated projects and embedded base64',()=>{
 const s=structuredClone(defaults);assert.equal(validateState(s),s);
 s.projects=[{id:'good',title:'New project',tracks:[],published:true}];assert.equal(validateState(s),s);
 s.projects.push({...s.projects[0]});assert.throws(()=>validateState(s),/Duplicate/);
 s.projects.pop();s.hero.portrait='data:image/png;base64,AA';assert.throws(()=>validateState(s),/R2/);
});

test('iframe embedding disabled and protected API rejects unauthenticated access',async()=>{
 const fakeDb={prepare(){return {bind(){return this},first:async()=>null,run:async()=>({})}}};
 const req=new Request('https://portfolio.example/api/admin/verify',{method:'POST'});
 const result=await worker.fetch(req,{DB:fakeDb,ADMIN_TOKEN:'valid-token',ALLOWED_ORIGINS:''},{waitUntil(){}});
 assert.equal(result.status,401);
 assert.equal(result.headers.get('X-Frame-Options'),'DENY');
 assert.match(result.headers.get('Content-Security-Policy'),/frame-ancestors 'none'/);
});

test('upload API sends an intact, known-length body to R2 and records media metadata', async()=>{
 const stored=[];
 const fakeDb={prepare(query){return {bind(...values){this.values=values;return this},first:async()=>null,run:async function(){if(query.startsWith('INSERT INTO media_files'))stored.push(this.values);return {}}}}};
 const files={put:async(key,stream,meta)=>{let n=0;for await(const part of stream)n+=part.length;stored.push({key,bytes:n,mime:meta.httpMetadata.contentType});return{}},delete:async()=>{}};
 const payload='hello';
 const req=new Request('https://portfolio.example/api/admin/files?name=hello.txt',{method:'POST',headers:{Authorization:'Bearer token', 'Content-Type':'text/plain','Content-Length':String(payload.length)},body:payload});
 const res=await worker.fetch(req,{DB:fakeDb,FILES:files,ADMIN_TOKEN:'token',ALLOWED_ORIGINS:''},{waitUntil(){}});
 assert.equal(res.status,201);const result=await res.json();
 assert.equal(result.bytes,payload.length);assert.equal(result.type,'text/plain');
 assert.equal(stored[0].bytes,payload.length);assert.equal(stored[1][4],payload.length);
});

test('analytics endpoint requires auth, supports 7/30/90-day D1 filters and does not report unique visitors',async()=>{
 const sent=[];
 const db={prepare(sql){const q={sql, values:[],bind(...args){this.values=args;return this},async first(){return null},async run(){return {}},async all(){sent.push({sql:this.sql,values:this.values});if(this.sql.includes('GROUP BY date'))return {results:[{date:new Date().toISOString().slice(0,10),views:4}]};if(this.sql.includes('GROUP BY country'))return {results:[{country:'EG',views:4}]};if(this.sql.includes('GROUP BY hour'))return {results:[{hour:10,views:4}]};return {results:[{path:'/projects/erp',views:4}]}}};return q}};
 const env={DB:db,ADMIN_TOKEN:'strong-test-token',ALLOWED_ORIGINS:''},ctx={waitUntil(){}};
 const unauth=await worker.fetch(new Request('https://example.org/api/admin/analytics?days=7'),env,ctx);
 assert.equal(unauth.status,401);
 const resp=await worker.fetch(new Request('https://example.org/api/admin/analytics?days=7',{headers:{Authorization:'Bearer strong-test-token'}}),env,ctx);
 assert.equal(resp.status,200);const data=await resp.json();
 assert.equal(data.periodDays,7);assert.equal(data.total,4);assert.equal(data.topPaths[0].path,'/projects/erp');
 assert.match(data.source,/not unique visitors/);
 assert.equal(sent.length,4);assert.ok(sent.every(x=>x.values[0]===data.startDate));
});
