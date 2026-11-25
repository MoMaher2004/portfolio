// Use the existing active registration without triggering an unnecessary update.
export async function findPushRegistration(container){
 const reg=await container.getRegistration('/admin');
 return reg&&new URL(reg.scope).pathname==='/admin'&&reg.active?.state==='activated'&&new URL(reg.active.scriptURL).pathname==='/push-sw.js'&&reg.pushManager?reg:null;
}
// Wait for the specific registration, not navigator.serviceWorker.ready (which
// can resolve to a different scope or wait indefinitely on an uncontrolled page).
export async function preparePushRegistration(container, {fetcher=fetch, timeout=15000, retryDelay=400}={}) {
 const existing=await findPushRegistration(container);if(existing)return existing;
 const script='/push-sw.js';
 const res=await fetcher(script,{cache:'no-store',redirect:'error'});
 const mime=res.headers.get('Content-Type')||'';
 if(!res.ok||!/(?:java|ecma)script/i.test(mime))throw Error('Service worker script unavailable: HTTP '+res.status+' ('+(mime||'no Content-Type')+'). Check deployment.');
 // Read the response so the diagnostic fetch completes before registration.
 await res.text();
 const deadline=Date.now()+timeout;
 let reg;
 const bounded=async promise=>{
  let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Service worker registration timed out. Check browser settings and retry.')),Math.max(1,deadline-Date.now()));})]);}finally{clearTimeout(timer);}
 };
 for(let attempt=0;attempt<2;attempt++){
  try{reg=await bounded(container.register(script,{scope:'/admin',updateViaCache:'none'}));break;}
  catch(e){if(attempt||e.name!=='AbortError')throw Error('Service worker registration failed ('+(e.name||'Error')+'). Check that browser site storage is allowed, try a normal Chrome/Firefox window (or installed Home Screen app on iOS), and press Enable again. Browser detail: '+e.message);await new Promise(r=>setTimeout(r,retryDelay));}
 }
 while(reg.active?.state!=='activated'){
  if(Date.now()>=deadline)throw Error('Service worker did not activate. Check browser storage settings and retry.');
  if(!reg.installing&&!reg.waiting&&!reg.active)throw Error('Service worker installation failed. Retry registration.');
  await new Promise(r=>setTimeout(r,100));
 }
 if(!reg.pushManager)throw Error('Push API unavailable in this browser context.');
 return reg;
}
