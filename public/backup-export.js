const FALLBACK_LIMIT=64*1024*1024;
const formatBytes=n=>`${(n/1048576).toFixed(1)} MiB`;
let active=false;
function node(tag,text,cls){const n=document.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n;}
function download(blob,filename){const url=URL.createObjectURL(blob),a=node('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}
export async function openBackupExport({getToken,flush}){
 if(active)return;active=true;
 const dialog=node('dialog',null,'dialog');dialog.style.margin='auto';dialog.style.maxHeight='90vh';dialog.setAttribute('aria-label','Export portfolio backup');
 const title=node('h2','Export portfolio backup'),desc=node('p','All application database tables, schema, indexes and rows are exported to SQL. Optionally include original R2 media in a TAR archive. Nothing is changed or deleted.','sub small');
 const fields=node('div',null,'field');fields.append(node('p','Included: full database (drafts, settings, inbox, analytics, media metadata and other application tables).','small'));const choices=[['media','Include original media files from R2 (optional)',false]];
 const inputs=choices.map(([value,label,checked])=>{const row=node('label',null,'inline-checkbox'),input=node('input');input.type='checkbox';input.value=value;input.checked=checked;row.append(input,document.createTextNode(label));fields.append(row);return input;});
 const status=node('p','Keep this backup private. Large exports stream directly to disk on compatible browsers.','sub small');status.setAttribute('aria-live','polite');status.style.overflowWrap='anywhere';
 const progress=node('progress');progress.max=1;progress.value=0;progress.style.width='100%';progress.hidden=true;
 const actions=node('div',null,'hero-ctas'),start=node('button','Download backup','btn primary'),close=node('button','Close','btn');start.type=close.type='button';actions.append(start,close);dialog.append(title,desc,fields,status,progress,actions);document.body.append(dialog);
 const originalFocus=document.activeElement;let controller=null,busy=false;
 const finish=()=>{if(busy){controller?.abort();return;}dialog.close();};
 close.addEventListener('click',finish);dialog.addEventListener('cancel',e=>{e.preventDefault();finish();});dialog.addEventListener('keydown',e=>e.stopPropagation());
 const done=new Promise(resolve=>dialog.addEventListener('close',resolve,{once:true}));
 start.addEventListener('click',async()=>{
  if(busy)return;const parts=['database',...inputs.filter(i=>i.checked).map(i=>i.value)];
  const token=getToken();if(!token){status.textContent='Unlock the dashboard first.';return;}
  const isTar=parts.includes('media'),ext=isTar?'tar':'sql',filename=`portfolio-backup-${new Date().toISOString().replace(/[:.]/g,'-')}.${ext}`;
  busy=true;controller=new AbortController();start.disabled=true;inputs.forEach(i=>i.disabled=true);close.textContent='Cancel';progress.hidden=false;progress.value=0;let writer,reader,committed=false;
  try{
   // Pick a destination synchronously from the user click, before any network await.
   let handle=null;
   if(typeof window.showSaveFilePicker==='function'){
    try{handle=await window.showSaveFilePicker({suggestedName:filename,types:[{description:isTar?'TAR backup':'SQL backup',accept:{[isTar?'application/x-tar':'application/sql']:['.'+ext]}}]});}
    catch(e){if(e.name==='AbortError')throw e;if(!['SecurityError','NotAllowedError','TypeError'].includes(e.name))throw e;}
   }
   if(getToken()!==token||controller.signal.aborted)throw new DOMException('Export cancelled','AbortError');
   status.textContent='Reading saved data from D1…';if(await flush()===false)throw Error('Pending changes could not be saved. Retry after saving.');
   const response=await fetch('/api/admin/export?parts='+encodeURIComponent(parts.join(',')),{headers:{Authorization:'Bearer '+token},cache:'no-store',signal:controller.signal});
   if(!response.ok){let error;try{error=(await response.json()).error;}catch{}throw Error(error||`Export request failed (HTTP ${response.status})`);}
   const total=Number(response.headers.get('X-Export-Bytes'));if(!Number.isSafeInteger(total)||total<=0||!response.body)throw Error('Invalid export response');
   if(!handle&&total>FALLBACK_LIMIT)throw Error('This backup is larger than 64 MiB. Use Chrome/Edge with direct-to-disk saving enabled, or export data without media.');
   if(handle)writer=await handle.createWritable();
   const chunks=[];let count=0;reader=response.body.getReader();
   while(true){if(controller.signal.aborted||getToken()!==token)throw new DOMException('Export cancelled','AbortError');const {done,value}=await reader.read();if(done)break;count+=value.byteLength;if(count>total)throw Error('Export size changed unexpectedly. Retry.');if(writer)await writer.write(value);else chunks.push(value);progress.value=count/total;status.textContent=`Downloading ${formatBytes(count)} / ${formatBytes(total)} · ${Math.floor(count/total*100)}%`;}
   if(count!==total)throw Error('Incomplete backup. Retry the export.');
   if(controller.signal.aborted||getToken()!==token)throw new DOMException('Export cancelled','AbortError');
   if(writer)await writer.close();else download(new Blob(chunks,{type:isTar?'application/x-tar':'application/sql'}),filename);
   committed=true;status.textContent=`Backup downloaded · ${formatBytes(count)}. Store it securely.`;progress.value=1;
  }catch(e){status.textContent=e.name==='AbortError'?'Export cancelled.':`Export failed: ${e.message||String(e)}`;progress.value=0;}
  finally{if(!committed){controller.abort();if(writer)await writer.abort().catch(()=>{});if(reader)await reader.cancel().catch(()=>{});}reader?.releaseLock();controller=null;busy=false;start.disabled=false;inputs.forEach(i=>i.disabled=false);close.textContent='Close';}
 });
 try{dialog.showModal();await done;}finally{dialog.remove();active=false;originalFocus?.focus?.();}
}
