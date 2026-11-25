import {preparePushRegistration,findPushRegistration} from './push-registration.js';
const base='/api/admin/push';
const decode=s=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
const equal=(a,b)=>a&&b&&a.length===b.length&&a.every((v,i)=>v===b[i]);
async function hash(s){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))),v=>v.toString(16).padStart(2,'0')).join('');}
export function pushResultText(r){
 if(r.accepted)return 'Push service accepted the test. Check the selected device.';
 if(r.expired)return 'Subscription expired and was removed. Enable notifications again on that device.';
 const reasons={invalid_endpoint:'Unsupported push provider. Register the device again.',key_mismatch:'The device uses an old VAPID key. Enable again on that device.',encryption_failed:'Server could not encrypt the preview. Remove and re-enable this device.',signing_failed:'Server could not sign the VAPID request. Check Worker configuration.',timeout:'Push provider did not respond before the timeout.',network_error:'Worker could not connect to the push provider (no HTTP response). Check Worker logs and retry.',redirect_rejected:'Push provider returned a redirect (HTTP '+r.status+'). It was not followed for security.',provider_rejected:'Push provider rejected the request (HTTP '+r.status+').'};
 return reasons[r.reason]||('Push failed (HTTP '+(r.status||'unavailable')+').');
}
// Keep the registration action visible when permission is blocked; explain why it cannot proceed.
export function enrollmentState(config,supported,permission,registered,localError=''){
 if(!config)return {show:true,disabled:true,message:'Unable to load notification settings. Reopen this tab to retry.'};
 if(!config.configured)return {show:true,disabled:true,message:'Web Push is not configured on the server.'};
 if(!supported)return {show:true,disabled:true,message:'Web Push is unavailable in this browser. Use a supported normal Chrome, Edge or Firefox window, or the installed Home Screen app on iOS.'};
 if(permission==='denied')return {show:true,disabled:false,message:'Notifications are blocked. Open the site permissions next to the address bar, set Notifications to Allow, then press Enable below.'};
 if(registered)return {show:false,disabled:true,message:'Notifications enabled on this device. Its Test and Remove buttons are in the list below.'};
 return {show:true,disabled:false,message:localError?'Browser registration could not be read ('+localError+'). Enable to try again.':'This device is not registered. Enable notifications to receive new message alerts.'};
}
export async function mountPushSettings(root,api){
 if(!root?.isConnected||root.dataset.mounted)return;root.dataset.mounted='true';
 root.innerHTML=`<div class="panel"><h3>This device</h3><p class="sub" data-device-status>Checking…</p><div data-enroll hidden><div class="field"><label>Device name<input data-label maxlength="80" placeholder="My phone"></label></div><button type="button" class="btn primary" data-enable>Enable on this device</button></div><p class="sub small">Installation is optional on Android and desktop Chrome. On iPhone/iPad, use the installed Home Screen app (iOS 16.4+). Use a normal browser, not private browsing. Message previews may be visible on your lock screen.</p><div data-upgrade-wrap hidden><button type="button" class="btn primary" data-upgrade>Enable message previews</button></div></div><div class="panel"><h3>Registered devices</h3><div data-devices>Loading…</div></div><p role="status" aria-live="polite" data-feedback></p>`;
 const $=s=>root.querySelector(s),feedback=s=>{$('[data-feedback]').textContent=s;};
 const enroll=$('[data-enroll]'),enable=$('[data-enable]'),label=$('[data-label]'),upgrade=$('[data-upgrade]');
 const supported=isSecureContext&&'serviceWorker' in navigator&&'PushManager' in window&&'Notification' in window;
 let config=null,reg=null,sub=null,id=null,busy=false,localError='';
 async function readLocal(){
  reg=null;sub=null;id=null;localError='';if(!supported)return;
  try{reg=await findPushRegistration(navigator.serviceWorker);sub=reg?await reg.pushManager.getSubscription():null;id=sub?await hash(sub.endpoint):null;}
  catch(e){localError=e.name||'Error';}
 }
 function paint(){
  if(!root.isConnected)return;
  const permission=supported?Notification.permission:'unavailable';
  const keyMatches=sub&&config?.publicKey&&equal(new Uint8Array(sub.options.applicationServerKey||[]),decode(config.publicKey));
  const registered=Boolean(config?.devices.some(d=>d.id===id&&d.active)&&keyMatches&&permission==='granted');
  const state=enrollmentState(config,supported,permission,registered,localError);
  enroll.hidden=!state.show;
  enable.disabled=busy||state.disabled;
  const currentDevice=config?.devices.find(d=>d.id===id);
  $('[data-upgrade-wrap]').hidden=!registered||Boolean(currentDevice?.preview);upgrade.disabled=busy;
  $('[data-device-status]').textContent=state.message;
  const list=$('[data-devices]');list.replaceChildren();
  if(!config?.devices.length){list.textContent=config?'No registered devices.':'Unable to load devices.';return;}
  for(const d of config.devices){
   const row=document.createElement('div');row.className='panel';
   const title=document.createElement('strong');title.textContent=d.label+(id===d.id?' (this device)':'');row.append(title);
   const detail=document.createElement('p');detail.className='sub small';detail.textContent=(d.active?(d.preview?'Registered · message previews enabled':'Registered · generic alerts only'):'Re-registration required')+(d.created_at?' · '+d.created_at+' UTC':'');row.append(detail);
   const actions=document.createElement('div');actions.className='hero-ctas';
   for(const [name,action] of [['Test',async()=>{feedback(pushResultText(await api(base+'/devices/'+d.id+'/test',{method:'POST'})));}],['Remove',async()=>{await api(base+'/devices/'+d.id,{method:'DELETE'});if(id===d.id&&sub){try{await sub.unsubscribe();}catch{feedback('Server subscription removed; browser unsubscribe failed.');return;}}feedback('Device removed.');}]]){
    const button=document.createElement('button');button.type='button';button.className='btn sm'+(name==='Remove'?' danger':'');button.textContent=name;button.disabled=busy||(name==='Test'&&!d.active);button.onclick=()=>run(action);actions.append(button);
   }row.append(actions);list.append(row);
  }
 }
 async function refresh(){config=await api(base);await readLocal();paint();}
 async function run(action){if(busy||!root.isConnected)return;busy=true;paint();feedback('Working…');try{await action();}catch(e){feedback(e.message||'Operation failed');}finally{busy=false;if(root.isConnected){try{await refresh();}catch(e){feedback(e.message||'Could not refresh devices');paint();}}}}
 enable.onclick=()=>run(async()=>{
  // Permission request is made in the actual click gesture. No registration on page load.
  if(Notification.permission==='denied')throw Error('Notifications are blocked. Set Notifications to Allow in the site permissions, then press Enable again.');
  if(Notification.permission!=='granted'&&await Notification.requestPermission()!=='granted')throw Error('Notification permission was not granted. Check the site permissions.');
  if(!root.isConnected)return;
  feedback('Preparing this device…');reg=await preparePushRegistration(navigator.serviceWorker);
  if(!root.isConnected)return;
  const key=decode(config.publicKey);let current=await reg.pushManager.getSubscription();
  if(current&&!equal(new Uint8Array(current.options.applicationServerKey||[]),key)){await current.unsubscribe();current=null;}
  current=current||await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:key});
  if(!root.isConnected)return;
  await saveSubscription(current,label.value);
  feedback('Notifications enabled. Use Test next to this device to verify delivery.');
 });
 async function saveSubscription(current,deviceLabel){
  const keys=current.toJSON().keys;
  if(!keys?.p256dh||!keys?.auth)throw Error('Browser did not provide Web Push encryption keys.');
  await api(base+'/subscribe',{method:'POST',body:{endpoint:current.endpoint,publicKey:config.publicKey,label:deviceLabel,keys:{p256dh:keys.p256dh,auth:keys.auth}}});
 }
 upgrade.onclick=()=>run(async()=>{
  const currentDevice=config?.devices.find(d=>d.id===id&&d.active);
  if(!sub||!currentDevice)throw Error('Current device is not registered.');
  await reg.update().catch(()=>{});
  await saveSubscription(sub,currentDevice.label);
  feedback('Message previews enabled. Use Test to check; reopen this page if the old generic alert still appears.');
 });
 try{await refresh();}catch(e){feedback(e.message||'Could not load notifications');paint();}
}
