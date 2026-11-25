// Read-only, authenticated export. No R2 object is loaded fully into Worker memory.
import {buildSqlBackup} from './sql-backup.js';
const encoder=new TextEncoder();
const BLOCK=512;
const flags=new Set(['database','media']);
const padded=n=>Math.ceil(n/BLOCK)*BLOCK;
const archiveSize=(size)=>BLOCK+padded(size);
const validSize=n=>Number.isSafeInteger(n)&&n>=0&&n<=0o77777777777;

export function parseExportParts(value){
 const parts=new Set(String(value||'').split(',').filter(Boolean));
 if(!parts.has('database')||[...parts].some(p=>!flags.has(p)))throw Error('Select database, optionally with media (parts=database,media).');
 return parts;
}

function mediaEntry(row){
 // Keep original object IDs/extensions; original display names live in backup.sql.
 // Never place an arbitrary user-controlled filename or path in a TAR header.
 const id=String(row.id||''),key=String(row.object_key||'');
 if(!/^[0-9a-f-]{36}$/i.test(id)||!key.startsWith('media/'+id+'.')||!/^media\/[0-9a-f-]{36}\.[a-z0-9]{1,12}$/i.test(key))throw Error('Invalid stored media path: '+id);
 const size=Number(row.bytes);if(!validSize(size))throw Error('Invalid stored media size: '+id);
 return {...row,bytes:size,archive_path:key};
}

export function tarHeader(path,size,mtime){
 if(!/^[a-zA-Z0-9._/-]+$/.test(path)||path.startsWith('/')||path.split('/').some(p=>p==='..'||p==='.')||path.length>100||!validSize(size))throw Error('Invalid TAR entry');
 const h=new Uint8Array(BLOCK);
 const write=(offset,text)=>h.set(encoder.encode(text),offset);
 const oct=(offset,length,n)=>{const v=n.toString(8).padStart(length-1,'0');if(v.length>=length)throw Error('TAR field overflow');write(offset,v+'\0');};
 write(0,path);oct(100,8,0o644);oct(108,8,0);oct(116,8,0);oct(124,12,size);oct(136,12,mtime);
 h.fill(32,148,156);h[156]=48;write(257,'ustar\0');write(263,'00');
 const sum=h.reduce((total,b)=>total+b,0);write(148,sum.toString(8).padStart(6,'0')+'\0 ');
 return h;
}

export async function* tarChunks(env,manifest,files,mtime){
 yield tarHeader('backup.sql',manifest.byteLength,mtime);yield manifest;
 if(padded(manifest.byteLength)>manifest.byteLength)yield new Uint8Array(padded(manifest.byteLength)-manifest.byteLength);
 for(const file of files){
  const object=await env.FILES.get(file.object_key);
  if(!object||object.size!==file.bytes){await object?.body?.cancel();throw Error('Media missing or changed during export: '+file.id);}
  const reader=object.body.getReader();let total=0,complete=false;
  try{
   yield tarHeader(file.archive_path,file.bytes,mtime);
   while(true){const {done,value}=await reader.read();if(done){complete=true;break;}total+=value.byteLength;if(total>file.bytes)throw Error('Unexpected media size: '+file.id);yield value;}
   if(total!==file.bytes)throw Error('Incomplete media: '+file.id);
  }finally{if(!complete)await reader.cancel().catch(()=>{});reader.releaseLock();}
  if(padded(file.bytes)>file.bytes)yield new Uint8Array(padded(file.bytes)-file.bytes);
 }
 yield new Uint8Array(2*BLOCK);
}

function streamIterator(iterator){
 return new ReadableStream({async pull(controller){try{const {done,value}=await iterator.next();if(done)controller.close();else controller.enqueue(value);}catch(error){controller.error(error);}},async cancel(){await iterator.return?.();}},{highWaterMark:0});
}

export async function exportBackup(env,query){
 let parts;try{parts=parseExportParts(query);}catch(e){return new Response(JSON.stringify({error:e.message}),{status:400,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});}
 const isTar=parts.has('media');
 const {sql:manifest,media}=await buildSqlBackup(env.DB,{mediaIncluded:isTar});
 const files=media.map(mediaEntry);
 const now=new Date(),stamp=now.toISOString().replace(/[:.]/g,'-');
 const size=isTar?archiveSize(manifest.byteLength)+files.reduce((n,f)=>n+archiveSize(f.bytes),0)+2*BLOCK:manifest.byteLength;
 if(!Number.isSafeInteger(size))throw Error('Backup exceeds safe archive size');
 const headers={'Content-Type':isTar?'application/x-tar':'application/sql; charset=utf-8','Content-Disposition':`attachment; filename="portfolio-backup-${stamp}.${isTar?'tar':'sql'}"`,'Cache-Control':'private, no-store','X-Export-Bytes':String(size),'X-Content-Type-Options':'nosniff'};
 if(!isTar)return new Response(manifest,{headers});
 return new Response(streamIterator(tarChunks(env,manifest,files,Math.floor(now.getTime()/1000))),{headers});
}
