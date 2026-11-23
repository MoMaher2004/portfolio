import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../public/app.css',import.meta.url),'utf8');
const swipeBody=source.match(/function projectSwipeStep\(start,end\)\{([\s\S]*?)\n\}/)?.[1];
const swipe=swipeBody?new Function('start','end',swipeBody):null;

test('project thumbnails retain both vertical and horizontal scroll after image changes',()=>{
 assert.match(source,/top:oldRail\.scrollTop,left:oldRail\.scrollLeft/);
 assert.match(source,/rail\.scrollTop=railPosition\.top;rail\.scrollLeft=railPosition\.left/);
 assert.doesNotMatch(source,/el\.offsetTop-rail\.offsetTop/);
});

test('gallery swipes distinguish horizontal movement from normal vertical scroll',()=>{
 assert.ok(swipe,'projectSwipeStep must exist');
 const origin={x:150,y:150};
 assert.equal(swipe(origin,{x:35,y:158}),1,'swiping left advances');
 assert.equal(swipe(origin,{x:260,y:148}),-1,'swiping right goes back');
 assert.equal(swipe(origin,{x:140,y:35}),0,'vertical page swipe ignored');
 assert.equal(swipe(origin,{x:110,y:148}),0,'short gesture ignored');
 assert.equal(swipe(origin,{x:40,y:32}),0,'diagonal gesture ignored');
});

test('touch and mouse gestures work in both stage and full screen without triggering image click',()=>{
 assert.match(source,/touchstart/);
 assert.match(source,/touchend/);
 assert.match(source,/mousedown/);
 assert.match(source,/mouseup/);
 assert.match(source,/\.showcase-motion,\.lightbox-canvas/);
 assert.match(source,/ev\.stopImmediatePropagation\(\)/);
 assert.match(source,/inViewer&&ui\.zoom!==1/);
 assert.match(css,/\.showcase-motion,\.lightbox-canvas\{touch-action:pan-y\}/);
});
