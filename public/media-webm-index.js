// Rebuild the small WebM metadata/index, never decode or re-encode the payload.
// The source is bounded by the existing upload limit; cluster payloads use Blob slices.
const ID={EBML:0x1a45dfa3,Segment:0x18538067,SeekHead:0x114d9b74,Info:0x1549a966,Tracks:0x1654ae6b,Cluster:0x1f43b675,Cues:0x1c53bb6b,Tags:0x1254c367,Attachments:0x1941a469,Chapters:0x1043a770};
const level1=new Set(Object.values(ID).filter(x=>x!==ID.EBML&&x!==ID.Segment));
const invalid=()=>Error('Invalid or unsupported WebM structure; use the original MP4 or a standard WebM file.');
function vint(a,p,isId=false){if(p>=a.length||!a[p])throw invalid();let n=1,mask=128;while(!(a[p]&mask)){mask>>=1;n++;}if(n>(isId?4:8)||p+n>a.length)throw invalid();let value=BigInt(isId?a[p]:a[p]& (mask-1));for(let i=1;i<n;i++)value=value*256n+BigInt(a[p+i]);const unknown=!isId&&value===(1n<<BigInt(7*n))-1n;if(!unknown&&value>BigInt(Number.MAX_SAFE_INTEGER))throw invalid();return {value:Number(value),n,unknown};}
function header(a,p,limit){const i=vint(a,p,true),s=vint(a,p+i.n);const start=p+i.n+s.n,end=s.unknown?limit:start+s.value;if(start>limit||end>limit||end<start)throw invalid();return {id:i.value,p,start,end,unknown:s.unknown};}
function uint(a,s,e){if(e-s<1||e-s>8)throw invalid();let v=0;for(let i=s;i<e;i++)v=v*256+a[i];if(!Number.isSafeInteger(v))throw invalid();return v;}
function children(a,s,e){const out=[];for(let p=s;p<e;){const x=header(a,p,e);if(x.unknown||x.end<=p)throw invalid();out.push(x);p=x.end;if(out.length>1000000)throw invalid();}return out;}
const idBytes=n=>{const a=[];do{a.unshift(n&255);n=Math.floor(n/256);}while(n);return Uint8Array.from(a);};
function sizeBytes(n){let width=1;while(BigInt(n)>=(1n<<BigInt(7*width))-1n)width++;let v=BigInt(n)|(1n<<BigInt(7*width));const a=new Uint8Array(width);for(let i=width-1;i>=0;i--){a[i]=Number(v&255n);v>>=8n;}return a;}
function uBytes(n,width=0){let v=BigInt(n);if(!width){width=1;while(v>=(1n<<BigInt(8*width)))width++;}const a=new Uint8Array(width);for(let i=width-1;i>=0;i--){a[i]=Number(v&255n);v>>=8n;}return a;}
function element(id,...parts){const body=new Blob(parts);return new Blob([idBytes(id),sizeBytes(body.size),body]);}
const uElement=(id,n,width)=>element(id,uBytes(n,width));
const float64=n=>{const a=new ArrayBuffer(8);new DataView(a).setFloat64(0,n);return a;};
function readFloat(a,x){const n=x.end-x.start,d=new DataView(a.buffer,a.byteOffset+x.start,n);return n===4?d.getFloat32(0):n===8?d.getFloat64(0):NaN;}
const yieldTask=()=>new Promise(resolve=>setTimeout(resolve,0));
function block(a,x){const t=vint(a,x.start),p=x.start+t.n;if(p+3>x.end||t.unknown)throw invalid();return {track:t.value,time:new DataView(a.buffer,a.byteOffset+p,2).getInt16(0),key:!!(a[p+2]&128)};}
function seekEntry(id,pos){return element(0x4dbb,element(0x53ab,idBytes(id)),uElement(0x53ac,pos,8));}
function cueEntry(time,track,pos){return element(0xbb,uElement(0xb3,time),element(0xb7,uElement(0xf7,track),uElement(0xf1,pos,8)));}
// durationSeconds is only a fallback for browser-produced recordings with missing final-frame duration.
export async function indexWebM(blob,{durationSeconds,signal,force=false}={}){
 if(blob.size<=0||blob.size>90*1024*1024)throw Error('WebM indexing requires a file within the 90 MiB upload limit.');
 const abort=()=>{if(signal?.aborted)throw new DOMException('Conversion cancelled','AbortError');};abort();
 const a=new Uint8Array(await blob.arrayBuffer());abort();
 const top=header(a,0,a.length);if(top.id!==ID.EBML||top.unknown)throw invalid();
 const seg=header(a,top.end,a.length);if(seg.id!==ID.Segment||seg.end!==a.length)throw invalid();
 let info,tracks,oldCues,oldSeek;const clusters=[],extras=[];
 const slice=x=>blob.slice(x.p,x.end);
 for(let p=seg.start;p<seg.end;){abort();const x=header(a,p,seg.end);
  if(x.id===ID.Cluster){let end=x.end;if(x.unknown){let q=x.start;while(q<end){const c=header(a,q,end);if(level1.has(c.id)){end=q;break;}if(c.unknown||c.end<=q)throw invalid();q=c.end;}}clusters.push({...x,end});x.end=end;}
  else {if(x.unknown)throw invalid();if(x.id===ID.Info)info=x;else if(x.id===ID.Tracks)tracks=x;else if(x.id===ID.Cues)oldCues=x;else if(x.id===ID.SeekHead)oldSeek=x;else if([ID.Tags,ID.Chapters,ID.Attachments].includes(x.id))extras.push(slice(x));}
  if(x.end<=p)throw invalid();p=x.end;if(clusters.length&&clusters.length%64===0)await yieldTask();
 }
 if(!info||!tracks||!clusters.length)throw invalid();
 const fields=children(a,info.start,info.end),scaleField=fields.find(x=>x.id===0x2ad7b1),scale=scaleField?uint(a,scaleField.start,scaleField.end):1000000;
 if(!scale)throw invalid();const oldDuration=fields.find(x=>x.id===0x4489),duration=oldDuration?readFloat(a,oldDuration):NaN;
 // Standard, indexed files need no rewrite. Avoid altering original bytes unnecessarily.
 if(!force&&oldSeek&&oldCues&&Number.isFinite(duration)&&duration>0)return blob;
 const trackMap=new Map();let videoTrack;
 for(const entry of children(a,tracks.start,tracks.end).filter(x=>x.id===0xae)){const f=children(a,entry.start,entry.end),read=id=>{const v=f.find(x=>x.id===id);return v?uint(a,v.start,v.end):0;};const number=read(0xd7),type=read(0x83),defaultNs=read(0x23e383);if(number){trackMap.set(number,{type,defaultNs});if(type===1&&videoTrack===undefined)videoTrack=number;}}
 if(videoTrack===undefined)throw Error('No video track found in WebM.');
 let maxEnd=0;const previous=new Map(),steps=new Map(),index=[];let processed=0;
 for(const cluster of clusters){abort();const parts=children(a,cluster.start,cluster.end),tc=parts.find(x=>x.id===0xe7);if(!tc)throw invalid();const base=uint(a,tc.start,tc.end);let firstKey=null;
  for(const item of parts){let b,blockDuration=0;if(item.id===0xa3)b=block(a,item);else if(item.id===0xa0){const f=children(a,item.start,item.end),v=f.find(x=>x.id===0xa1),d=f.find(x=>x.id===0x9b);if(!v)continue;b=block(a,v);b.key=!f.some(x=>x.id===0xfb);if(d)blockDuration=uint(a,d.start,d.end);}else continue;
   const t=base+b.time;if(t<0)continue;const prev=previous.get(b.track),dt=t-prev;if(Number.isFinite(dt)&&dt>0&&dt<1000*1000000/scale)steps.set(b.track,dt);previous.set(b.track,t);const track=trackMap.get(b.track),guess=track?.defaultNs?track.defaultNs/scale:steps.get(b.track)||(track?.type===2?20000000:33333333)/scale;
   maxEnd=Math.max(maxEnd,t+(blockDuration||guess));if(b.track===videoTrack&&b.key&&firstKey===null)firstKey=t;
  }
  // Rebuild cluster headers (including unknown-sized clusters), dropping stale segment-relative offsets and CRCs.
  const stale=parts.some(x=>[0xa7,0xab,0xbf].includes(x.id));const payload=stale?parts.filter(x=>![0xa7,0xab,0xbf].includes(x.id)).map(slice):[blob.slice(cluster.start,cluster.end)];const data=element(ID.Cluster,...payload);index.push({data,time:firstKey});if(++processed%32===0)await yieldTask();
 }
 if(!index.some(x=>x.time!==null))throw Error('No video keyframe found for seek index.');
 const observed=maxEnd*scale/1e9;const fallback=Number(durationSeconds);const seconds=Number.isFinite(duration)&&duration>0?duration*scale/1e9:Number.isFinite(fallback)&&fallback>0&&Math.abs(fallback-observed)<Math.max(.25,observed*.01)?Math.max(fallback,observed):observed;
 if(!Number.isFinite(seconds)||seconds<=0)throw invalid();
 const newInfo=element(ID.Info,...fields.filter(x=>![0x4489,0xbf].includes(x.id)).map(slice),element(0x4489,float64(seconds*1e9/scale)));
 const trackData=slice(tracks),seekAt=(infoAt,tracksAt,cuesAt)=>element(ID.SeekHead,seekEntry(ID.Info,infoAt),seekEntry(ID.Tracks,tracksAt),seekEntry(ID.Cues,cuesAt));
 const seekSize=seekAt(0,0,0).size,infoAt=seekSize,tracksAt=infoAt+newInfo.size,cuesAt=tracksAt+trackData.size;
 const buildCues=start=>{let pos=start;const entries=[];for(const item of index){if(item.time!==null)entries.push(cueEntry(item.time,videoTrack,pos));pos+=item.data.size;}return element(ID.Cues,...entries);};
 const cuesSize=buildCues(0).size,cues=buildCues(cuesAt+cuesSize);abort();
 const result=new Blob([slice(top),element(ID.Segment,seekAt(infoAt,tracksAt,cuesAt),newInfo,trackData,cues,...index.map(x=>x.data),...extras)],{type:'video/webm'});
 if(result.size>90*1024*1024)throw Error('Indexed WebM exceeds the upload limit.');return result;
}
