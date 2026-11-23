import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const source=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const start=source.indexOf('const socialIconShapes={');
const end=source.indexOf('function certVisual(',start);
assert.ok(start!==-1 && end>start,'Social icon implementation found');
const db={socials:[]};
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const cleanUrl=u=>{try{const v=new URL(u);return ['https:','http:','mailto:','tel:'].includes(v.protocol)?v.href:'#'}catch{return '#'}};
const {socialIconType,socialIcon,socialLinks}=runInNewContext(source.slice(start,end)+';({socialIconType,socialIcon,socialLinks})',{URL,db,esc,cleanUrl});

test('Phone, email, and messaging URLs select the appropriate SVG icons',()=>{
 assert.equal(socialIconType('My number','tel:+201000000000'),'phone');
 assert.equal(socialIconType('Contact','mailto:test@example.com'),'email');
 assert.equal(socialIconType('Chat','https://wa.me/201000000000'),'whatsapp');
 assert.equal(socialIconType('Messages','https://t.me/example'),'telegram');
});

test('Brand URLs work even when the admin chooses a different link label',()=>{
 for(const [domain,type] of [
  ['tiktok.com/@someone','tiktok'],['facebook.com/example','facebook'],
  ['instagram.com/example','instagram'],['youtube.com/@example','youtube'],
  ['linkedin.com/in/example','linkedin'],['github.com/example','github'],
  ['x.com/example','x'],['discord.gg/example','discord'],
  ['threads.net/@example','threads'],['reddit.com/u/example','reddit']
 ])assert.equal(socialIconType('Personal page','https://www.'+domain),type,domain);
 assert.equal(socialIconType('Personal page','https://youtu.be/xyz'),'youtube');
});

test('Arabic and English labels work for non-platform addresses',()=>{
 assert.equal(socialIconType('رقم التليفون','https://example.com'),'phone');
 assert.equal(socialIconType('تيليجرام','https://example.com'),'telegram');
 assert.equal(socialIconType('Tik Tok','https://example.com'),'tiktok');
 assert.equal(socialIconType('Instagram','https://example.com'),'instagram');
 assert.equal(socialIconType('My site','https://example.com'),'website');
});

test('Unknown URLs cannot impersonate a platform with a deceptive hostname',()=>{
 assert.equal(socialIconType('Another site','https://instagram.com.evil.example'),'website');
 assert.equal(socialIconType('Another site','https://fake-whatsapp.com'),'website');
});

test('All rendered social icons are inline SVGs with safe escaped labels',()=>{
 db.socials=[
  {label:'Phone',url:'tel:+201000000000'},
  {label:'WhatsApp',url:'https://wa.me/201000000000'},
  {label:'<script>alert(1)</script>',url:'https://example.com'},
  {label:'Broken',url:'javascript:alert(1)'}
 ];
 const html=socialLinks();
 assert.match(html,/aria-hidden="true"/);
 assert.equal((html.match(/<svg /g)||[]).length,3);
 assert.doesNotMatch(html,/<script>/);
 assert.match(html,/&lt;script&gt;/);
 assert.doesNotMatch(html,/javascript:/);
 assert.match(html,/href="tel:\+201000000000"/);
 assert.doesNotMatch(html,/<a[^>]+href="tel:[^"]+"[^>]+target=/);
 assert.match(socialIcon('Email','mailto:me@example.com'),/viewBox="0 0 24 24"/);
});
