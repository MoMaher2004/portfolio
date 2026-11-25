import {preparePushRegistration} from './push-registration.js';
const base='/api/admin/push';
const decode=s=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
const equal=(a,b)=>a&&b&&a.length===b.length&&a.every((v,i)=>v===b[i]);
async function hash(s){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))),v=>v.toString(16).padStart(2,'0')).join('');}
export async function openPushSettings(api){
 if(document.querySelector('#push-settings'))return;
 const dialog=document.createElement('dialog');dialog.id='push-settings';dialog.className='dialog';dialog.style.maxWidth='min(560px, 92vw)';
 dialog.innerHTML=`<div class="dialog-head"><h2>Web Push notifications</h2><button type="button" class="round" data-close aria-label="Close">✕</button></div><p class="sub">Receive a private, generic notification when a contact message is saved. No message contents are sent to push providers.</p><p data-status role="status">Loading…</p><div class="field"><label>Device name<input data-label maxlength="80" placeholder="My phone"></label></div><div class="hero-ctas"><button class="btn primary" data-enable disabled>Enable on this device</button><button class="btn" data-disable disabled>Disable this device</button><button class="btn" data-retry>Retry registration</button><button class="btn" data-local disabled>Test local notification</button></div><h3>Registered devices</h3><div data-devices></div><p class="sub small">On iPhone/iPad, add /admin to Home Screen first (iOS 16.4+). Test on a registered device sends a real push via the browser provider. Test local notification checks only notification display. If registration is aborted, use a normal browser window (not private mode or an in-app browser), then retry.</p>`;
 const $=s=>dialog.querySelector(s),status=s=>{$('[data-status]').textContent=s;};
 dialog.querySelector('[data-close]').onclick=()=>dialog.close();dialog.addEventListener('close',()=>dialog.remove(),{once:true});document.body.append(dialog);dialog.showModal();
 let config,reg,sub,busy=false;
 const enable=$('[data-enable]'),disable=$('[data-disable]'),retry=$('[data-retry]'),local=$('[data-local]');
 const supported=isSecureContext&&'serviceWorker' in navigator&&'PushManager' in window&&'Notification' in window;
 async function refresh(){
  config=await api(base);sub=reg?await reg.pushManager.getSubscription():null;
  const id=sub?await hash(sub.endpoint):null;const registered=config.devices.some(d=>d.id===id&&d.active);
  enable.disabled=busy||!supported||!config.configured||!reg||registered;disable.disabled=busy||!sub;retry.disabled=busy||!supported||!config.configured;local.disabled=busy||!reg||Notification.permission!=='granted';
  const list=$('[data-devices]');list.replaceChildren();
  if(!config.devices.length)list.textContent='No registered devices.';
  for(const d of config.devices){
   const row=document.createElement('div');row.className='panel';const title=document.createElement('p');title.textContent=d.label+(id===d.id?' (this device)':'')+(d.active?'':' — old key');row.append(title);
   for(const [label,action] of [['Test',async()=>{const r=await api(base+'/devices/'+d.id+'/test',{method:'POST'});status(r.accepted?'Accepted by push service; check your device.':'Push not accepted (status '+r.status+'). Re-enable if expired.');}],['Remove',async()=>{await api(base+'/devices/'+d.id,{method:'DELETE'});if(sub&&id===d.id)await sub.unsubscribe();status('Device removed.');}]]){
    const button=document.createElement('button');button.type='button';button.className='btn sm';button.textContent=label;button.disabled=busy||label==='Test'&&!d.active;button.onclick=()=>run(action);row.append(button);
   }list.append(row);
  }
  return registered;
 }
 async function run(action){if(busy)return;busy=true;enable.disabled=disable.disabled=retry.disabled=local.disabled=true;for(const button of $('[data-devices]').querySelectorAll('button'))button.disabled=true;try{await action();}catch(e){status(e.message||'Operation failed');}finally{busy=false;try{await refresh();}catch(e){status(e.message||'Could not refresh devices');}}}
 enable.onclick=()=>run(async()=>{
  // Request permission directly inside the click handler, before other awaits.
  if(Notification.permission!=='granted'&&await Notification.requestPermission()!=='granted')throw Error('Notification permission was not granted. Check browser settings.');
  const key=decode(config.publicKey);let current=await reg.pushManager.getSubscription();
  if(current&&!equal(new Uint8Array(current.options.applicationServerKey||[]),key)){await current.unsubscribe();current=null;}
  current=current||await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:key});
  await api(base+'/subscribe',{method:'POST',body:{endpoint:current.endpoint,publicKey:config.publicKey,label:$('[data-label]').value}});status('Notifications enabled on this device. Use Test to verify delivery.');
 });
 disable.onclick=()=>run(async()=>{if(!sub)return;await api(base+'/devices/'+await hash(sub.endpoint),{method:'DELETE'});await sub.unsubscribe();status('Notifications disabled on this device.');});
 async function initialize(){
  config=await api(base);
  if(!config.configured){status('Set PUSH_VAPID_JWK in Cloudflare first.');return;}
  if(!supported){status('Web Push unavailable here. Use a supported normal browser or an installed Home Screen app on iOS.');return;}
  status('Registering service worker…');
  reg=await preparePushRegistration(navigator.serviceWorker);
  const registered=await refresh();
  status(registered?'Notifications enabled on this device. Use Test in Registered devices.':'Service worker active. Enable notifications on this device to register with the server.');
 }
 retry.onclick=()=>run(initialize);
 local.onclick=()=>run(async()=>{
  if(!reg||Notification.permission!=='granted')throw Error('Enable notifications first.');
  await reg.showNotification('Portfolio local test',{body:'Local notification display works. This is not a remote push.',icon:'/push-icon-192.png'});
  status('Local notification requested. Use Test in Registered devices for real push delivery.');
 });
 await run(initialize);
}
