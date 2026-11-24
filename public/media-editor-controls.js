import {geometry, VIDEO_FORMATS} from './media-transform.js';

export function filenameParts(name){
 const value=String(name||'media');const dot=value.lastIndexOf('.');
 return dot>0?{base:value.slice(0,dot),ext:value.slice(dot)}:{base:value,ext:''};
}
export function namedOutput(base,prefix,ext){
 const name=String(prefix||'')+String(base||'').trim();
 if(!String(base||'').trim()||/[\\/\x00-\x1f\x7f]/.test(name)||name==='.'||name==='..')throw Error('Enter a valid file name (no path separators or control characters).');
 const full=name+ext;if(full.length>180)throw Error('File name must be at most 180 characters including extension.');return full;
}
export function outputExtension(file,o){
 if(o.format==='original')return filenameParts(file.name).ext;
 if(o.format==='image/jpeg')return '.jpg';
 if(o.format.startsWith('image/'))return '.'+o.format.slice(6);
 const video=VIDEO_FORMATS.find(v=>v.mime===o.format);return video?'.'+video.ext:filenameParts(file.name).ext;
}
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const round=v=>Math.round(v*10)/10;
// Delta is expressed in percentage points of the displayed source, not pixels.
export function draggedCrop(initial,handle,dx,dy){
 let l=Number(initial.left)||0,t=Number(initial.top)||0,r=100-(Number(initial.right)||0),b=100-(Number(initial.bottom)||0);
 const minW=Math.min(2,r-l),minH=Math.min(2,b-t);
 if(handle==='move'){dx=clamp(dx,-l,100-r);dy=clamp(dy,-t,100-b);l+=dx;r+=dx;t+=dy;b+=dy;}
 else {if(handle.includes('w'))l=clamp(l+dx,0,r-minW);if(handle.includes('e'))r=clamp(r+dx,l+minW,100);if(handle.includes('n'))t=clamp(t+dy,0,b-minH);if(handle.includes('s'))b=clamp(b+dy,t+minH,100);}
 return {left:round(l),top:round(t),right:round(100-r),bottom:round(100-b)};
}
function element(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;}
function drag(node,onStart,onMove,onEnd){
 let active=null;
 node.addEventListener('pointerdown',e=>{if(e.button!==0||active)return;const state=onStart(e);if(!state)return;e.preventDefault();e.stopPropagation();active={id:e.pointerId,x:e.clientX,y:e.clientY,state};node.setPointerCapture(e.pointerId);});
 node.addEventListener('pointermove',e=>{if(active?.id!==e.pointerId)return;e.preventDefault();onMove(active.state,e.clientX-active.x,e.clientY-active.y);});
 const end=e=>{if(active?.id!==e.pointerId)return;active=null;onEnd?.();};
 for(const name of ['pointerup','pointercancel','lostpointercapture'])node.addEventListener(name,end);
}
// Two lightweight visual surfaces: the source crop box and a bounded-size
// output canvas. Only one source is mounted. Never encode during pointer moves.
export function mountVisualEditor(host,file,kind,getOptions,changed){
 const url=URL.createObjectURL(file),source=element(kind==='video'?'video':'img','media-v2-source');
 const frame=element('div','media-v2-source-frame'),box=element('div','media-v2-crop-box');
 const sourceLabel=element('p','small','Source · drag edges/corners to crop, or drag inside to move');
 const reset=element('button','btn sm','Reset crop');reset.type='button';
 const outputLabel=element('p','small','Output preview');const canvas=element('canvas','media-v2-output');
 const stage=element('div','media-v2-output-stage'),scaled=element('div','media-v2-scaled');const resize=element('button','media-v2-scale-handle','↘');resize.type='button';resize.title='Drag to resize output';resize.setAttribute('aria-label','Drag to resize output (use maximum-side input for keyboard)');
 const details=element('p','small');const scaleLabel=element('label','media-v2-scale-range','Scale output');const range=element('input');range.type='range';range.min='1';range.max='100';range.step='1';scaleLabel.append(range);
 frame.append(source,box);scaled.append(canvas,resize);stage.append(scaled);host.replaceChildren(sourceLabel,frame,reset,outputLabel,stage,scaleLabel,details);
 let disposed=false,raf=0,ready=false,sourceWidth=0,sourceHeight=0;
 const getDimensions=()=>kind==='video'?[source.videoWidth,source.videoHeight]:[source.naturalWidth,source.naturalHeight];
 const invalidate=()=>{if(disposed||raf)return;raf=requestAnimationFrame(draw);};
 function metrics(){const o=getOptions();return geometry(sourceWidth,sourceHeight,o,kind==='video');}
 function draw(){raf=0;if(disposed||!ready)return;const o=getOptions(),original=o.format==='original';box.hidden=original;reset.hidden=original;stage.hidden=original;scaleLabel.hidden=original;outputLabel.hidden=original;
  if(original){details.textContent=`Original: ${sourceWidth} × ${sourceHeight} px (unchanged)`;return;}
  try{const g=metrics();box.style.inset=`${o.top}% ${o.right}% ${o.bottom}% ${o.left}%`;
   const previewFit=Math.min(1,Math.max(1,Math.min(360,host.clientWidth-16))/g.w,220/g.h),ratio=Math.min(1,Math.max(g.outWidth,g.outHeight)/Math.max(g.w,g.h));
   const displayWidth=Math.max(1,Math.round(g.w*previewFit*ratio)),displayHeight=Math.max(1,Math.round(g.h*previewFit*ratio));
   stage.style.width=`${Math.max(1,Math.round(g.w*previewFit))}px`;stage.style.height=`${Math.max(1,Math.round(g.h*previewFit))}px`;
   scaled.style.width=`${displayWidth}px`;scaled.style.height=`${displayHeight}px`;
   // Reuse the small canvas. Its pixel area is capped independently of output size.
   if(canvas.width!==displayWidth)canvas.width=displayWidth;if(canvas.height!==displayHeight)canvas.height=displayHeight;
   const ctx=canvas.getContext('2d');ctx.clearRect(0,0,displayWidth,displayHeight);if(o.format==='image/jpeg'){ctx.fillStyle='#fff';ctx.fillRect(0,0,displayWidth,displayHeight);}ctx.drawImage(source,g.x,g.y,g.w,g.h,0,0,displayWidth,displayHeight);
   range.value=String(Math.max(1,Math.round(ratio*100)));details.textContent=`Crop ${g.w} × ${g.h} px → output ${g.outWidth} × ${g.outHeight} px (${Math.round(ratio*100)}%) · geometric preview`;
  }catch(e){details.textContent=e.message;}
 }
 function update(patch){changed(patch);invalidate();}
 function setScale(percent){try{const g=metrics(),limit=kind==='video'?1920:8192;const maxSide=clamp(Math.round(Math.max(g.w,g.h)*percent/100),kind==='video'?2:1,limit);update({maxSide});}catch(e){details.textContent=e.message;}}
 range.addEventListener('input',()=>setScale(Number(range.value)));
 reset.addEventListener('click',()=>update({left:0,top:0,right:0,bottom:0}));
 for(const handle of ['nw','n','ne','e','se','s','sw','w']){const n=element('span','media-v2-crop-handle');n.dataset.handle=handle;box.append(n);}
 drag(box,e=>{if(!ready||getOptions().format==='original')return;const rect=frame.getBoundingClientRect();return {o:{...getOptions()},handle:e.target.dataset.handle||'move',w:rect.width,h:rect.height};},(start,dx,dy)=>update(draggedCrop(start.o,start.handle,dx/start.w*100,dy/start.h*100)));
 drag(resize,()=>{if(!ready||getOptions().format==='original')return;try{const g=metrics(),rect=stage.getBoundingClientRect();return {ratio:Math.max(g.outWidth,g.outHeight)/Math.max(g.w,g.h),w:rect.width,h:rect.height};}catch{return null;}},(start,dx,dy)=>{const delta=(Math.abs(dx/start.w)>Math.abs(dy/start.h)?dx/start.w:dy/start.h);setScale(clamp((start.ratio+delta)*100,1,100));});
 function loaded(){if(disposed)return;[sourceWidth,sourceHeight]=getDimensions();ready=sourceWidth>0&&sourceHeight>0;if(ready)invalidate();}
 source.addEventListener(kind==='video'?'loadeddata':'load',loaded);source.addEventListener('error',()=>{if(!disposed)details.textContent='Preview unavailable: this browser cannot decode the source.';});
 if(kind==='video'){source.muted=true;source.playsInline=true;source.preload='metadata';source.addEventListener('loadedmetadata',()=>{if(source.readyState>=2)loaded();});source.addEventListener('seeked',loaded);const scrub=element('input');scrub.type='range';scrub.min='0';scrub.max='1000';scrub.value='0';scrub.setAttribute('aria-label','Preview video position');scrub.addEventListener('input',()=>{if(Number.isFinite(source.duration))source.currentTime=source.duration*Number(scrub.value)/1000;});host.insertBefore(scrub,reset);}
 else source.alt='Source image';source.src=url;
 return {refresh:invalidate,dispose(){disposed=true;cancelAnimationFrame(raf);if(kind==='video'){source.pause();source.removeAttribute('src');source.load();}else source.removeAttribute('src');canvas.width=canvas.height=1;URL.revokeObjectURL(url);host.replaceChildren();}};
}
