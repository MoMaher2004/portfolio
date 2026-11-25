// HTTP byte ranges for immutable R2 media. Return only the requested slice.
export function parseMediaRange(value,size){
 if(!Number.isSafeInteger(size)||size<1)return null;
 const m=/^bytes=(\d*)-(\d*)$/i.exec(String(value||'').trim());if(!m||(!m[1]&&!m[2]))return null;
 if(!m[1]){const n=Number(m[2]);if(!Number.isSafeInteger(n)||n<=0)return null;const length=Math.min(n,size);return {offset:size-length,length};}
 const start=Number(m[1]),end=m[2]?Number(m[2]):size-1;if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>=size||end<start)return null;
 return {offset:start,length:Math.min(end,size-1)-start+1};
}
export async function serveMedia(req,bucket,row){
 const type=row.mime_type,headers=new Headers({'Content-Type':type,'Cache-Control':type==='application/pdf'?'public, max-age=3600':'public, max-age=31536000, immutable','Accept-Ranges':'bytes'});
 if(type==='application/pdf')headers.set('Content-Disposition','inline');
 const rangeHeader=req.headers.get('Range');let size=Number(row.bytes);
 if(req.method==='HEAD'||rangeHeader){const meta=await bucket.head(row.object_key);if(!meta)return new Response(null,{status:404});size=meta.size;if(meta.httpEtag)headers.set('ETag',meta.httpEtag);}
 if(req.method==='HEAD'){headers.set('Content-Length',String(size));return new Response(null,{headers});}
 const ifRange=req.headers.get('If-Range');const useRange=rangeHeader&&(!ifRange||ifRange===headers.get('ETag'));
 if(useRange){const range=parseMediaRange(rangeHeader,size);if(!range){headers.set('Content-Range',`bytes */${size}`);headers.set('Content-Length','0');return new Response(null,{status:416,headers});}
  const file=await bucket.get(row.object_key,{range});if(!file)return new Response(null,{status:404});
  headers.set('Content-Range',`bytes ${range.offset}-${range.offset+range.length-1}/${size}`);headers.set('Content-Length',String(range.length));return new Response(file.body,{status:206,headers});
 }
 const file=await bucket.get(row.object_key);if(!file)return new Response(null,{status:404});headers.set('Content-Length',String(file.size));if(file.httpEtag)headers.set('ETag',file.httpEtag);return new Response(file.body,{headers});
}
