// Pure helpers shared by the media studio and its image worker.
export const MAX_UPLOAD = 90 * 1024 * 1024;
export const MAX_IMAGE_PIXELS = 24_000_000;
export const IMAGE_TYPES = ['image/webp','image/jpeg','image/png','image/avif'];
export const ORIGINAL_TYPES = new Set([...IMAGE_TYPES,'image/gif','video/mp4','video/webm','application/pdf','application/json','text/plain']);
export const VIDEO_FORMATS = [
 {label:'MP4 · H.264 / AAC', mime:'video/mp4;codecs=avc1.42001f,mp4a.40.2', silent:'video/mp4;codecs=avc1.42001f', ext:'mp4'},
 {label:'WebM · VP8 / Opus (lighter)', mime:'video/webm;codecs=vp8,opus', silent:'video/webm;codecs=vp8', ext:'webm'},
 {label:'WebM · VP9 / Opus', mime:'video/webm;codecs=vp9,opus', silent:'video/webm;codecs=vp9', ext:'webm'},
];
const EXT_TYPES = {jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp',gif:'image/gif',avif:'image/avif',bmp:'image/bmp',svg:'image/svg+xml',heic:'image/heic',heif:'image/heif',mp4:'video/mp4',webm:'video/webm',mov:'video/quicktime',mkv:'video/x-matroska',avi:'video/x-msvideo',mpeg:'video/mpeg',mpg:'video/mpeg',m4v:'video/mp4',pdf:'application/pdf',json:'application/json',txt:'text/plain'};
export function mediaType(file){return (file.type||EXT_TYPES[file.name.split('.').pop().toLowerCase()]||'').toLowerCase().split(';')[0];}
export function mediaKind(file){const t=mediaType(file);return t.startsWith('image/')?'image':t.startsWith('video/')?'video':'other';}
export function mimeBase(mime){return mime.toLowerCase().split(';')[0];}
export function outputName(name,ext){return (name.replace(/\.[^.\/]+$/,'')||'media')+'.'+ext;}
// Relative axis scales preserve sensible bulk settings across different source sizes.
export function axisScales(cropWidth,cropHeight,outWidth,outHeight){
 const axis=(value,source)=>{if(!Number.isFinite(value)||value<=0)throw Error('Enter a positive output dimension.');return Math.min(100,100*value/source);};
 return {scaleX:axis(outWidth,cropWidth),scaleY:axis(outHeight,cropHeight)};
}
export function geometry(width,height,options={},video=false){
 if(!Number.isFinite(width)||!Number.isFinite(height)||width<1||height<1)throw Error('Invalid source dimensions');
 const crop=['left','top','right','bottom'].map(k=>Number(options[k]??0));
 if(crop.some(n=>!Number.isFinite(n)||n<0||n>=100)||crop[0]+crop[2]>=100||crop[1]+crop[3]>=100)throw Error('Crop must leave a non-empty area.');
 const [l,t,r,b]=crop;const x=Math.floor(width*l/100),y=Math.floor(height*t/100);
 const w=Math.max(1,Math.ceil(width*(100-r)/100)-x),h=Math.max(1,Math.ceil(height*(100-b)/100)-y);
 const max=Number(options.maxSide||0);if(!Number.isFinite(max)||max<0||max>8192)throw Error('Invalid maximum side');
 const scale=max?Math.min(1,max/Math.max(w,h)):1;
 let outWidth=Math.max(1,Math.round(w*scale)),outHeight=Math.max(1,Math.round(h*scale));
 if(options.scaleX!==undefined||options.scaleY!==undefined){
  const xScale=Number(options.scaleX??100),yScale=Number(options.scaleY??100);
  if(!Number.isFinite(xScale)||!Number.isFinite(yScale)||xScale<=0||yScale<=0||xScale>100||yScale>100)throw Error('Scale must be greater than 0% and at most 100% on each axis.');
  const wantedW=w*xScale/100,wantedH=h*yScale/100;
  const limit=video?1920:8192,area=video?1920*1080:MAX_IMAGE_PIXELS;
  const fit=Math.min(1,limit/Math.max(wantedW,wantedH),Math.sqrt(area/(wantedW*wantedH)));
  outWidth=Math.max(1,Math.floor(wantedW*fit+1e-7));outHeight=Math.max(1,Math.floor(wantedH*fit+1e-7));
  if(video&&w>=2&&h>=2){outWidth=Math.max(2,outWidth);outHeight=Math.max(2,outHeight);}
 }
 if(video){outWidth=Math.floor(outWidth/2)*2;outHeight=Math.floor(outHeight/2)*2;if(outWidth<2||outHeight<2)throw Error('Video crop is too small.');}
 if(outWidth*outHeight>MAX_IMAGE_PIXELS||Math.max(outWidth,outHeight)>8192)throw Error('Output is too large. Choose smaller output dimensions.');
 return {x,y,w,h,outWidth,outHeight};
}
export function defaults(file,formats){const k=mediaKind(file);return {format:k==='image'?(mediaType(file)==='image/gif'?'original':formats.images.includes('image/webp')?'image/webp':formats.images[0]||'original'):k==='video'?formats.videos[0]?.mime||'original':'original',quality:85,scaleX:null,scaleY:null,left:0,top:0,right:0,bottom:0,fps:24,autoBitrate:true,bitrate:1500,audio:formats.videos.length?formats.videos[0].audioSupported!==false:true,audioBitrate:96};}
export function validateOptions(o,kind){if(o.format==='original')return;geometry(1000,1000,o);if(kind==='image'&&(!IMAGE_TYPES.includes(o.format)||!Number.isFinite(+o.quality)||+o.quality<1||+o.quality>100))throw Error('Invalid image encoding settings');if(kind==='video'&&(!VIDEO_FORMATS.some(v=>v.mime===o.format)||(!o.autoBitrate&&(!Number.isFinite(+o.bitrate)||+o.bitrate<100||+o.bitrate>30000))||![15,24,30,60].includes(+o.fps)||![64,96,128,192].includes(+o.audioBitrate)))throw Error('Invalid video encoding settings');}
export function checkUpload(file, allowed){const type=mediaType(file);if(!ORIGINAL_TYPES.has(type)||(allowed&&!allowed.includes(type)))throw Error('This output format is not supported by the portfolio. Choose a supported conversion format.');if(!file.size)throw Error('Empty file');if(file.size>MAX_UPLOAD)throw Error('Output exceeds the 90 MiB upload limit. Reduce resolution or quality.');return file.type===type?file:new File([file],file.name,{type});}

// File size is the total source bitrate (video, audio and container overhead).
// Aim below both the source size and upload limit; MediaRecorder rates are targets, not guarantees.
export function videoBudget(sourceBytes,duration,o){
 if(!Number.isFinite(sourceBytes)||sourceBytes<=0||!Number.isFinite(duration)||duration<=0)throw Error('A finite source size and duration are required to estimate bitrate.');
 const sourceKbps=sourceBytes*8/duration/1000;
 let videoKbps=Number(o.bitrate),audioKbps=o.audio?Number(o.audioBitrate):0;
 if(o.autoBitrate){
  const budget=Math.floor(Math.min(sourceBytes*.80,MAX_UPLOAD*.90)*8/duration/1000);
  audioKbps=o.audio?Math.min(Number(o.audioBitrate)||96,Math.max(6,Math.floor(budget*.25))):0;
  videoKbps=Math.min(1500,budget-audioKbps);
  if(videoKbps<1)throw Error('Source bitrate is too low to compress automatically with these audio settings. Keep original, disable audio, or choose manual bitrate.');
 }
 if(!Number.isFinite(videoKbps)||videoKbps<=0||!Number.isFinite(audioKbps)||audioKbps<0)throw Error('Invalid bitrate settings.');
 const estimatedBytes=(videoKbps+audioKbps)*1000/8*duration;
 return {sourceKbps,videoKbps,audioKbps,estimatedBytes};
}
