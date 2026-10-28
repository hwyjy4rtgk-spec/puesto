// App shell offline: la app abre aunque no haya señal. Los datos van por Supabase y no se cachean aquí.
const V='puesto-v3';
const SHELL=['./','./index.html','./styles.css','./app.js','./config.js','./vendor/supabase.js','./vendor/591.supabase.js','./icon.svg','./manifest.webmanifest'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(V).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==V).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
  const u=new URL(e.request.url);
  if(e.request.method!=='GET')return;
  const shell=u.origin===location.origin;
  const fonts=/fonts\.(googleapis|gstatic)\.com$/.test(u.hostname);
  if(!shell&&!fonts)return;
  // stale-while-revalidate
  e.respondWith(caches.open(V).then(async c=>{
    const req=shell&&e.request.mode==='navigate'?new URL('./index.html',self.registration.scope).href:e.request;
    const hit=await c.match(req);
    const net=fetch(e.request).then(r=>{if(r&&(r.ok||r.type==='opaque'))c.put(req,r.clone());return r}).catch(()=>hit);
    return hit||net;
  }));
});
