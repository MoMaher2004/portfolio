import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const source=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const routeStart=source.indexOf('function route(){');
const routeEnd=source.indexOf('// Keep metadata',routeStart);
const detailStart=source.indexOf('function projectPage(id)');
const detailEnd=source.indexOf('function tabs()',detailStart);
assert.ok(routeStart>=0&&routeEnd>routeStart&&detailStart>=0&&detailEnd>detailStart);
const relevant=source.slice(routeStart,routeEnd)+'\n'+source.slice(detailStart,detailEnd);
const draft={id:'draft-test',title:'Private Draft',published:false,year:'2026',summary:'Not yet public',tracks:['Backend'],stack:[],features:[],mediaIds:[]};
function render(pathname,authenticated,previewProjectId,project=draft){
 const context={
  location:{pathname},ui:{authenticated,previewProjectId},db:{projects:[project]},
  getProject:id=>id===project.id?project:null,
  nav:()=>'<nav></nav>',footer:()=>'<footer></footer>',
  esc:x=>String(x??''),loc:(p,key)=>p?.[key]||'',t:x=>x,tr:x=>x,
  projectExtraLinks:()=>[],projectLinkHref:x=>x,currentGallery:()=>[],
  relatedProjects:()=>[],localizedLines:()=>[],pills:()=>'',ctaBlock:()=>'',
 };
 return runInNewContext(relevant+"\nprojectPage('draft-test')",context);
}
test('anonymous public request cannot render unpublished project',()=>{
 assert.match(render('/projects/draft-test',false,null),/Project not found/);
});
test('even an admin session cannot preview via a public project URL',()=>{
 assert.match(render('/projects/draft-test',true,'draft-test'),/Project not found/);
});
test('admin can render a draft only within an authenticated in-memory preview',()=>{
 const before=draft.published;
 const html=render('/admin',true,'draft-test');
 assert.match(html,/Private Draft/);
 assert.doesNotMatch(html,/Project not found/);
 assert.equal(draft.published,before,'Preview must not publish or mutate draft');
});
test('admin URL without an unlocked session cannot render draft',()=>{
 assert.match(render('/admin',false,'draft-test'),/Project not found/);
});
test('published projects keep working through their public routes',()=>{
 const project={...draft,published:true};
 assert.match(render('/projects/draft-test',false,null,project),/Private Draft/);
});
