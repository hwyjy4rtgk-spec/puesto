// Copia local para abrir la app sin señal.
// Con señal siempre se pide la versión nueva (network-first); sin señal se usa la copia guardada.
const V='puesto-v4';
const SHELL=['./','./index.html','./styles.css','./app.js','./config.js','./vendor/supabase.js','./vendor/591.supabase.js','./icon.svg','./manifest.webmanifest'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(V).then(c=>Promise.all(SHELL.map(u=>fetch(u,{cache:'reload'}).then(r=>r.ok&&c.put(u,r)).catch(()=>{})))).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==V).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
  const req=e.request;if(req.method!=='GET')return;
  const u=new URL(req.url);
  const shell=u.origin===location.origin;
  const fonts=/fonts\.(googleapis|gstatic)\.com$/.test(u.hostname);
  if(!shell&&!fonts)return;
  const key=shell&&req.mode==='navigate'?new URL('./index.html',self.registration.scope).href:req;
  e.respondWith((async()=>{
    const c=await caches.open(V);
    try{
      const r=await fetch(req,shell?{cache:'no-cache'}:undefined);
      if(r&&(r.ok||r.type==='opaque'))c.put(key,r.clone());
      return r;
    }catch(err){
      const hit=await c.match(key,{ignoreSearch:true});
      if(hit)return hit;
      throw err;
    }
  })());
});
