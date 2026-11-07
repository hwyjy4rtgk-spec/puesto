/* Puesto · Configuración, estado local, cola sin señal y sincronización con Supabase */
'use strict';
/* =====================================================================
   Puesto · app de stock para ferias
   Datos en Supabase (tiempo real). Si no hay señal, las ventas y apartados
   quedan en una cola local y se envían solos al volver la conexión.
   ===================================================================== */
const CFG=window.PUESTO_CONFIG;
const sb=window.supabase.createClient(CFG.supabaseUrl,CFG.supabaseKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
const CACHE='puesto.cache.v1';

const CAM_TYPES=['Réflex','Compacta','Telemétrica','Formato medio','Instantánea','Digital'];
const ACC_TYPES=['Película','Batería','Cargador','Memoria','Lente','Flash','Funda','Correa','Trípode','Cable','Accesorio'];
const TYPES=[...CAM_TYPES,...ACC_TYPES];
const isCam=i=>CAM_TYPES.includes(i.type);
const PLURAL={'Réflex':'réflex','Compacta':'compactas','Telemétrica':'telemétricas','Formato medio':'de formato medio','Instantánea':'instantáneas','Digital':'digitales','Lente':'lentes','Película':'rollos','Batería':'baterías','Cargador':'cargadores','Memoria':'memorias','Flash':'flashes','Funda':'fundas','Correa':'correas','Trípode':'trípodes','Cable':'cables','Accesorio':'accesorios'};
const CONDS=['Como nueva','Excelente','Muy buena','Buena','Con detalles','Para repuesto'];
const TESTS=['Obturador','Fotómetro','Flash','Enciende','Enfoque','Óptica limpia','Probada con rollo','Sellos nuevos'];
const clp=new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0});
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=s=>esc(s).replace(/\*\*(.+?)\*\*/g,'<b>$1</b>');
const uuid=()=>crypto.randomUUID?crypto.randomUUID():'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const r=Math.random()*16|0;return (c==='x'?r:(r&3|8)).toString(16)});
const deac=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
const norm=s=>deac(s).replace(/[^a-z0-9]/g,'');
const AP=c=>`<svg class="${c}" viewBox="0 0 24 24" fill="none" stroke="url(#apg)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M14.31 8l5.74 9.94M9.69 8h11.48M7.38 12l5.74-9.94M9.69 16L3.95 6.06M14.31 16H2.83M16.62 12l-5.74 9.94"/></svg>`;
const SIL={
 'Réflex':'<rect x="6" y="16" width="52" height="24" rx="3"/><path d="M22 16l4-8h12l4 8"/><circle cx="32" cy="29" r="8"/><circle cx="32" cy="29" r="4"/><path d="M10 16v-3h6v3"/>',
 'Compacta':'<rect x="5" y="12" width="54" height="26" rx="7"/><circle cx="36" cy="25" r="7"/><rect x="11" y="17" width="10" height="5" rx="1"/><path d="M48 12v-3h6v3"/>',
 'Telemétrica':'<rect x="5" y="12" width="54" height="26" rx="3"/><circle cx="34" cy="26" r="8"/><circle cx="34" cy="26" r="4"/><rect x="9" y="16" width="9" height="6" rx="1"/><rect x="47" y="16" width="7" height="5" rx="1"/><path d="M12 12v-3h7v3"/>',
 'Formato medio':'<rect x="16" y="3" width="32" height="38" rx="3"/><circle cx="32" cy="13" r="6"/><circle cx="32" cy="30" r="7"/><circle cx="32" cy="30" r="3"/>',
 'Instantánea':'<path d="M8 38 14 8h36l6 30z"/><circle cx="32" cy="20" r="7"/><path d="M14 32h36"/><rect x="40" y="11" width="6" height="4" rx="1"/>',
 'Digital':'<rect x="7" y="13" width="50" height="24" rx="4"/><circle cx="40" cy="25" r="7"/><circle cx="40" cy="25" r="3"/><rect x="13" y="17" width="8" height="4" rx="1"/><path d="M14 13v-2h8v2"/>',
 'Lente':'<rect x="12" y="10" width="40" height="24" rx="3"/><path d="M20 10v24M28 10v24"/><ellipse cx="52" cy="22" rx="3" ry="12"/>',
 'Película':'<rect x="16" y="10" width="22" height="26" rx="3"/><path d="M21 10V6h12v4M38 16h14v14H38"/><path d="M41 19v2M45 19v2M49 19v2M41 27v-2M45 27v-2M49 27v-2"/>',
 'Accesorio':'<rect x="16" y="14" width="32" height="20" rx="4"/><path d="M22 14v-4h20v4"/><circle cx="32" cy="24" r="5"/>',
 'Batería':'<rect x="12" y="13" width="38" height="18" rx="3"/><path d="M50 18h3v8h-3M18 22h8M22 18v8M38 22h6"/>',
 'Cargador':'<rect x="14" y="10" width="28" height="24" rx="4"/><path d="M42 22h8M50 18v8M24 16l-3 7h6l-3 7"/>',
 'Memoria':'<path d="M20 6h18l8 8v24H20z"/><path d="M25 6v7M30 6v7M35 6v7"/>',
 'Flash':'<rect x="18" y="20" width="28" height="16" rx="2"/><rect x="20" y="6" width="24" height="12" rx="2"/><path d="M34 9l-4 5h5l-4 5"/>',
 'Funda':'<path d="M12 16h40v20a4 4 0 0 1-4 4H16a4 4 0 0 1-4-4z"/><path d="M12 16l6-8h28l6 8M28 24h8"/>',
 'Correa':'<path d="M6 30c10-14 42-14 52 0"/><rect x="2" y="28" width="8" height="6" rx="1"/><rect x="54" y="28" width="8" height="6" rx="1"/>',
 'Trípode':'<rect x="24" y="4" width="16" height="8" rx="2"/><path d="M32 12v8M32 20 18 40M32 20v20M32 20l14 20"/>',
 'Cable':'<path d="M8 30c10 0 10-16 22-16s12 16 26 16"/><rect x="2" y="27" width="8" height="6" rx="1"/><rect x="54" y="27" width="8" height="6" rx="1"/>'
};
const sil=t=>`<svg viewBox="0 0 64 44" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${SIL[t]||SIL['Accesorio']}</svg>`;
function guessType(n){const s=norm(n);
  if(/bateria|pila|battery/.test(s))return 'Batería';
  if(/cargador|charger/.test(s))return 'Cargador';
  if(/memoria|tarjeta|sdhc|sdxc|microsd|compactflash|xd|memorystick/.test(s))return 'Memoria';
  if(/funda|estuche|bolso|mochila|case/.test(s))return 'Funda';
  if(/correa|strap/.test(s))return 'Correa';
  if(/tripode|tripod|monopie/.test(s))return 'Trípode';
  if(/cable|usb/.test(s))return 'Cable';
  if(/speedlite|flashexterno|^flash/.test(s))return 'Flash';
  if(/rollo|pelicula|portra|iso\d|\bfilm\b/.test(s.replace(/fujifilm/g,''))||/(^|[^a-z])(film|rollo|pelicula)/.test(n.toLowerCase().replace(/fujifilm/g,'')))return 'Película';
  if(/polaroid|instax|onestep|sx70/.test(s))return 'Instantánea';
  if(/cybershot|coolpix|powershot|ixus|lumix|finepix|exilim|digital/.test(s))return 'Digital';
  if(/yashicamat|rolleicord|rolleiflex|mamiya|hasselblad|bronica|lubitel|seagull|holga|diana/.test(s))return 'Formato medio';
  if(/electro35|canonet|leica[mq]|zorki|fed\d|kiev|olympus35|olympusrc/.test(s))return 'Telemétrica';
  if(/mju|stylus|sureshot|prima|autoboy|olympusxa|ricohgr|konicac35|zoom/.test(s))return 'Compacta';
  if(/helios|takumar|jupiter|industar|tamron|sigma|vivitar|objetivo|^lente/.test(s))return 'Lente';
  return 'Réflex';}
const brandOf=n=>{const w=String(n).trim().split(/\s+/)[0]||'';return w.charAt(0).toUpperCase()+w.slice(1)};

/* ================= estado ================= */
// base: lo último que dijo el servidor. outbox: acciones aún no confirmadas. S: lo que se ve (base + outbox).
let base={items:[],sales:[],settings:{event_name:'',event_started:new Date(0).toISOString()},members:[]};
let me={id:null,role:null,name:'',email:''};
let outbox=[], chat=[];
let S={items:[],sales:[],event:{name:'',started:0},seller:true};
let online=navigator.onLine, flushing=false, channel=null, inviteCode='';

function loadCache(){try{const c=JSON.parse(localStorage.getItem(CACHE)||'null');if(c&&c.me&&c.me.id){base=c.base||base;me=c.me;outbox=c.outbox||[];chat=c.chat||[];if(c.posCart&&Array.isArray(c.posCart.lines))posCart=c.posCart;return true}}catch(e){}return false}
function saveCache(){try{chat=chat.slice(-80);localStorage.setItem(CACHE,JSON.stringify({base,me,outbox,chat,posCart}))}catch(e){}}
function clearCache(){try{localStorage.removeItem(CACHE)}catch(e){}}

const vItem=r=>({compatible:r.compatible||'',id:r.id,name:r.name,type:r.type,cond:r.cond,price:r.price,min:r.min_price,qty:r.qty,tested:r.tested||[],pitch:r.pitch||'',notes:r.notes||'',photo:r.photo_url||'',status:r.status,holdFor:r.hold_for||'',held:Math.min(r.qty,r.held!=null?r.held:(r.status==='apart'?1:0))});
const vSale=r=>({id:r.id,itemId:r.item_id,name:r.name,list:r.list_price,price:r.price,method:r.method,ts:Date.parse(r.sold_at),void:!!r.voided,sellerId:r.seller_id,eventStarted:Date.parse(r.event_started),pending:!!r.pending});
function itemOp(it,op){
  if(!it)return;const names=(it.hold_for||'').split(' · ').filter(Boolean);let held=it.held!=null?it.held:(it.status==='apart'?1:0);
  if(op.kind==='sell'){const useHold=held>0&&(op.from_hold||it.qty-held<=0);it.qty=Math.max(0,it.qty-1);if(useHold){held--;names.shift()}}
  if(op.kind==='void')it.qty+=1;
  if(op.kind==='hold'){held++;names.push(op.who||'sin nombre')}
  if(op.kind==='release'&&held>0){held--;const k=op.who?names.indexOf(op.who):0;names.splice(k>=0?k:0,1)}
  it.held=Math.min(held,it.qty);it.hold_for=it.held?names.join(' · '):'';it.status=it.held?'apart':'disp';
}
function derive(){
  const items=new Map(base.items.map(r=>[r.id,{...r}]));
  const sales=new Map(base.sales.map(r=>[r.id,{...r}]));
  for(const op of outbox){
    const it=items.get(op.item_id);
    if(op.kind==='sell'){if(sales.has(op.id))continue;itemOp(it,op);
      sales.set(op.id,{id:op.id,item_id:op.item_id,name:op.name,list_price:op.list,price:op.price,method:op.method,sold_at:op.sold_at,voided:false,seller_id:me.id,event_started:base.settings.event_started,pending:true})}
    if(op.kind==='void'){const s=sales.get(op.sale_id);if(s&&!s.voided){s.voided=true;itemOp(items.get(s.item_id),op)}}
    if(op.kind==='hold'||op.kind==='release')itemOp(it,op);
  }
  S.items=[...items.values()].map(vItem);
  S.sales=[...sales.values()].map(vSale).sort((a,b)=>a.ts-b.ts);
  S.event={name:base.settings.event_name,started:Date.parse(base.settings.event_started)};
  S.seller=me.role!=='owner';
}
const byId=id=>S.items.find(i=>i.id===id);
const ptxt=i=>i.price>0?clp.format(i.price):'Consultar precio';
const live=i=>i&&i.qty>0;
const free=i=>i?Math.max(0,i.qty-(i.held||0)):0;
const avail=i=>!!i&&free(i)>0;
const evSales=()=>S.sales.filter(s=>s.eventStarted>=S.event.started);
const nAvail=()=>S.items.reduce((a,i)=>a+free(i),0);
const nCam=()=>S.items.filter(isCam).reduce((a,i)=>a+free(i),0);
const thumb=i=>i.photo?`<img src="${esc(i.photo)}" alt="" loading="lazy">`:sil(i.type);
const dot=i=>!live(i)?'<span class="dot bad">Vendida</span>':free(i)<=0?'<span class="dot hold">Apartada</span>':`<span class="dot ok">${free(i)>1?free(i)+' disp.':'Disponible'}</span>`;

/* ================= servidor ================= */
const PERM={bad_price:'falta el precio',sold_out:'ya estaba vendida',below_min:'el precio quedó bajo el mínimo',forbidden:'no tienes permiso',not_found:'ya no existe en el inventario',bad_method:'medio de pago inválido'};
const errCode=e=>{const m=String(e?.message||e||'');return Object.keys(PERM).find(k=>m.includes(k))||null};
const isNet=e=>{const m=String(e?.message||e||'');return !errCode(e)&&(/fetch|network|Load failed|timeout|offline|ERR_/i.test(m)||!navigator.onLine)};

async function loadAll(){
  const [it,st,mb]=await Promise.all([
    sb.from('items').select('*').order('name'),
    sb.from('settings').select('*').eq('id',1).single(),
    sb.from('members').select('user_id,role,name,created_at').order('created_at')
  ]);
  for(const r of [it,st,mb])if(r.error)throw r.error;
  const sl=await sb.from('sales').select('*').gte('event_started',st.data.event_started).order('sold_at');
  if(sl.error)throw sl.error;
  base={items:it.data,settings:st.data,members:mb.data,sales:sl.data};
  // descarta de la cola ventas que el servidor ya tiene
  outbox=outbox.filter(op=>!(op.kind==='sell'&&base.sales.some(s=>s.id===op.id)));
  saveCache();
}
function subscribe(){
  if(channel)sb.removeChannel(channel);
  const up=(arr,row,key='id')=>{const k=arr.findIndex(r=>r[key]===row[key]);if(k>=0)arr[k]=row;else arr.push(row)};
  channel=sb.channel('puesto-db')
    .on('postgres_changes',{event:'*',schema:'public',table:'items'},p=>{
      if(p.eventType==='DELETE')base.items=base.items.filter(r=>r.id!==p.old.id);else up(base.items,p.new);refreshUI()})
    .on('postgres_changes',{event:'*',schema:'public',table:'sales'},p=>{
      if(p.eventType==='DELETE')base.sales=base.sales.filter(r=>r.id!==p.old.id);
      else{const mine=outbox.some(o=>o.id===p.new.id);up(base.sales,p.new);
        if(p.eventType==='INSERT'&&!mine&&p.new.seller_id!==me.id&&!p.new.voided)toast(`Se vendió ${p.new.name} en otro celular`)}
      refreshUI()})
    .on('postgres_changes',{event:'*',schema:'public',table:'settings'},p=>{
      const changed=p.new.event_started!==base.settings.event_started;base.settings=p.new;
      if(changed){base.sales=base.sales.filter(s=>s.event_started>=p.new.event_started)}refreshUI()})
    .on('postgres_changes',{event:'*',schema:'public',table:'members'},async p=>{
      if(p.eventType==='DELETE'&&p.old.user_id===me.id){toast('El dueño te quitó del puesto');await signOut();return}
      if(p.eventType==='DELETE')base.members=base.members.filter(m=>m.user_id!==p.old.user_id);else up(base.members,p.new,'user_id');refreshUI()})
    .subscribe(st=>{if(st==='SUBSCRIBED'){setOnline(true);}});
}
let refreshT;
function refreshUI(){clearTimeout(refreshT);refreshT=setTimeout(()=>{derive();saveCache();renderHeader();if(mode==='search')renderSearch();else if(!document.body.classList.contains('typing'))renderChat(false);if($('#coSheet').classList.contains('on'))renderCheckout();if($('#menuSheet').classList.contains('on'))renderMenu();if($('#itemSheet').classList.contains('on'))renderItem()},60)}

async function runOp(op){
  if(op.kind==='sell')return sb.rpc('sell_item',{p_sale_id:op.id,p_item_id:op.item_id,p_price:op.price,p_method:op.method,p_sold_at:op.sold_at,p_from_hold:!!op.from_hold});
  if(op.kind==='void')return sb.rpc('void_sale',{p_sale_id:op.sale_id});
  if(op.kind==='hold')return sb.rpc('hold_item',{p_item_id:op.item_id,p_who:op.who});
  if(op.kind==='release')return sb.rpc('release_item',{p_item_id:op.item_id,p_who:op.who||null});
}
function applyToBase(op,data){
  const it=base.items.find(r=>r.id===op.item_id);
  if(op.kind==='sell'&&data){if(!base.sales.some(s=>s.id===data.id)){base.sales.push(data);itemOp(it,op)}}
  if(op.kind==='void'){const s=base.sales.find(x=>x.id===op.sale_id);if(s&&!s.voided){s.voided=true;itemOp(base.items.find(r=>r.id===s.item_id),op)}}
  if(op.kind==='hold'||op.kind==='release')itemOp(it,op);
}
function enqueue(op){outbox.push(op);derive();saveCache();renderHeader();flush()}
async function flush(){
  if(flushing||!outbox.length||!me.role)return;flushing=true;let failed=false;
  try{
    while(outbox.length){
      const op=outbox[0];let res;
      try{res=await runOp(op)}catch(e){res={error:e}}
      if(res.error){
        if(isNet(res.error)){setOnline(false);break}
        outbox.shift();failed=true;
        const why=PERM[errCode(res.error)]||'hubo un error';
        const label=op.kind==='sell'?`la venta de **${op.name}**`:op.kind==='void'?'la anulación':op.kind==='hold'?'el apartado':'la liberación';
        bot({text:`No pude registrar ${label}: ${why}. Revisa el stock actualizado.`});
        continue;
      }
      applyToBase(op,res.data);outbox.shift();saveCache();setOnline(true);
    }
  }finally{flushing=false}
  if(failed){try{await loadAll()}catch(e){}}
  derive();saveCache();renderHeader();renderChat(false);
}
function setOnline(v){if(online===v)return;online=v;renderHeader();if(v)flush()}
window.addEventListener('online',async()=>{online=true;renderHeader();try{await loadAll();derive()}catch(e){}flush();refreshUI()});
window.addEventListener('offline',()=>setOnline(false));
setInterval(()=>{if(outbox.length)flush()},15000);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&me.role){loadAll().then(()=>{derive();refreshUI()}).catch(()=>{});flush()}});

