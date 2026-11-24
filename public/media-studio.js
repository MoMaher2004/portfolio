import {MAX_UPLOAD,MAX_IMAGE_PIXELS,IMAGE_TYPES,VIDEO_FORMATS,mediaType,mediaKind,mimeBase,geometry,outputName,defaults,validateOptions,checkUpload} from './media-transform.js';
import {filenameParts,namedOutput,outputExtension,mountVisualEditor} from './media-editor-controls.js';
const abortError=()=>new DOMException('Conversion cancelled','AbortError');
const ensureActive=signal=>{if(signal.aborted)throw abortError();};
const pretty=n=>`${(n/1048576).toFixed(n<1048576?2:1)} MiB`;
const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
let studioOpen=false;
export function failureMessage(error){
 const name=typeof error?.name==='string'?error.name:'';
 const message=typeof error?.message==='string'?error.message.trim():typeof error==='string'?error.trim():'';
 const status=Number.isInteger(error?.status)?`HTTP ${error.status}: `:'';
 return status+(name&&name!=='Error'&&name!==message?`${name}: `:'')+(message||'No error details returned by the browser or server.');
}
function videoDecodeError(video){
 const code=video.error?.code;
 const reason={1:'Playback aborted',2:'Media read/network error',3:'Source decoding failed',4:'Source format or codec not supported'}[code]||'Could not decode source video';
 return Error(`${reason}${code?` (media error ${code})`:''}${video.error?.message?`: ${video.error.message}`:''}`);
}
function el(tag,props={},children=[]){const node=document.createElement(tag);for(const [k,v] of Object.entries(props)){if(k==='className')node.className=v;else if(k==='text')node.textContent=v;else if(k==='style')Object.assign(node.style,v);else if(k.startsWith('on'))node.addEventListener(k.slice(2),v);else if(k in node)node[k]=v;else node.setAttribute(k,v);}for(const child of children)node.append(child);return node;}
function canvasBlob(canvas,type,quality){return new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('Image encoding failed')),type,quality));}
async function capabilities(allowed){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=1;const images=[];
 for(const type of IMAGE_TYPES){if(allowed&&!allowed.includes(type))continue;try{if((await canvasBlob(canvas,type,.8)).type===type)images.push(type);}catch{}}
 const videos=typeof MediaRecorder!=='undefined'&&typeof canvas.captureStream==='function'?VIDEO_FORMATS.filter(v=>MediaRecorder.isTypeSupported(v.mime)||MediaRecorder.isTypeSupported(v.silent)).map(v=>({...v,audioSupported:MediaRecorder.isTypeSupported(v.mime)})).sort((a,b)=>Number(b.audioSupported)-Number(a.audioSupported)):[];
 return {images,videos};
}
function workerImage(file,o,signal){return new Promise((resolve,reject)=>{
 ensureActive(signal);let worker;try{worker=new Worker(new URL('./media-image-worker.js',import.meta.url),{type:'module'});}catch(e){reject(e);return;}
 const end=(err,result)=>{clearTimeout(timeout);worker.terminate();signal.removeEventListener('abort',cancel);err?reject(err):resolve(result);};
 const cancel=()=>end(abortError());const timeout=setTimeout(()=>end(Error('Image conversion timed out. Try a smaller file.')),90000);
 signal.addEventListener('abort',cancel,{once:true});worker.onmessage=({data})=>data.error?end(Error(data.error)):end(null,data);worker.onerror=()=>end(Error('Image worker could not start or decode this file. Try another format or keep original.'));
 worker.postMessage({file,options:o});
});}
async function mainThreadImage(file,o,signal){
 let bitmap,canvas;try{ensureActive(signal);bitmap=await createImageBitmap(file);ensureActive(signal);if(bitmap.width*bitmap.height>MAX_IMAGE_PIXELS)throw Error('Source exceeds the 24 MP safe decoding limit.');const g=geometry(bitmap.width,bitmap.height,o);canvas=document.createElement('canvas');canvas.width=g.outWidth;canvas.height=g.outHeight;const ctx=canvas.getContext('2d',{alpha:o.format!=='image/jpeg'});if(o.format==='image/jpeg'){ctx.fillStyle='#fff';ctx.fillRect(0,0,g.outWidth,g.outHeight);}await tick();ensureActive(signal);ctx.drawImage(bitmap,g.x,g.y,g.w,g.h,0,0,g.outWidth,g.outHeight);bitmap.close();bitmap=null;const blob=await canvasBlob(canvas,o.format,o.quality/100);ensureActive(signal);if(blob.type!==o.format)throw Error('Your browser cannot encode the requested format.');return {blob};}finally{bitmap?.close();if(canvas){canvas.width=1;canvas.height=1;}}
}
function waitMedia(video,signal){return new Promise((resolve,reject)=>{
 if(signal.aborted){reject(abortError());return;}if(video.error){reject(videoDecodeError(video));return;}if(video.readyState>=2){resolve();return;}
 const finish=err=>{clearTimeout(timer);video.removeEventListener('loadeddata',ready);video.removeEventListener('error',failed);signal.removeEventListener('abort',cancel);err?reject(err):resolve();};
 const ready=()=>finish(),failed=()=>finish(videoDecodeError(video)),cancel=()=>finish(abortError()),timer=setTimeout(()=>finish(Error('Video loading timed out.')),20000);
 video.addEventListener('loadeddata',ready,{once:true});video.addEventListener('error',failed,{once:true});signal.addEventListener('abort',cancel,{once:true});
});}
async function transcodeVideo(file,o,signal,progress,audioContext,host){
 ensureActive(signal);const format=VIDEO_FORMATS.find(f=>f.mime===o.format);const mime=o.audio?format?.mime:format?.silent;
 if(!mime||!MediaRecorder.isTypeSupported(mime))throw Error('The selected codec/audio combination is not supported by this browser.');
 if(document.hidden)throw Error('Keep this tab visible during video conversion.');
 let video,canvas,stream,source,destination,recorder,url,frameId,interval,videoFrame=false,cleanupRecording=()=>{};
 let stage='Source decoding';
 try{
  url=URL.createObjectURL(file);video=el('video',{preload:'auto',playsInline:true,muted:!o.audio,className:'media-studio-encoder'});host.append(video);video.src=url;await waitMedia(video,signal);ensureActive(signal);
  stage='Source validation and output dimensions';
  if(!Number.isFinite(video.duration)||video.duration<=0)throw Error('A finite, decodable video is required.');
  if(video.videoWidth*video.videoHeight>3840*2160)throw Error('Source video exceeds 4K. Use a smaller source to protect this device.');
  const g=geometry(video.videoWidth,video.videoHeight,o,true);if(g.outWidth*g.outHeight>1920*1080)throw Error('Local video conversion is limited to about 1080p to reduce device load. Choose a smaller maximum side.');
  const estimated=(Number(o.bitrate)+(o.audio?Number(o.audioBitrate):0))*1000/8*video.duration;if(estimated>MAX_UPLOAD*.98)throw Error('Estimated video size exceeds 90 MiB. Choose a lower bitrate.');
  stage='Canvas capture setup';
  canvas=document.createElement('canvas');canvas.width=g.outWidth;canvas.height=g.outHeight;const ctx=canvas.getContext('2d',{alpha:false});if(!ctx)throw Error('Could not allocate a video canvas.');
  const draw=()=>ctx.drawImage(video,g.x,g.y,g.w,g.h,0,0,g.outWidth,g.outHeight);draw();stream=canvas.captureStream(Number(o.fps));
  stage='Audio setup';
  if(o.audio){if(!audioContext||audioContext.state!=='running')throw Error('Audio encoding is unavailable. Enable audio playback permissions or uncheck Keep audio.');source=audioContext.createMediaElementSource(video);destination=audioContext.createMediaStreamDestination();source.connect(destination);for(const track of destination.stream.getAudioTracks())stream.addTrack(track);}
  stage='MediaRecorder initialization';
  recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:Number(o.bitrate)*1000,...(o.audio?{audioBitsPerSecond:Number(o.audioBitrate)*1000}:{})});
  const chunks=[];let bytes=0,problem=null,lastDraw=-Infinity,lastTime=-1,lastAdvance=performance.now();
  stage='Video encoding';
  const blob=await new Promise((resolve,reject)=>{
   let finished=false;
   const stop=(err)=>{if(err&&!problem)problem=err;video.pause();if(recorder.state!=='inactive'){try{recorder.stop();}catch(e){finish(problem||e);}}else finish(problem);};
   const finish=err=>{if(finished)return;finished=true;cleanupRecording();if(err)reject(err);else if(!chunks.length)reject(Error('No video data was encoded.'));else resolve(new Blob(chunks,{type:mimeBase(recorder.mimeType||mime)}));};
   const onAbort=()=>stop(abortError()),onHidden=()=>{if(document.hidden)stop(Error('Conversion stopped because the tab was hidden. Keep the tab visible and retry.'));},onEnd=()=>{try{draw();}catch{}stop();},onError=()=>stop(videoDecodeError(video));
   cleanupRecording=()=>{signal.removeEventListener('abort',onAbort);document.removeEventListener('visibilitychange',onHidden);video.removeEventListener('ended',onEnd);video.removeEventListener('error',onError);clearInterval(interval);if(frameId!==undefined){if(videoFrame)video.cancelVideoFrameCallback(frameId);else cancelAnimationFrame(frameId);}};
   recorder.ondataavailable=e=>{if(e.data.size){bytes+=e.data.size;if(bytes>MAX_UPLOAD){stop(Error('Encoded video exceeds 90 MiB. Use a lower bitrate.'));return;}chunks.push(e.data);}};
   recorder.onerror=e=>stop(e.error||Error('MediaRecorder reported an encoder error without details.'));recorder.onstop=()=>finish(problem);
   signal.addEventListener('abort',onAbort,{once:true});document.addEventListener('visibilitychange',onHidden);video.addEventListener('ended',onEnd,{once:true});video.addEventListener('error',onError,{once:true});
   videoFrame=typeof video.requestVideoFrameCallback==='function';
   const next=()=>{frameId=videoFrame?video.requestVideoFrameCallback(frame):requestAnimationFrame(frame);};
   function frame(now){if(finished||problem||recorder.state==='inactive')return;try{if(now-lastDraw>=1000/Number(o.fps)-2){draw();lastDraw=now;}next();}catch(e){stop(e);}}
   try{ensureActive(signal);recorder.start(1000);next();interval=setInterval(()=>{if(video.currentTime>lastTime){lastTime=video.currentTime;lastAdvance=performance.now();}else if(performance.now()-lastAdvance>20000){stop(Error('Video playback stalled. Try a lower resolution or another source.'));return;}progress(Math.min(.99,video.currentTime/video.duration));},250);video.play().catch(e=>stop(Error('Could not start video playback: '+e.message)));}catch(e){stop(e);}
  });
  stage='Encoded output validation';
  ensureActive(signal);if(blob.type!==mimeBase(mime))throw Error(`Unexpected encoded video type: ${blob.type}; expected ${mimeBase(mime)}`);progress(1);return new File([blob],outputName(file.name,format.ext),{type:blob.type});
 }catch(error){if(signal.aborted)throw abortError();throw Error(`${stage}: ${failureMessage(error)}`,{cause:error});}
 finally{cleanupRecording();if(recorder&&recorder.state!=='inactive')try{recorder.stop();}catch{};video?.pause();stream?.getTracks().forEach(t=>t.stop());try{source?.disconnect();destination?.disconnect();}catch{}if(video){video.removeAttribute('src');video.load();video.remove();}if(url)URL.revokeObjectURL(url);if(canvas){canvas.width=1;canvas.height=1;}}
}
async function convert(file,o,kind,signal,progress,audioContext,host,allowed){
 ensureActive(signal);validateOptions(o,kind);if(o.format==='original')return checkUpload(file,allowed);
 if(kind==='image'){if(file.size>MAX_UPLOAD)throw Error('Source image exceeds the 90 MiB safe decoding limit.');const result=typeof Worker==='function'&&typeof OffscreenCanvas==='function'?await workerImage(file,o,signal):await mainThreadImage(file,o,signal);const ext=o.format==='image/jpeg'?'jpg':o.format.split('/')[1];return checkUpload(new File([result.blob],outputName(file.name,ext),{type:result.blob.type}),allowed);}
 if(kind==='video')return checkUpload(await transcodeVideo(file,o,signal,progress,audioContext,host),allowed);
 throw Error('Unsupported conversion');
}
export async function openMediaStudio(files,upload,{allowedImageTypes}={}){
 if(studioOpen)throw Error('Another media editor is already open.');if(!files.length)return {uploaded:[],failures:[],cancelled:false};studioOpen=true;
 let dialog,visual,audioContext,controller;const previousFocus=document.activeElement;
 try{
 if(!document.querySelector('link[data-media-studio-css]')){const style=el('link',{rel:'stylesheet',href:new URL('./media-studio.css',import.meta.url).href});style.dataset.mediaStudioCss='';document.head.append(style);}
 const formats=await capabilities(allowedImageTypes);const rows=files.map(file=>({file,kind:mediaKind(file),o:defaults(file,formats),base:filenameParts(file.name).base,status:'Ready'}));
 let selected=0,running=false,cancelled=false,settled=false,phase='idle';const result={uploaded:[],failures:[],cancelled:false};
 dialog=el('dialog',{className:'media-studio',ariaLabel:'Media conversion and upload'});
 const title=el('h2',{text:'Prepare media for upload'}),intro=el('p',{className:'sub small',text:'Convert locally, one file at a time. Images: WebP by default (GIF stays original). Video: MP4 when supported, otherwise WebM. No conversion runs on Cloudflare.'});
 const list=el('div',{className:'media-studio-list'}),editor=el('div',{className:'media-studio-editor'}),notice=el('p',{className:'media-studio-notice',text:'Choose an item to edit its settings, or apply settings to all items of the same type.'}),progress=el('progress',{max:1,value:0,className:'media-studio-progress'}),progressText=el('p',{className:'small',ariaLive:'polite',text:'Ready'});
 const start=el('button',{type:'button',className:'btn primary',text:'Convert & upload'}),cancel=el('button',{type:'button',className:'btn',text:'Cancel'});
 const preview=el('div',{className:'media-studio-preview'});
 const errors=el('div',{className:'media-studio-errors',role:'alert',hidden:true,tabIndex:-1});
 function showErrors(){errors.hidden=!result.failures.length;errors.textContent=result.failures.map(f=>`${f.name} — ${f.message}`).join('\n');}
 const prefix=el('input',{type:'text',maxLength:160,placeholder:'e.g. hospital-',ariaLabel:'Filename prefix for all files'});
 const naming=el('div',{className:'media-studio-naming'},[el('label',{text:'Prefix (all files)'},[prefix]),el('small',{className:'sub',text:'Applied automatically as you type, including single-file uploads.'})]);
 prefix.addEventListener('input',()=>{renderList();const finalName=editor.querySelector('.media-final-name');if(finalName)finalName.textContent=displayName(rows[selected]);});
 dialog.append(title,intro,errors,naming,el('div',{className:'media-studio-layout'},[list,el('div',{},[editor,preview])]),notice,progress,progressText,el('div',{className:'media-studio-actions'},[cancel,start]));document.body.append(dialog);dialog.showModal();
 const clearPreview=()=>{visual?.dispose();visual=null;preview.replaceChildren();};
 function rowName(row){return namedOutput(row.base,prefix.value.trimStart(),outputExtension(row.file,row.o));}
 function displayName(row){try{return rowName(row);}catch{return 'Invalid name';}}
 function syncCrop(){visual?.refresh();}
 function showPreview(){const row=rows[selected];clearPreview();if(row.kind==='other')return;if(row.file.size>MAX_UPLOAD){preview.textContent='Preview disabled for sources larger than 90 MiB.';return;}
  visual=mountVisualEditor(preview,row.file,row.kind,()=>row.o,patch=>{Object.assign(row.o,patch);for(const input of editor.querySelectorAll('[data-setting]'))if(Object.hasOwn(patch,input.dataset.setting))input.value=String(patch[input.dataset.setting]);});
 }
 function renderList(){list.replaceChildren(...rows.map((r,i)=>el('button',{type:'button',className:'media-studio-row'+(selected===i?' active':''),disabled:running,onclick:()=>{selected=i;renderList();renderEditor();showPreview();}},[el('strong',{text:displayName(r)}),el('small',{text:`${pretty(r.file.size)} · ${r.status}`})])));}
 const field=(label,node)=>el('label',{className:'media-studio-field'},[el('span',{text:label}),node]);
 function select(label,key,choices,row,onChange){const select=el('select');for(const [value,text,disabled] of choices)select.append(el('option',{value:String(value),text,disabled:!!disabled}));select.value=String(row.o[key]);select.addEventListener('change',()=>{row.o[key]=key==='format'?select.value:Number(select.value);onChange?.();syncCrop();});return field(label,select);}
 function number(label,key,row,min,max,step=1){const input=el('input',{type:'number',min:String(min),max:String(max),step:String(step),value:String(row.o[key])});input.dataset.setting=key;input.addEventListener('input',()=>{row.o[key]=input.value===''?NaN:Number(input.value);syncCrop();});return field(label,input);}
 function check(label,key,row,onChange){const input=el('input',{type:'checkbox',checked:!!row.o[key]});input.addEventListener('change',()=>{row.o[key]=input.checked;onChange?.();});return el('label',{className:'media-studio-check'},[input,el('span',{text:label})]);}
 function renderEditor(){const row=rows[selected],o=row.o;editor.replaceChildren(el('h3',{text:row.file.name}));const name=el('input',{type:'text',maxLength:180,value:row.base,ariaLabel:'Individual filename without extension'});const finalName=el('p',{className:'small media-final-name',text:displayName(row)});name.addEventListener('input',()=>{row.base=name.value;finalName.textContent=displayName(row);renderList();});editor.append(field('File name (without extension)',name),finalName);syncCrop();if(row.kind==='other'){editor.append(el('p',{className:'sub small',text:'This file is uploaded unchanged. Conversion is available for images and videos only.'}));return;}
  const choices=[['original','Keep original (no conversion)'],...(row.kind==='image'?formats.images.map(t=>[t,t.split('/')[1].toUpperCase()]):formats.videos.map(v=>[v.mime,v.label,!(o.audio?MediaRecorder.isTypeSupported(v.mime):MediaRecorder.isTypeSupported(v.silent))]))];
  editor.append(select('Output format / codec','format',choices,row,()=>{renderList();renderEditor();}));
  if(o.format!=='original'){
   if(row.kind==='image'){if(o.format!=='image/png')editor.append(number('Quality (%)','quality',row,1,100));editor.append(number('Maximum side (px; 0 = original)','maxSide',row,0,8192));}
   else {editor.append(number('Maximum side (px)','maxSide',row,2,1920),select('Frames per second','fps',[[15,'15'],[24,'24 · recommended'],[30,'30'],[60,'60 · heavier']],row),number('Video bitrate (kbps)','bitrate',row,100,30000,100),check('Keep audio','audio',row,renderEditor));if(o.audio)editor.append(select('Audio bitrate (kbps)','audioBitrate',[[64,'64'],[96,'96'],[128,'128'],[192,'192']],row));}
   editor.append(el('p',{className:'small',text:'Crop: percent to remove from each edge; scaling preserves aspect ratio and never enlarges.'}),el('div',{className:'media-studio-crop-fields'},[['Left','left'],['Top','top'],['Right','right'],['Bottom','bottom']].map(([label,key])=>number(label+' %',key,row,0,99.9,.1))));
  }
  editor.append(el('div',{className:'media-studio-actions'},[el('button',{type:'button',className:'btn sm',text:`Apply settings to all ${row.kind==='image'?'images':'videos'}`,onclick:()=>{try{validateOptions(o,row.kind);for(const r of rows)if(r.kind===row.kind)r.o={...o};notice.textContent='Settings applied to every '+row.kind+' in the batch.';renderList();renderEditor();}catch(e){notice.textContent=e.message;}}})]));
  if(row.kind==='image')editor.append(el('p',{className:'sub small',text:'Image conversion produces a still image. Keep animated GIF/WebP originals to preserve animation.'}));else editor.append(el('p',{className:'sub small',text:'Video conversion runs in real time. Keep this tab visible. Codec availability, exact bitrate, duration metadata and seeking depend on the browser.'}));
 }
 renderList();renderEditor();showPreview();
 return await new Promise(resolve=>{
  function finish(){if(settled)return;settled=true;clearPreview();result.cancelled=cancelled;resolve(result);}
  function requestCancel(){if(running){cancelled=true;if(phase==='converting')controller?.abort();cancel.disabled=true;progressText.textContent=phase==='uploading'?'Finishing current upload, then stopping…':'Cancelling…';}else{cancelled=true;finish();}}
  cancel.addEventListener('click',()=>{if(!running&&result.uploaded.length+result.failures.length)finish();else requestCancel();});dialog.addEventListener('cancel',e=>{e.preventDefault();if(!running&&result.uploaded.length+result.failures.length)finish();else requestCancel();});dialog.addEventListener('keydown',e=>e.stopPropagation());
  start.addEventListener('click',async()=>{
   if(running||settled)return;
   let uploadNames;
   try{uploadNames=rows.map(row=>{validateOptions(row.o,row.kind);return rowName(row);});}catch(e){notice.textContent=failureMessage(e);notice.scrollIntoView({block:'nearest'});console.error('[Media Studio] Invalid settings:',failureMessage(e));return;}
   running=true;start.disabled=true;cancel.textContent='Cancel batch';editor.inert=true;naming.inert=true;clearPreview();renderList();
   if(rows.some(r=>r.kind==='video'&&r.o.format!=='original'&&r.o.audio)){try{const AC=window.AudioContext||window.webkitAudioContext;if(AC){audioContext=new AC();await Promise.race([audioContext.resume(),new Promise(resolve=>setTimeout(resolve,3000))]);}}catch{}}
   for(let i=0;i<rows.length&&!cancelled;i++){
    const row=rows[i];controller=new AbortController();phase='converting';row.status='Converting';renderList();progress.value=i/rows.length;progressText.textContent=`${i+1}/${rows.length} · ${row.file.name} · preparing`;
    try{
     await tick();const prepared=await convert(row.file,row.o,row.kind,controller.signal,p=>{progress.value=(i+p*.8)/rows.length;progressText.textContent=`${i+1}/${rows.length} · ${row.file.name} · ${Math.round(p*100)}% encoding`;},audioContext,dialog,allowedImageTypes);
     if(cancelled)break;phase='uploading';row.status='Uploading';renderList();progressText.textContent=`${i+1}/${rows.length} · uploading ${pretty(prepared.size)}`;
     const renamed=new File([prepared],uploadNames[i],{type:prepared.type,lastModified:prepared.lastModified});
     const uploaded=await upload(renamed);result.uploaded.push(uploaded);row.status=`Uploaded · ${pretty(prepared.size)}`;
    }catch(e){if(cancelled||controller.signal.aborted){row.status='Cancelled';break;}
     const step=phase==='uploading'?'Upload / save':row.o.format==='original'?'Original file validation':'Conversion';
     const message=`${step}: ${failureMessage(e)}`;
     row.status='Failed: '+message;result.failures.push({name:uploadNames[i],message});showErrors();
     console.error('[Media Studio] File failed',{name:uploadNames[i],sourceType:mediaType(row.file),sourceBytes:row.file.size,format:row.o.format,settings:{...row.o},message});
    }
    progress.value=(i+1)/rows.length;renderList();await tick();
   }
   running=false;phase='done';renderList();editor.inert=true;start.hidden=true;cancel.disabled=false;cancel.textContent='Done';progressText.textContent=`${result.uploaded.length} uploaded · ${result.failures.length} failed${cancelled?' · stopped':''}`;notice.textContent=result.failures.length?result.failures.map(f=>`${f.name}: ${f.message}`).join(' | '):'Finished. Only converted outputs (or selected originals) were uploaded.';
   if(audioContext){try{await audioContext.close();}catch{}audioContext=null;}if(rows.length===1&&!result.failures.length)finish();else if(result.failures.length){showErrors();errors.focus({preventScroll:true});errors.scrollIntoView({block:'start'});}
  });
 });
 }finally{if(audioContext)try{await audioContext.close();}catch{}visual?.dispose();dialog?.close();dialog?.remove();studioOpen=false;previousFocus?.focus?.();}
}
