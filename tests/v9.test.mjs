import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderHtml } from '../src/render.js';
import { defaults } from '../src/defaults.js';
import { validateState } from '../src/data.js';
const url='https://maher2004.dev';
const site=()=>structuredClone(defaults);

test('SEO: homepage title and description are editable and escaped in server HTML',()=>{
 const s=site();s.settings.seoTitle='Software Engineer & Backend Developer';
 s.settings.seoDescription='Node.js and backend services for businesses.';
 const html=renderHtml(s,url+'/',{name:'home'});
 assert.match(html,/<title>Software Engineer &amp; Backend Developer<\/title>/);
 assert.match(html,/<meta name="description" content="Node.js and backend services for businesses\.">/);
 assert.match(html,/<link rel="canonical" href="https:\/\/maher2004\.dev\/">/);
 assert.doesNotMatch(html,/<meta name="keywords"/);
});

test('SEO: project overrides metadata, supports Arabic and OG image',()=>{
 const s=site();s.settings.seoTitle='Homepage SEO';
 s.media=[{id:'cover-1',src:'/media/photo.webp',type:'image/webp'}];
 s.projects=[{id:'smart-hospital',title:'Smart Hospital',titleAr:'المستشفى الذكي',summary:'Medical system overview',summaryAr:'وصف المشروع',published:true,tracks:['AI','Backend'],seoTitle:'Smart Hospital — AI Project',seoTitleAr:'مشروع المستشفى الذكي',seoDescription:'Prototype with APIs and AI services.',seoDescriptionAr:'تكامل الواجهات والذكاء الاصطناعي',coverMediaId:'cover-1'}];
 const en=renderHtml(s,url+'/projects/smart-hospital',{name:'project',id:'smart-hospital'});
 assert.match(en,/<title>Smart Hospital — AI Project<\/title>/);
 assert.match(en,/<meta property="og:image" content="https:\/\/maher2004\.dev\/media\/photo\.webp">/);
 assert.doesNotMatch(en,/<meta name="keywords"/);
 const ar=renderHtml(s,url+'/projects/smart-hospital?lang=ar',{name:'project',id:'smart-hospital'});
 assert.match(ar,/<html lang="ar" dir="rtl">/);
 assert.match(ar,/<title>مشروع المستشفى الذكي<\/title>/);
 assert.match(ar,/content="تكامل الواجهات والذكاء الاصطناعي"/);
 assert.match(ar,/href="https:\/\/maher2004\.dev\/projects\/smart-hospital\?lang=ar"/);
});

test('SEO: fallback title remains and absent images do not produce OG images',()=>{
 const s=site();s.hero.portrait='';s.brand.logo='';
 const html=renderHtml(s,url+'/',{name:'home'});
 assert.match(html,/<title>Mohamed Maher — Backend Engineering<\/title>/);
 assert.doesNotMatch(html,/<meta property="og:image"/);
});

test('SEO: settings and project SEO optional with length validation',()=>{
 const s=site();s.projects=[{id:'project',title:'Project',tracks:['Backend']}];
 assert.equal(validateState(s),s);
 s.settings.seoTitle='z'.repeat(161);
 assert.throws(()=>validateState(s),/Invalid SEO text/);
});

test('SEO: old meta keyword data is ignored and never output',()=>{
 const s=site();s.settings.seoKeywords=['obsolete term'];
 const html=renderHtml(s,url+'/',{name:'home'});
 assert.doesNotMatch(html,/<meta name="keywords"/);
});

test('SEO: editor and navigation metadata updates wired without keyword fields',()=>{
 const js=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
 const render=readFileSync(new URL('../src/render.js',import.meta.url),'utf8');
 for(const needle of ['seo-home-form','Project SEO · Search appearance','refreshPublicSeo(r)','Save homepage SEO'])assert.ok(js.includes(needle),needle);
 assert.ok(!js.includes('seoKeywords'));
 assert.ok(!render.includes('keywordsTag'));
});
