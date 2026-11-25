import {preparePushRegistration,findPushRegistration} from './push-registration.js';
const base='/api/admin/push';
const decode=s=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
const equal=(a,b)=>a&&b&&a.length===b.length&&a.every((v,i)=>v===b[i]);
async function hash(s){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))),v=>v.toString(16).padStart(2,'0')).join('');}
export function pushResultText(r){
 if(r.accepted)return 'Push service accepted the test. Check the selected device.';
 if(r.expired)return 'Subscription expired and was removed. Enable notifications again on that device.';
 const reasons={invalid_endpoint:'Unsupported push provider. Register the device again.',key_mismatch:'The device uses an old VAPID key. Enable again on that device.',signing_failed:'Server could not sign the VAPID request. Check Worker configuration.',timeout:'Push provider did not respond before the timeout.',network_error:'Worker could not connect to the push provider (no HTTP response). Check Worker logs and retry.',provider_rejected:'Push provider rejected the request (HTTP '+r.status+').'};
 return reasons[r.reason]||('Push failed (HTTP '+(r.status||'unavailable')+').');
}
export async function mountPushSettings(root,api){
 if(!root?.isConnected||root.dataset.mounted)return;root.dataset.mounted='true';
 root.innerHTML=`<div class="panel"><h3>This device</h3><p class="sub" data-device-status>Checking…</p><div data-enroll hidden><div class="field"><label>Device name<input data-label maxlength="80" placeholder="My phone"></label></div><button type="button" class="btn primary" data-enable>Enable on this device</button></div><p class="sub small">On iPhone/iPad, open the installed Home Screen app (iOS 16.4+). Use a normal browser, not private browsing.</p></div><div class="panel"><h3>Registered devices</h3><div data-devices>Loading…</div></div><p role="status" aria-live="polite" data-feedback></p>`;
 const $=s=>root.querySelector(s),feedback=s=>{$('[data-feedback]').textContent=s;};
 const enroll=$('[data-enroll]'),enable=$('[data-enable]'),label=$('[data-label]');
 const supported=isSecureContext&&'serviceWorker' in navigator&&'PushManager' in window&&'Notification' in window;
 let config=null,reg=null,sub=null,id=null,busy=false,localError='';
 async function readLocal(){
  reg=null;sub=null;id=null;localError='';if(!supported)return;
  try{reg=await findPushRegistration(navigator.serviceWorker);sub=reg?await reg.pushManager.getSubscription():null;id=sub?await hash(sub.endpoint):null;}
  catch(e){localError=e.name||'Error';}
 }
 function paint(){
  if(!root.isConnected)return;
  const registered=config?.devices.some(d=>d.id===id&&d.active)&&supported&&Notification.permission==='granted';
  enroll.hidden=!config?.configured||!supported||registered||Notification.permission==='denied';
  enable.disabled=busy;
  $('[data-device-status]').textContent=!config?'Unable to load notification settings.':!config.configured?'Web Push is not configured on the server.':!supported?'Web Push is unavailable in this browser.':Notification.permission==='denied'?'Notifications are blocked. Allow notifications in browser settings and reopen this tab.':registered?'Notifications enabled on this device. Test or remove it below.':localError?'Browser registration could not be read ('+localError+'). Enable to try again.':'This device is not registered. Enable notifications to receive new message alerts.';
  const list=$('[data-devices]');list.replaceChildren();
  if(!config?.devices.length){list.textContent=config?'No registered devices.':'Unable to load devices.';return;}
  for(const d of config.devices){
   const row=document.createElement('div');row.className='panel';
   const title=document.createElement('strong');title.textContent=d.label+(id===d.id?' (this device)':'');row.append(title);
   const detail=document.createElement('p');detail.className='sub small';detail.textContent=(d.active?'Registered':'Re-registration required')+(d.created_at?' · '+d.created_at+' UTC':'');row.append(detail);
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
  if(Notification.permission!=='granted'&&await Notification.requestPermission()!=='granted')throw Error('Notification permission was not granted.');
  if(!root.isConnected)return;
  feedback('Preparing this device…');reg=await preparePushRegistration(navigator.serviceWorker);
  if(!root.isConnected)return;
  const key=decode(config.publicKey);let current=await reg.pushManager.getSubscription();
  if(current&&!equal(new Uint8Array(current.options.applicationServerKey||[]),key)){await current.unsubscribe();current=null;}
  current=current||await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:key});
  if(!root.isConnected)return;
  await api(base+'/subscribe',{method:'POST',body:{endpoint:current.endpoint,publicKey:config.publicKey,label:label.value}});
  feedback('Notifications enabled. Use Test next to this device to verify delivery.');
 });
 try{await refresh();}catch(e){feedback(e.message||'Could not load notifications');paint();}
}
