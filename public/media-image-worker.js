import {geometry,MAX_IMAGE_PIXELS} from './media-transform.js';
self.onmessage=async ({data:{file,options}})=>{
 let bitmap,canvas;
 try{
  bitmap=await createImageBitmap(file);
  if(bitmap.width*bitmap.height>MAX_IMAGE_PIXELS)throw Error('Source image exceeds the 24 MP safe decoding limit. Resize externally or upload the original.');
  const g=geometry(bitmap.width,bitmap.height,options);
  canvas=new OffscreenCanvas(g.outWidth,g.outHeight);
  const ctx=canvas.getContext('2d',{alpha:options.format!=='image/jpeg'});
  if(options.format==='image/jpeg'){ctx.fillStyle='#fff';ctx.fillRect(0,0,g.outWidth,g.outHeight);}
  ctx.drawImage(bitmap,g.x,g.y,g.w,g.h,0,0,g.outWidth,g.outHeight);
  bitmap.close();bitmap=null;
  const blob=await canvas.convertToBlob({type:options.format,quality:options.quality/100});
  if(blob.type!==options.format)throw Error('Your browser cannot encode the requested image format.');
  self.postMessage({blob,width:g.outWidth,height:g.outHeight});
 }catch(e){self.postMessage({error:e.message||String(e)})}
 finally{bitmap?.close();if(canvas){canvas.width=1;canvas.height=1;}}
};
