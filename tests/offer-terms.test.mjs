import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {defaults} from '../src/defaults.js';
import {renderHtml} from '../src/render.js';

function sample(terms){
 const state=structuredClone(defaults);
 state.sections.offers=true;
 state.sectionsOrder=['offers'];
 state.offers=[{id:'promo-1',title:'Website development',titleAr:'تطوير المواقع',keyword:'FREE',description:'An offer',active:true,terms,termsAr:'1. أول شرط\n2. ثاني شرط'}];
 return state;
}
test('Server-side offer does not display conditions until requested',()=>{
 const html=renderHtml(sample('1. First rule\n2. Second rule'),'https://maher2004.dev/',{name:'home'});
 const visible=html.split('<body>')[1];
 assert.match(visible,/data-action="open-offer-terms"/);
 assert.match(visible,/aria-haspopup="dialog"/);
 assert.doesNotMatch(visible,/<small>1\. First rule/);
 assert.doesNotMatch(visible,/<div class="offer-terms">/);
});
test('Offer terms trigger is hidden for blank conditions',()=>{
 const html=renderHtml(sample('  \n '),'https://maher2004.dev/',{name:'home'});
 assert.doesNotMatch(html.split('<body>')[1],/open-offer-terms/);
});
test('SSR labels offer terms in Arabic',()=>{
 const html=renderHtml(sample('Terms'),'https://maher2004.dev/?lang=ar',{name:'home'});
 assert.match(html.split('<body>')[1],/الشروط والأحكام/);
});
test('Formatter preserves paragraphs, builds lists, and escapes untrusted text',()=>{
 const js=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
 const start=js.indexOf('function formatOfferTerms(text){');
 const end=js.indexOf('\nfunction openOfferTerms',start);
 assert.ok(start>=0 && end>start);
 const safe=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const format=new Function('esc',js.slice(start,end)+'\nreturn formatOfferTerms;')(safe);
 const html=format('Intro line\n\n1. First item\n2. Second item\n\n- Third item\n- <script>alert(1)</script>');
 assert.match(html,/<p>Intro line<\/p>/);
 assert.match(html,/<ol><li>First item<\/li><li>Second item<\/li><\/ol>/);
 assert.match(html,/<ul><li>Third item<\/li>/);
 assert.match(html,/&lt;script&gt;/);
 assert.doesNotMatch(html,/<script>/);
 assert.match(format('١. أول بند\n٢. ثاني بند'),/<ol><li>أول بند<\/li><li>ثاني بند<\/li><\/ol>/);
});
test('Browser offers use a native modal and format safe lists',()=>{
 const js=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
 for(const token of ['function formatOfferTerms(text)','function openOfferTerms(id)','modal.showModal()',"case 'open-offer-terms'","numbered?'ol':'ul'",'offer-terms-dialog'])assert.ok(js.includes(token),token);
 const css=readFileSync(new URL('../public/app.css',import.meta.url),'utf8');
 assert.match(css,/offer-terms-dialog::backdrop/);
 assert.match(css,/offer-terms-dialog-body li/);
});
