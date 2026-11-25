// Dedicated admin service worker: no fetch handler, no token, no caching.
self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('push',event=>event.waitUntil(self.registration.showNotification('Portfolio inbox',{
 body:'New inbox activity. Tap to check your messages.',icon:new URL('/push-icon-192.png',self.location.origin).href,
 data:{url:'/admin?tab=inbox'}
})));
self.addEventListener('notificationclick',event=>{
 event.notification.close();
 const target=new URL('/admin?tab=inbox',self.location.origin).href;
 event.waitUntil((async()=>{
  const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
  const existing=windows.find(c=>c.url===target);
  if(existing){await existing.focus();return;}
  await self.clients.openWindow(target);
 })());
});
