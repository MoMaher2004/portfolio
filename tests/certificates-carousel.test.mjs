import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { defaults } from '../src/defaults.js';
import { renderHtml } from '../src/render.js';

const origin = 'https://maher2004.dev';
const sample = () => {
 const s = structuredClone(defaults);
 s.sections.certificates = true;
 s.sectionsOrder = ['certificates'];
 s.certificates = [
  {id:'one',title:'AI Foundations',titleAr:'أساسيات الذكاء الاصطناعي',issuer:'NVIDIA',year:'2026',image:'/media/ai.webp',alt:'AI certificate',altAr:'شهادة الذكاء الاصطناعي',linkedinPostUrl:'https://lnkd.in/p/esnqbiMw'},
  {id:'two',title:'Data Science',issuer:'DEPI',year:'2025',image:'/media/ds.webp',linkedinPostUrl:'https://www.linkedin.com/posts/maher2004_datascience-machinelearning-depi-activity-7430656205137584128-d__B'},
  {id:'three',title:'No public post',issuer:'ITI',year:'2026',image:'/media/iti.webp',linkedinPostUrl:'https://linkedin.com.evil.example/posts/stolen'}
 ];
 return s;
};

test('server-rendered certificates remain indexable and load images lazily',()=>{
 const html=renderHtml(sample(),origin+'/',{name:'home'});
 assert.match(html,/id="certificates"/);
 assert.match(html,/cert-carousel-track/);
 assert.match(html,/data-action="cert-prev"/);
 assert.match(html,/data-action="cert-next"/);
 assert.match(html,/loading="lazy"/);
 assert.match(html,/decoding="async"/);
 assert.match(html,/fetchpriority="low"/);
 assert.match(html,/alt="AI certificate"/);
 assert.match(html,/أساسيات الذكاء الاصطناعي|AI Foundations/);
 assert.match(html,/data-action="view-certificate"/);
});

test('LinkedIn links are optional, escaped, and restricted to real LinkedIn posts',()=>{
 const html=renderHtml(sample(),origin+'/',{name:'home'});
 assert.match(html,/href="https:\/\/lnkd\.in\/p\/esnqbiMw"/);
 assert.match(html,/href="https:\/\/www\.linkedin\.com\/posts\/maher2004_/);
 assert.doesNotMatch(html,/href="https:\/\/linkedin\.com\.evil/);
 assert.match(html,/rel="noopener noreferrer"/);
 const s=sample();s.certificates[0].linkedinPostUrl='javascript:alert(1)';
 assert.doesNotMatch(renderHtml(s,origin+'/',{name:'home'}),/href="javascript:/i);
});

test('certificate editor persists optional LinkedIn post field and has image viewer controls',()=>{
 const js=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
 const css=readFileSync(new URL('../public/app.css',import.meta.url),'utf8');
 for(const token of ["textField('linkedinPostUrl'",'linkedinPostUrl,...','certificatePostUrl(','data-action="cert-next"','openCertificateViewer','showModal()'])assert.ok(js.includes(token),token);
 for(const token of ['.cert-carousel-track','.certificate-viewer-content img','object-fit:contain','scroll-snap-type:x mandatory'])assert.ok(css.includes(token),token);
});
