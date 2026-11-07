(()=>{
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

function loadCache(){try{const c=JSON.parse(localStorage.getItem(CACHE)||'null');if(c&&c.me&&c.me.id){base=c.base||base;me=c.me;outbox=c.outbox||[];chat=c.chat||[];return true}}catch(e){}return false}
function saveCache(){try{chat=chat.slice(-80);localStorage.setItem(CACHE,JSON.stringify({base,me,outbox,chat}))}catch(e){}}
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
function refreshUI(){clearTimeout(refreshT);refreshT=setTimeout(()=>{derive();saveCache();renderHeader();if(!document.body.classList.contains('typing'))renderChat(false);if($('#menuSheet').classList.contains('on'))renderMenu();if($('#itemSheet').classList.contains('on'))renderItem()},60)}

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

/* ================= lenguaje ================= */
const STOP=new Set('tienes tiene tenemos tengo tenis teni hay alguna alguno algun algo una uno un la el lo los las de del que quiero quiere necesito necesita busca busco buscan buscando cliente clienta me muestra muestrame mostrar ver precio cuanto cuesta vale sale y con para en por a o al tu su esta este esa ese estas esos sus mas menos queda quedan hola porfa favor si no e oye dame dime cual cuales q k le se es son modelo marca camarita camaritas camara camaras foto fotos otra otro ahi aca alla ya tambien bueno buena entonces pero oiga oye wn weon po pos'.split(' '));
const TYPEW=[[/^(reflex|slr|reflexs)$/,'Réflex'],[/^(compactas?|bolsillo|pointandshoot)$/,'Compacta'],[/^(telemetricas?|rangefinders?)$/,'Telemétrica'],[/^(instantaneas?|instax)$/,'Instantánea'],[/^(digitales|digital)$/,'Digital'],[/^(lentes?|objetivos?)$/,'Lente'],[/^(rollos?|peliculas?|film|films|carretes?)$/,'Película'],[/^(tlr)$/,'Formato medio'],[/^(baterias?|pilas?)$/,'Batería'],[/^(cargadores?)$/,'Cargador'],[/^(memorias?|tarjetas?|sd|sdxd|xd)$/,'Memoria'],[/^(fundas?|estuches?|bolsos?)$/,'Funda'],[/^(correas?)$/,'Correa'],[/^(tripodes?)$/,'Trípode'],[/^(cables?)$/,'Cable'],[/^(flash|flashes)$/,'Flash']];
const ALIAS={cannon:'canon',olimpus:'olympus',olympu:'olympus',olimpo:'olympus',fuji:'fujifilm',fujy:'fujifilm',fujifim:'fujifilm',nikkon:'nikon',nicon:'nikon',sonny:'sony',soni:'sony',samsumg:'samsung',samgung:'samsung',sansung:'samsung',panasonik:'panasonic',lumics:'lumix',kodac:'kodak',codak:'kodak',polaroit:'polaroid',polaroyd:'polaroid',cassio:'casio',pentak:'pentax',minolt:'minolta',cybershot:'cybershot',ciber:'cyber',instas:'instax',insta:'instax',mju:'700',video:'videocamara',videocamaras:'videocamara',filmadora:'videocamara',handycam:'videocamara',sumergible:'sumergible',acuatica:'sumergible',agua:'sumergible',lector:'lector',lectores:'lector'};
const NUMW={un:1,una:1,uno:1,dos:2,tres:3,cuatro:4,cinco:5,seis:6,siete:7,ocho:8,nueve:9,diez:10};
const ORD={primera:1,primero:1,segunda:2,segundo:2,tercera:3,tercero:3,cuarta:4,cuarto:4,quinta:5,quinto:5,sexta:6,sexto:6};
const METH=[[/efectivo|cash|plata|billete/,'Efectivo'],[/tarjeta|debito|credito|redcompra|pos\b/,'Tarjeta'],[/transfer/,'Transferencia']];
const NUMRE=/(?<![\w-])(\$\s*)?(\d{1,3}(?:[.\s]\d{3})+|\d+(?:[.,]\d+)?)\s*(lucas?|mil|k|palos?)?(?![\w-])/gi;
function toCLP(num,unit){let n=parseFloat(String(num).replace(/[.\s](?=\d{3}\b)/g,'').replace(',','.'));if(isNaN(n))return NaN;
  if(unit){unit=unit.toLowerCase();if(/^palo/.test(unit))n*=1e6;else n*=1000}else if(n<1000)n*=1000;return Math.round(n)}
function takePrice(text,nameGuard){
  const cands=[...text.matchAll(NUMRE)];let pick=null;
  for(const m of cands){
    const before=text.slice(0,m.index).trimEnd().toLowerCase();const after=text.slice(m.index+m[0].length).trim();
    const cue=/(?:\b(en|a|por|precio|vale|cobre|cobré)|\$)$/.test(before)||m[1]||m[3]||m[2].replace(/\D/g,'').length>=4;
    const lastBare=!after||/^(en\s+|con\s+)?(efectivo|tarjeta|transfer\w*|debito|credito|cash)?\s*$/i.test(after);
    const v=toCLP(m[2],m[3]);
    if(cue||(lastBare&&parseFloat(m[2])>=50&&!(nameGuard&&nameGuard(m[2])))){pick={m,v,cueWord:before.match(/\b(en|a|por)$/)};}
  }
  if(!pick)return {price:null,rest:text};
  let start=pick.m.index;if(pick.cueWord)start-=pick.cueWord[0].length;
  return {price:pick.v,rest:(text.slice(0,start)+' '+text.slice(pick.m.index+pick.m[0].length)).replace(/\s+/g,' ').trim()};
}
function takeMethod(text){const t=deac(text);for(const[re,m]of METH)if(re.test(t))return {method:m,rest:deac(text).replace(new RegExp('\\b(con|en|por|pago|pagado|pago con)?\\s*('+re.source+')\\w*','g'),' ').trim()};return {method:null,rest:text}}
function takeBudget(text){
  let t=deac(text),min=null,max=null;const N='\\$?\\s*(\\d{1,3}(?:[.\\s]\\d{3})+|\\d+(?:[.,]\\d+)?)\\s*(lucas?|mil|k|palos?)?';let m;
  if((m=t.match(new RegExp('entre\\s+'+N+'\\s+y\\s+'+N)))){min=toCLP(m[1],m[2]||m[4]);max=toCLP(m[3],m[4]);t=t.replace(m[0],' ')}
  if((m=t.match(new RegExp('(bajo|menos de|hasta|maximo|no mas de|por debajo de|debajo de|menor a|menos que|tope|presupuesto( de)?|baratas? de)\\s+'+N)))){max=toCLP(m[3],m[4]);t=t.replace(m[0],' ')}
  if((m=t.match(new RegExp('(mas de|sobre|desde|arriba de|mayor a|mas que)\\s+'+N)))){min=toCLP(m[2],m[3]);t=t.replace(m[0],' ')}
  if(min==null&&max==null&&(m=t.match(new RegExp('(?:^|\\s)(?:unas?|como|tipo|por|de)?\\s*'+N+'(?=\\s|$)')))&&m[2]){max=toCLP(m[1],m[2]);t=t.replace(m[0],' ')}
  return {min,max,rest:t};
}
/* --- vocabulario y tolerancia a errores --- */
let VOC=null,VOCKEY='';
function vocab(){
  const key=S.items.length+':'+S.items.map(i=>i.id).join('').length;if(VOC&&VOCKEY===key)return VOC;
  const w=new Set();for(const i of S.items)for(const x of deac(i.name+' '+i.compatible).split(/[^a-z0-9]+/))if(x.length>=3&&!/^\d+$/.test(x))w.add(x);
  VOC=[...w];VOCKEY=key;return VOC;
}
function lev(a,b){if(Math.abs(a.length-b.length)>2)return 9;const d=Array.from({length:a.length+1},(_,i)=>[i]);for(let j=1;j<=b.length;j++)d[0][j]=j;
  for(let i=1;i<=a.length;i++)for(let j=1;j<=b.length;j++){d[i][j]=Math.min(d[i-1][j]+1,d[i][j-1]+1,d[i-1][j-1]+(a[i-1]===b[j-1]?0:1));if(i>1&&j>1&&a[i-1]===b[j-2]&&a[i-2]===b[j-1])d[i][j]=Math.min(d[i][j],d[i-2][j-2]+1)}
  return d[a.length][b.length]}
const hay=i=>norm(i.name+' '+(i.compatible||''));
const hayDeep=i=>norm(i.notes+' '+i.pitch);
function fixToken(t){
  if(ALIAS[t])return ALIAS[t];
  if(t.length<4||/\d/.test(t))return t;
  if(S.items.some(i=>hay(i).includes(t)||hayDeep(i).includes(t)))return t;
  let best=null,bd=9;const lim=t.length<=5?1:2;
  for(const v of vocab()){const d=lev(t,v);if(d<bd||(d===bd&&best&&v.length<best.length)){bd=d;best=v}}
  return bd<=lim?best:t;
}
const GROUP_RE=/\b(camaras? (de|a) rollo|camaras? de pelicula|de rollo|analog\w*|35 ?mm)\b/;
function analyze(text){
  let {min,max,rest}=takeBudget(text);let type=null,brand=null,beginner=false,group=null;const fixes=[];
  if(GROUP_RE.test(rest)){group='analog';rest=rest.replace(GROUP_RE,' ')}
  if(/formato medio|medio formato|\b120\b|\btlr\b/.test(rest)){type='Formato medio';rest=rest.replace(/formato medio|medio formato|\b120\b|\btlr\b/,' ')}
  if(/para empezar|principiante|primera camara|aprender|facil de usar|novat|sencilla|simple/.test(rest)){beginner=true;rest=rest.replace(/para empezar|principiante|primera camara|aprender|facil de usar|novat\w*|sencilla|simple/,' ')}
  if(/\b(accesorios?|insumos)\b/.test(rest)){group='acc';rest=rest.replace(/\b(accesorios?|insumos)\b/,' ')}
  const brands=[...new Set(S.items.filter(isCam).map(i=>norm(brandOf(i.name))))];const toks=[];
  for(const w of rest.split(/[^a-z0-9/.-]+/).filter(Boolean)){
    let n=norm(w);if(!n)continue;
    const tw=TYPEW.find(([re])=>re.test(n));if(tw&&!type){type=tw[1];continue}
    if(STOP.has(n)||NUMW[n]||ORD[n])continue;
    const f=fixToken(n);if(f!==n&&!ALIAS[n])fixes.push(f);n=f;
    if(!brand&&brands.includes(n)){brand=n;continue}
    if(/^(polaroid|instax)$/.test(n)&&!brands.includes(n)&&!type){type='Instantánea';continue}
    toks.push(n);
  }
  return {min,max,type,brand,beginner,group,toks,fixes};
}
const isAnalog=i=>isCam(i)&&i.type!=='Digital'&&!/snap/i.test(i.name);
function match(a,pool,deep=true){
  const ok=i=>{
    if(a.group==='analog'&&!isAnalog(i))return false;
    if(a.group==='acc'&&isCam(i))return false;
    if(a.type&&i.type!==a.type)return false;
    if(a.brand&&!(isCam(i)?norm(brandOf(i.name))===a.brand:hay(i).includes(a.brand)))return false;
    if((a.max!=null||a.min!=null)&&!i.price)return false;
    if(a.max!=null&&i.price>a.max)return false;
    if(a.min!=null&&i.price<a.min)return false;
    if(a.beginner&&!['Réflex','Compacta','Telemétrica','Instantánea'].includes(i.type))return false;
    return true;
  };
  const base=pool.filter(ok);
  let r=base.filter(i=>a.toks.every(t=>hay(i).includes(t)));
  if(!r.length&&deep&&a.toks.length)r=base.filter(i=>a.toks.every(t=>hay(i).includes(t)||hayDeep(i).includes(t)));
  const exact=i=>a.toks.length&&a.toks.join('')===norm(i.name.replace(/\(.*?\)/g,'')).replace(norm(brandOf(i.name)),'')?0:1;
  return r.sort((x,y)=>{
    if(a.beginner){const bx=/empezar|aprender|automatic|simple/.test(deac(x.pitch))?0:1,by=/empezar|aprender|automatic|simple/.test(deac(y.pitch))?0:1;if(bx!==by)return bx-by}
    return (avail(y)-avail(x))||(exact(x)-exact(y))||(a.max!=null||a.min!=null?x.price-y.price:0)||x.name.localeCompare(y.name)});
}
function describe(a,n){
  let s;
  if(a.group==='analog')s=n===1?'análoga':'análogas';
  else if(a.group==='acc'&&!a.type)s=n===1?'accesorio':'accesorios';
  else if(a.type)s=n===1?a.type.toLowerCase():PLURAL[a.type];
  else s=n===1?'cámara':'cámaras';
  if(a.brand)s+=' '+brandOf(S.items.find(i=>norm(brandOf(i.name))===a.brand)?.name||a.brand);
  if(a.toks.length&&!a.brand)s+=' “'+a.toks.join(' ')+'”';
  if(a.beginner)s+=' para empezar';
  if(a.min!=null&&a.max!=null)s+=` entre ${clp.format(a.min)} y ${clp.format(a.max)}`;
  else if(a.max!=null)s+=` hasta ${clp.format(a.max)}`;else if(a.min!=null)s+=` desde ${clp.format(a.min)}`;
  return s;
}
function nearby(a){
  const pool=S.items.filter(avail);let r=[];
  if(a.toks.length)r=pool.filter(i=>a.toks.some(t=>t.length>=3&&hay(i).includes(t.slice(0,3))));
  if(!r.length&&a.brand)r=pool.filter(i=>norm(brandOf(i.name))===a.brand);
  if(!r.length&&a.type)r=pool.filter(i=>i.type===a.type);
  if(!r.length&&a.max!=null)r=pool.filter(i=>isCam(i)&&i.price>0&&i.price<=a.max*1.3);
  return r.sort((x,y)=>x.price-y.price).slice(0,6);
}
const art=i=>!isCam(i)&&!/^(Memoria|Funda|Correa|Batería)$/.test(i.type)?'el':'la';const Art=i=>art(i)==='el'?'El':'La';
const fixNote=a=>a.fixes&&a.fixes.length?`Busqué «${a.fixes.join(' ')}». `:'';

/* ================= respuestas ================= */
let ctx={last:null,list:[]},pending=null;
function bot(m){if(m.items&&m.items.length>1)ctx.list=m.items.slice();if(m.items&&m.items.length===1)ctx.last=m.items[0];chat.push({id:uuid(),from:'bot',ts:Date.now(),...m})}
function meSay(text){chat.push({id:uuid(),from:'me',ts:Date.now(),text})}
const units=l=>l.reduce((x,i)=>x+free(i),0);
const plural=(n,a,b)=>n===1?a:b;
function ordinal(t){
  const m=t.match(/\b(la|el|lo)?\s*(primera|primero|segunda|segundo|tercera|tercero|cuarta|cuarto|quinta|quinto|sexta|sexto|ultima|ultimo|numero \d|n(?:ro)?\s?\d|#\d|\d)\b/);
  if(!m||!ctx.list.length)return null;
  let k=ORD[m[2]]||(/ultim/.test(m[2])?ctx.list.length:parseInt(m[2].replace(/\D/g,''),10));
  if(!(k>=1&&k<=ctx.list.length))return null;
  if(/^\d$/.test(m[2])&&!/\b(la|el|numero|nro|#)\s*\d\b/.test(t))return null;
  return byId(ctx.list[k-1]);
}
function handle(raw){
  const text=raw.trim();if(!text)return;meSay(text);
  const t=deac(text).replace(/[¿?¡!.]/g,' ').replace(/\s+/g,' ').trim();
  if(pending&&pending.kind==='holdName'){const i=byId(pending.id),q=pending.qty||1;pending=null;if(free(i)>0&&!/^(cancela|no|olvida|nada)/.test(t)){doHold(i,text,q);return}bot({text:'Ok, no la aparté.'});return}
  if(/^(hola|buenas|buen dia|buenos dias|buenas tardes|buenas noches|hey|wena|ola|alo)\b/.test(t)&&t.split(' ').length<=3){bot({text:`Hola${me.name?' '+me.name.split(' ')[0]:''}. Tengo **${nCam()} cámaras** y **${nAcc()} accesorios** disponibles. ¿Qué busca el cliente?`});return}
  if(/^(gracias|vale gracias|ok gracias|muchas gracias|perfecto|genial|bacan|filete|buena)\b/.test(t)&&t.split(' ').length<=3){bot({text:'De nada. Aquí estoy para la próxima.'});return}
  if(/\b(ayuda|como funciona|que puedo|que haces|que sabes|comandos)\b/.test(t)){help();return}
  if(/^(deshace|deshacer|me equivoque|anula|anular|cancela la (ultima )?venta)\b/.test(t)){const s=[...evSales()].reverse().find(x=>!x.void&&(!S.seller||x.sellerId===me.id));if(s)voidSale(s.id);else bot({text:'No hay ventas tuyas para anular en este evento.'});return}
  if(/\b(mas vendid\w*|que (se )?(ha )?vendi\w*|que vendimos|lo vendido|ultimas ventas)\b/.test(t)){soldList();return}
  if(/\b(resumen|cuanto (llevo|llevamos|vendi|vendimos|hemos|hicimos)|total del dia|caja|cierre|ventas de hoy|como vamos|como va el dia)\b/.test(t)){summary();return}
  if(/^(vend[ií]|vendi|vendimos|se vendio|vendida|venta|vendela|vende|vender|cobra|cobrar|cobrale|se lleva|se llevo|llevo|lleva)\b/.test(t)){sellIntent(t);return}
  if(/^(aparta|apartala|apartame|apartar|reserva|reservala|guarda|guardala|separa|separala)\b/.test(t)){holdIntent(t);return}
  if(/^(libera|liberala|desaparta|suelta|ya no la quiere|no vino)\b/.test(t)){releaseIntent(t);return}
  if(/^(agrega|agregar|anade|anadir|nueva|nuevo|ingresa|ingresar)\b/.test(t)&&!/\b\d+\s+unidad/.test(t)){addIntent(text);return}
  if(!S.items.length){bot({text:S.seller?'El dueño todavía no carga productos. Cuando lo haga aparecen aquí al instante.':'Tu inventario está vacío. Escríbeme “agrega Nikon F3 350 lucas mínimo 320” o toca **+** para pegar tu lista entera.',say:S.seller?[]:['Pegar lista']});return}
  if(editIntent(t))return;
  if(/\b(compar\w*|diferencia\w*|cual es mejor|cual conviene|cual me recomiendas|\bvs\b|versus)\b/.test(t)){compareIntent(t);return}
  if(/\b(minimo|cuanto (le )?puedo (bajar|rebajar|dejar)|ultimo precio|rebaja|descuento|regatear)\b/.test(t)){minIntent(t);return}
  if(/\b(cuant[oa]s?|stock|inventario)\b/.test(t)&&!/\b(cuesta|vale|sale|cobro|cobra|rebaj|precio|esta la|esta el)\b/.test(t)){countIntent(t);return}
  if(/\b(cuanto (cuesta|vale|sale|esta|cobro|cobra)|precio d|a cuanto|que precio|en cuanto (esta|sale|la dejas))\b/.test(t)){priceIntent(t);return}
  if(/\b(que incluye|incluye|trae|viene con|cuentame|info|informacion|detalles?|ficha|como es|que tal es|caracteristicas|funciona)\b/.test(t)){infoIntent(t);return}
  if(/\bapartad/.test(t)){const h=S.items.filter(i=>i.held>0&&live(i));const n=h.reduce((x,i)=>x+i.held,0);bot(h.length?{text:`Hay **${n}** ${plural(n,'unidad apartada','unidades apartadas')}:`,items:h.map(i=>i.id)}:{text:'No hay nada apartado.'});return}
  const o=ordinal(t);if(o&&t.split(' ').length<=4){ctx.last=o.id;bot({text:'Esta:',items:[o.id],detail:true});return}
  if(/^(esa|esta|la misma|ese|este)\b/.test(t)&&ctx.last&&t.split(' ').length<=3){bot({text:'Esta:',items:[ctx.last],detail:true});return}
  find(t);
}
function find(t){
  const a=analyze(t);
  if(!a.toks.length&&!a.type&&!a.brand&&a.max==null&&a.min==null&&!a.beginner&&!a.group){overview();return}
  const camOnly=(a.max!=null||a.min!=null||a.beginner)&&!a.toks.length&&!(a.type&&ACC_TYPES.includes(a.type))&&a.group!=='acc';
  const all=match(a,S.items.filter(i=>live(i)&&(!camOnly||isCam(i)))),av=all.filter(avail),held=all.filter(i=>!avail(i));
  if(!all.length){
    const sold=a.toks.length?match({...a,min:null,max:null},S.items.filter(i=>!live(i))):[];const near=nearby(a);
    if(sold.length){bot({text:`${fixNote(a)}La **${sold[0].name}** ya se vendió.${near.length?' Puedes ofrecerle estas:':''}`,items:near.map(i=>i.id)});return}
    if(!a.type&&!a.brand&&!a.group&&a.max==null&&a.min==null&&a.toks.length&&!near.length){bot({text:`No encontré nada con «${esc(a.toks.join(' '))}». Prueba con la marca, el tipo (digital, análoga, instantánea) o un presupuesto.`,say:defaultSay()});return}
    bot({text:`${fixNote(a)}No tengo ${describe(a,2)}.${near.length?' Lo más parecido:':''}`,items:near.map(i=>i.id),say:near.length?[]:defaultSay()});return;
  }
  if(all.length===1){const i=all[0];
    bot({text:fixNote(a)+(free(i)<=0?`Está **apartada**${i.holdFor?' para '+i.holdFor:''}.`:free(i)>1?`Sí, quedan **${free(i)}**.`:'Sí, queda **1**.'),items:[i.id],detail:true});return}
  const u=units(av);let txt=`${fixNote(a)}Tengo **${u}** ${describe(a,u)}`;
  txt+=held.length?`, más ${held.length} ${plural(held.length,'apartada','apartadas')}.`:'.';
  if(a.max!=null||a.min!=null||a.beginner)txt+=' De la más barata a la más cara.';
  bot({text:txt,items:[...av,...held].map(i=>i.id)});
}
function overview(){countIntent('')}
function counts(){
  const av=S.items.filter(avail),cam=av.filter(isCam);
  const dig=cam.filter(i=>i.type==='Digital'),ana=cam.filter(isAnalog),spec=cam.filter(i=>!isAnalog(i)&&i.type!=='Digital'),acc=av.filter(i=>!isCam(i));
  const held=S.items.reduce((x,i)=>x+(live(i)?i.held:0),0);
  return {dig:units(dig),ana:units(ana),spec:units(spec),specNames:spec.map(i=>i.name),acc:units(acc),cam:units(cam),held,models:cam.length,accTypes:ACC_TYPES.map(k=>[k,units(acc.filter(i=>i.type===k))]).filter(x=>x[1])};
}
function countIntent(t){
  t=(t||'').replace(/\b(cuant[oa]s?|stock|inventario|quedan?|hay|tenemos|tengo|total|en|unidades|disponibles?|me|nos|todavia|aun)\b/g,' ').trim();
  const a=t?analyze(t):{toks:[]};
  const multi=(t.match(/\b(analog\w*|digital\w*|instantane\w*|accesorios?|rollos?|compactas?)\b/g)||[]).length>1;
  const filtered=!multi&&(a.toks.length||a.type||a.brand||a.group||a.max!=null||a.min!=null);
  if(!filtered){bot({text:'Así está el stock ahora (en unidades):',count:true,say:['Digitales','Análogas','Accesorios','Resumen del día']});return}
  const l=match(a,S.items.filter(avail)),u=units(l);
  if(!l.length){bot({text:`${fixNote(a)}No quedan ${describe(a,2)}.`});return}
  bot({text:`${fixNote(a)}Quedan **${u}** ${describe(a,u)}${l.length!==u?` (${l.length} ${plural(l.length,'modelo','modelos')})`:''}.`,items:l.map(i=>i.id)});
}
function priceIntent(t){
  const body=t.replace(/\b(cuanto (cuesta|vale|sale|esta|cobro|cobra)|precio d\w*|a cuanto|que precio|en cuanto (esta|sale|la dejas)|tiene|la|el)\b/g,' ');
  const c=resolveItem(body,S.items.filter(live));
  if(!c.length){bot({text:'¿De qué producto? Dime la marca o el modelo.'});return}
  if(c.length>1){bot({text:`Precios de ${c.length} coincidencias:`,items:c.map(i=>i.id)});return}
  const i=c[0];const min=i.min||i.price;
  bot({text:!i.price?`${Art(i)} **${shortName(i)}** aún no tiene precio. Consulta al dueño.`:`${Art(i)} **${shortName(i)}** está en **${clp.format(i.price)}**.${min<i.price?` ${min<i.price?'':''}Puedes dejar${art(i)==='el'?'lo':'la'} hasta en ${clp.format(min)}.`:''}`,items:[i.id],detail:true});
}
function infoIntent(t){
  const body=t.replace(/\b(que incluye|incluye|trae|viene con|cuentame|info|informacion|detalles?|ficha|como es|que tal es|caracteristicas|funciona|de|sobre)\b/g,' ');
  const c=resolveItem(body,S.items.filter(live));
  if(c.length!==1){bot(c.length?{text:'¿De cuál?',items:c.map(i=>i.id)}:{text:'¿De qué producto? Dime la marca o el modelo.'});return}
  const i=c[0];const bits=[];if(i.notes)bits.push(i.notes);if(i.tested.length)bits.push('Probado: '+i.tested.join(', ').toLowerCase()+'.');
  bot({text:bits.length?`**${shortName(i)}**: ${bits.join(' ')}`:`No tengo notas extra de ${art(i)} **${shortName(i)}**. Esto es lo que sé:`,items:[i.id],detail:true});
}
function compareIntent(t){
  const body=t.replace(/\b(compar\w*|diferencia\w*|entre|cual es mejor|cual conviene|cual me recomiendas|que)\b/g,' ');
  const parts=body.split(/\s+(?:vs|versus|o|y|con|contra)\s+|,/).map(x=>x.trim()).filter(Boolean);
  let picks=[];
  if(parts.length>=2){for(const p of parts.slice(0,2)){const r=resolveItem(p,S.items.filter(live));if(r.length)picks.push(r[0])}}
  else if(ctx.list.length>=2&&/\b(estas|esas|ambas|las dos)\b/.test(t))picks=ctx.list.slice(0,2).map(byId);
  picks=picks.filter((x,k,arr)=>x&&arr.findIndex(y=>y&&y.id===x.id)===k);
  if(picks.length<2&&parts.length>=2){const gone=parts.slice(0,2).map(x=>resolveItem(x,S.items.filter(i=>!live(i)))[0]).filter(Boolean);if(gone.length){bot({text:`${Art(gone[0])} **${shortName(gone[0])}** ya se vendió, no puedo compararla.`});return}}
  if(picks.length<2){bot({text:'Dime las dos que quieres comparar. Por ejemplo: “compara la Canon S5 con la Fujifilm S”.'});return}
  bot({text:'Comparación lado a lado:',compare:picks.map(i=>i.id)});
}
function soldList(){
  const ok=evSales().filter(s=>!s.void);
  if(!ok.length){bot({text:`Todavía no hay ventas en “${S.event.name}”.`});return}
  const agg={};for(const s of ok){agg[s.name]=agg[s.name]||{n:0,t:0,id:s.itemId};agg[s.name].n++;agg[s.name].t+=s.price}
  const top=Object.entries(agg).sort((a,b)=>b[1].n-a[1].n||b[1].t-a[1].t);
  bot({text:`Lo vendido en este evento (${ok.length} ${plural(ok.length,'venta','ventas')}): ${top.slice(0,5).map(([n,v])=>`${v.n}× ${n}`).join(', ')}.`,summary:true});
}
function help(){const b=[...new Set(S.items.filter(avail).filter(isCam).map(i=>brandOf(i.name)))];bot({text:'Háblame como a un compañero de puesto. Esto es lo que sé hacer:',help:true,say:[`¿Tienes ${b[0]||'Canon'}?`,'Análogas bajo 40 lucas',`Vendí la ${b[1]||'Olympus'} y un rollo en efectivo`,`Compara la ${b[0]||'Canon'} con la ${b[2]||'Sony'}`,'¿Cuántas digitales quedan?']})}
function summary(){bot({text:evSales().some(s=>!s.void)?'Así va el día:':`Todavía no hay ventas en “${S.event.name}”.`,summary:true});}
function resolveItem(t,pool){
  const o=ordinal(t);if(o&&pool.includes(o))return [o];
  if(/^\s*(la |el )?(esa|esta|misma|ese|este|la|el)?\s*$/.test(t)||/^(esa|esta|la misma)\b/.test(t.trim()))return ctx.last&&pool.includes(byId(ctx.last))?[byId(ctx.last)]:[];
  const a=analyze(t);
  if(!a.toks.length&&!a.type&&!a.brand&&!a.group)return ctx.last&&pool.includes(byId(ctx.last))?[byId(ctx.last)]:[];
  const r=match({...a,min:null,max:null,beginner:false},pool,false);
  if(r.length>1){const ex=r.filter(i=>a.toks.length&&norm(i.name).endsWith(a.toks[a.toks.length-1]));if(ex.length===1)return ex}
  return r;
}
function takeQty(s){const m=s.match(/^\s*(\d{1,2}|un|una|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\b\s*(unidades?\s*(de)?)?/);if(!m)return {qty:1,rest:s};const n=NUMW[m[1]]||parseInt(m[1],10);
  if(!(n>=1&&n<=20))return {qty:1,rest:s};return {qty:n,rest:s.slice(m[0].length)}}
function sellIntent(t){
  let body=t.replace(/^(vend[ií]|vendi|vendimos|se vendio|vendida|venta( de)?|vendela|vende|vender|cobra|cobrar|cobrale|se lleva|se llevo|llevo|lleva)\s*/,'');
  const mm=takeMethod(body);body=mm.rest;
  const pool=S.items.filter(live);
  const parts=body.split(/\s*,\s*|\s+(?:y|mas|\+|junto con|con un|con una)\s+(?=(?:\d+|un|una|uno|dos|tres|cuatro|cinco|el|la|los|las)\b)/).map(x=>x.trim()).filter(Boolean);
  const lines=[];const amb=[];
  for(const part of (parts.length?parts:[''])){
    const q=takeQty(part);let p=q.rest;
    const pr=takePrice(p,num=>pool.some(i=>norm(i.name).includes(num)));p=pr.rest;
    const c=resolveItem(p,pool);
    if(!c.length){if(parts.length<=1){bot({text:p?'No encuentro ese producto entre los disponibles. ¿Cómo se llama?':'¿Qué vendiste? Escríbeme la marca o el modelo.'});return}continue}
    if(c.length>1&&parts.length<=1){amb.push({c,price:pr.price,qty:q.qty});continue}
    const best=c.find(avail)||c[0];
    const ex=lines.find(l=>l.id===best.id);if(ex){ex.qty+=q.qty;continue}
    lines.push({id:best.id,qty:q.qty,price:pr.price||best.price});
  }
  if(amb.length){bot({text:'¿Cuál de estas?',items:amb[0].c.map(i=>i.id),pick:{price:amb[0].price,method:mm.method,qty:amb[0].qty}});return}
  if(!lines.length){bot({text:'No encuentro esos productos. ¿Cómo se llaman?'});return}
  startCart(lines,mm.method);
}
function startSell(i,price,method,qty){if(!live(i)){bot({text:`${Art(i)} ${i.name} ya está vendid${art(i)==='el'?'o':'a'}.`});return}startCart([{id:i.id,qty:qty||1,price:price||i.price}],method)}
function startCart(lines,method){
  const warn=[];
  for(const l of lines){const i=byId(l.id);if(l.qty>i.qty){warn.push(`De ${art(i)} ${shortName(i)} solo quedan ${i.qty}.`);l.qty=i.qty}
    if(free(i)<l.qty&&i.held>0)warn.push(`Ojo: ${art(i)} ${shortName(i)} tiene ${i.held} ${plural(i.held,'unidad apartada','unidades apartadas')}${i.holdFor?' ('+i.holdFor+')':''}.`)}
  const L=lines.filter(l=>l.qty>0);if(!L.length){bot({text:'Eso ya no está disponible.'});return}
  ctx.last=L[L.length-1].id;
  bot({text:(warn.length?warn.join(' ')+' ':'')+(L.length>1?'Revisa el carro y confirma:':'Elige el medio de pago y confirma:'),cart:{lines:L,method:method||'Efectivo',state:'open'}});
}
function holdIntent(t){
  let body=t.replace(/^(aparta|apartala|apartame|apartar|reserva|reservala|guarda|guardala|separa|separala)\s*/,'');let who='';
  const q=takeQty(body);body=q.rest;
  const m=body.match(/\b(para|a nombre de|de)\s+(.+)$/);const pool=S.items.filter(avail);
  if(m){const tryRest=body.slice(0,m.index).trim();if(resolveItem(tryRest,pool).length||!tryRest){who=m[2];body=tryRest}}
  const c=resolveItem(body,pool);
  if(!c.length){bot({text:'No encuentro ese producto entre los disponibles.'});return}
  if(c.length>1){bot({text:'¿Cuál apartamos?',items:c.map(i=>i.id),pickHold:who||'',pickQty:q.qty});return}
  const nm=who?who.replace(/\b\w/,x=>x.toUpperCase()):'';
  if(nm)doHold(c[0],nm,q.qty);else askHold(c[0],q.qty);
}
function askHold(i,qty){ctx.last=i.id;pending={kind:'holdName',id:i.id,qty:qty||1};bot({text:`¿A nombre de quién apartamos ${qty>1?qty+' ':'la '}**${shortName(i)}**? Puedes agregar a qué hora vuelve.`,say:['Cancelar']})}
function doHold(i,who,qty){qty=Math.max(1,Math.min(qty||1,free(i)));if(!qty){bot({text:'No quedan unidades libres para apartar.'});return}
  ctx.last=i.id;for(let k=0;k<qty;k++)enqueue({kind:'hold',id:uuid(),item_id:i.id,who});const f=free(byId(i.id));
  bot({text:`Listo, ${qty>1?qty+' unidades de ':''}**${shortName(i)}** ${plural(qty,'apartada','apartadas')} para ${who}.${f>0?` ${plural(f,'Queda 1 libre','Quedan '+f+' libres')}.`:''}`,undo:{hold:i.id,n:qty,who}})}
function releaseIntent(t){
  let body=t.replace(/^(libera|liberala|desaparta|suelta|ya no la quiere|no vino)\s*/,'');let who=null;
  const m=body.match(/\b(de|para|a nombre de)\s+(.+)$/);
  const pool=S.items.filter(i=>i.held>0&&live(i));
  if(m){const rest=body.slice(0,m.index).trim();const cand=pool.filter(i=>deac(i.holdFor).includes(deac(m[2])));if(cand.length){who=m[2];body=rest;if(!rest&&cand.length===1){doRelease(cand[0],who);return}}}
  const c=body?resolveItem(body,pool):(pool.length===1?pool:resolveItem('',pool));
  if(!c.length){bot({text:pool.length?'¿Cuál liberamos?':'No hay nada apartado.',items:pool.map(i=>i.id)});return}
  if(c.length>1){bot({text:'¿Cuál liberamos?',items:c.map(i=>i.id)});return}
  doRelease(c[0],who);
}
function doRelease(i,who){const names=(i.holdFor||'').split(' · ').filter(Boolean);const w=who?names.find(n=>deac(n).includes(deac(who)))||null:null;
  enqueue({kind:'release',id:uuid(),item_id:i.id,who:w});bot({text:`**${shortName(i)}** liberada${w?' ('+w+')':''}. Vuelve a estar disponible.`})}
function minIntent(t){
  const body=t.replace(/\b(cual es el|cuanto (le )?puedo (bajar|rebajar|dejar)|minimo|ultimo precio|rebaja|descuento|regatear|precio|de la|del)\b/g,' ');
  const c=resolveItem(body,S.items.filter(live));
  if(c.length!==1){bot({text:c.length?'¿De cuál?':'¿De qué producto? Dime la marca o el modelo.',items:c.map(i=>i.id)});return}
  const i=c[0];ctx.last=i.id;const min=i.min||i.price;
  if(!i.price){bot({text:`La **${shortName(i)}** aún no tiene precio. Consulta al dueño.`});return}
  bot({text:min<i.price?`${Art(i)} **${shortName(i)}** está en ${clp.format(i.price)}. Puedes dejar${art(i)==='el'?'lo':'la'} hasta en **${clp.format(min)}**.`:`${Art(i)} **${shortName(i)}** tiene precio fijo: **${clp.format(i.price)}**. No se puede rebajar.`});
}
function editIntent(t){
  let field=null,m;
  if(/\b(stock|unidades|cantidad)\b/.test(t)&&/\d/.test(t)&&/^(cambia|pon|ponle|deja|actualiza|ajusta|corrige|stock|unidades|cantidad|hay)\b/.test(t))field='qty';
  else if((m=t.match(/^llegaron\s+(\d+|dos|tres|cuatro|cinco)\s+(.+)/)))field='add';
  else if(/^(cambia|cambiar|pon|ponle|deja|dejar|actualiza|sube|baja|subele|bajale)\b/.test(t)&&/\d/.test(t))field=/\bminimo\b/.test(t)?'min_price':'price';
  else if(/^(precio|el precio|minimo|el minimo) de\b/.test(t)&&/\d/.test(t))field=/minimo/.test(t)?'min_price':'price';
  if(!field)return false;
  if(S.seller){bot({text:'Solo el dueño puede cambiar precios o stock.'});return true}
  let body=t,value;
  if(field==='add'){const n=NUMW[m[1]]||parseInt(m[1],10);body=m[2];const c=resolveItem(body,S.items);if(c.length!==1){bot({text:c.length?'¿A cuál le sumo stock?':'No encuentro ese producto. Si es nuevo, usa “agrega …”.',items:c.map(i=>i.id)});return true}
    const i=c[0];bot({text:`¿Sumo **${n}** a ${art(i)} **${shortName(i)}**? Quedaría en ${i.qty+n}.`,edit:{id:i.id,field:'qty',value:i.qty+n,state:'open'}});return true}
  if(field==='qty'){const mm=t.match(/(\d+)\s*(unidades?)?\s*$/)||t.match(/\ba\s+(\d+)\b/);value=mm?parseInt(mm[1],10):NaN;body=t.replace(/\b(cambia|pon|ponle|deja|actualiza|ajusta|corrige|el|la|stock|unidades|cantidad|de|del|a|en|hay)\b|\d+/g,' ')}
  else{const pr=takePrice(t.replace(/\b(cambia|cambiar|pon|ponle|deja|dejar|actualiza|sube|baja|subele|bajale|el|precio|minimo|de)\b/g,' '));value=pr.price;body=pr.rest}
  const c=resolveItem(body,S.items);
  if(c.length!==1||!(value>=0)){bot({text:c.length>1?'¿A cuál?':'No entendí qué producto o qué valor. Ejemplo: “cambia el precio de la Ginfax a 28 lucas”.',items:c.map(i=>i.id)});return true}
  const i=c[0];
  const lab=field==='price'?'precio':field==='min_price'?'mínimo':'stock';const cur=field==='price'?i.price:field==='min_price'?(i.min||i.price):i.qty;
  const fmtv=v=>field==='qty'?v+' '+plural(v,'unidad','unidades'):clp.format(v);
  bot({text:`¿Cambio el ${lab} de ${art(i)} **${shortName(i)}** de ${fmtv(cur)} a **${fmtv(value)}**?`,edit:{id:i.id,field,value,state:'open'}});
  return true;
}
async function addIntent(text){
  if(S.seller){bot({text:'Solo el dueño puede agregar productos.'});return}
  let body=text.replace(/^\s*(agrega|agregar|añade|anade|añadir|anadir|nueva|nuevo|ingresa|ingresar)\s*(una|un|la|el)?\s*(camara|cámara)?\s*/i,'');
  let min=null;const mm=body.match(/m[ií]nimo\s*\$?\s*([\d.]+)\s*(lucas?|mil|k)?/i);if(mm){min=toCLP(mm[1],mm[2]);body=body.replace(mm[0],' ')}
  let cond='Muy buena';for(const c of CONDS){const re=new RegExp(c,'i');if(re.test(body)||re.test(deac(body))){cond=c;body=body.replace(re,' ')}}
  const pr=takePrice(body);body=pr.rest.replace(/\s+/g,' ').replace(/[,;]+$/,'').trim();
  if(!body||!pr.price){bot({text:'Para agregar escríbeme modelo y precio. Por ejemplo: “agrega Nikon F3 350 lucas mínimo 320”. También puedes pegar una lista entera con el botón +.',say:['Pegar lista']});return}
  const name=body.charAt(0).toUpperCase()+body.slice(1);
  const row={name,type:guessType(name),cond,price:pr.price,min_price:min&&min<=pr.price?min:pr.price,qty:1};
  const {data,error}=await sb.from('items').insert(row).select().single();
  if(error){bot({text:isNet(error)?'Necesito señal para agregar productos. Inténtalo de nuevo en un momento.':'No pude agregarlo: '+error.message});after();return}
  if(!base.items.some(r=>r.id===data.id))base.items.push(data);derive();ctx.last=data.id;
  bot({text:`Agregada como ${row.type.toLowerCase()}. Toca la ficha para completar qué decirle al cliente.`,items:[data.id],editHint:data.id});after();
}
const defaultSay=()=>{const av=S.items.filter(avail);const b=Object.entries(av.filter(isCam).reduce((a,i)=>{const k=brandOf(i.name);a[k]=(a[k]||0)+free(i);return a},{})).sort((x,y)=>y[1]-x[1]).slice(0,2).map(x=>`¿Tienes ${x[0]}?`);return ['Bajo 50 lucas',...b,'Accesorios','Resumen del día']};

/* ================= acciones ================= */
function upsellFor(ids){
  const sold=ids.map(byId).filter(Boolean);const out=[];const has=id=>ids.includes(id);
  const pick=(f)=>S.items.filter(i=>avail(i)&&!isCam(i)&&!has(i.id)&&f(i)).sort((a,b)=>b.qty-a.qty)[0];
  if(sold.some(i=>isAnalog(i)&&i.type!=='Instantánea')){const r=pick(i=>i.type==='Película'&&/35/.test(i.compatible+i.name+i.pitch));if(r)out.push([r,'Para estrenarla, ofrécele un rollo:'])}
  if(sold.some(i=>/instax/i.test(i.name))){const r=pick(i=>i.type==='Película'&&/instax/i.test(i.name+i.compatible));if(r)out.push([r,'Ofrécele película Instax:'])}
  if(sold.some(i=>i.type==='Digital'&&/(a parte|aparte|sin tarjeta|sin memoria)/i.test(i.notes))){const r=pick(i=>i.type==='Memoria');if(r)out.push([r,'Esa cámara va sin memoria. Ofrécele una:']);else out.push([null,'Recuerda: esa cámara va **sin memoria**. Ofrécele la tarjeta aparte.'])}
  if(sold.some(i=>i.type==='Digital')){const r=pick(i=>/lector/i.test(i.name));if(r&&out.length<2)out.push([r,'Para pasar las fotos al celular:'])}
  return out.slice(0,2);
}
function confirmCart(msg){
  const c=msg.cart;if(c.state!=='open')return;
  for(const l of c.lines){const i=byId(l.id);if(!i||i.qty<l.qty){toast('El stock cambió. Revisa el carro.');renderChat(false);return}const min=i.min||i.price;if(!(l.price>0)||l.price<min)return}
  const ids=[];
  for(const l of c.lines){const i=byId(l.id);for(let k=0;k<l.qty;k++){const op={kind:'sell',id:uuid(),item_id:i.id,name:i.name,list:i.price,price:l.price,method:c.method,sold_at:new Date().toISOString()};ids.push(op.id);enqueue(op)}}
  c.state='done';c.sales=ids;msg.undo={sales:ids};
  const total=c.lines.reduce((x,l)=>x+l.price*l.qty,0);
  const last=c.lines.length===1?byId(c.lines[0].id):null;derive();
  msg.text=`**Vendido.** ${clp.format(total)} en ${c.method.toLowerCase()}.${last?(free(last)>0?` Quedan ${free(last)} de este modelo.`:' Era la última de este modelo.'):''}${online?'':' Sin señal: se enviará apenas vuelva.'}`;
  const up=upsellFor(c.lines.map(l=>l.id));if(up.length)msg.upsell=up.map(([i,txt])=>({id:i&&i.id,text:txt}));
  msg.say=['Resumen del día','¿Qué más queda bajo 50 lucas?'];
  try{navigator.vibrate&&navigator.vibrate([20,40,20])}catch(e){}
}
function voidSale(id,quiet){
  const s=S.sales.find(x=>x.id===id);if(!s||s.void)return;
  const k=outbox.findIndex(o=>o.kind==='sell'&&o.id===id);
  if(k>=0){outbox.splice(k,1);derive();saveCache()}else enqueue({kind:'void',id:uuid(),sale_id:id,item_id:s.itemId});
  chat.forEach(m=>{if(m.undo&&(m.undo.sale===id||(m.undo.sales&&m.undo.sales.every(x=>x===id||S.sales.find(y=>y.id===x)?.void))))m.undone=true});
  if(!quiet)bot({text:`Anulé la venta de **${s.name}**. Vuelve a estar disponible.`});
}
// compat con mensajes antiguos
function confirmSale(msg){const c=msg.confirm;if(!c||c.state!=='open')return;msg.cart={lines:[{id:c.id,qty:1,price:c.price}],method:c.method,state:'open'};delete msg.confirm;confirmCart(msg)}

/* ================= tarjetas ================= */
function cartHTML(m){
  const c=m.cart;const L=c.lines.map(l=>({...l,i:byId(l.id)})).filter(l=>l.i);
  const total=L.reduce((x,l)=>x+(l.price||0)*l.qty,0);
  if(c.state==='done'){const ss=(c.sales||[]).map(id=>S.sales.find(s=>s.id===id)).filter(Boolean);const voided=ss.length&&ss.every(s=>s.void);const pend=ss.some(s=>s.pending);
    return `<div class="receipt ${voided?'void':''}"><span class="ck">${voided?'×':'✓'}</span><div class="rmid">${L.map(l=>`<b>${l.qty>1?l.qty+'× ':''}${esc(l.i.name)}</b>`).join('')}<span class="num">${clp.format(total)} · ${c.method} · ${voided?'Anulada':pend?'Se enviará con señal':'Registrada'}</span></div>${!voided&&!m.undone?`<button class="undo" data-undo="${m.id}">Deshacer</button>`:''}</div>`}
  if(c.state==='cancel')return `<div class="receipt void"><span class="ck">×</span><div class="rmid"><b>Venta cancelada</b><span>${L.map(l=>esc(shortName(l.i))).join(', ')}</span></div></div>`;
  let bad=false;
  const rows=L.map((l,k)=>{const i=l.i,min=i.min||i.price,edit=!i.price||min<i.price||l.price!==i.price;const below=l.price<min||!(l.price>0);if(below)bad=true;
    return `<div class="cline"><span class="thumb">${thumb(i)}</span><div class="mid"><b>${esc(i.name)}</b>
      ${edit?`<label class="cprice"><span>$</span><input class="clp num" data-cart="${m.id}" data-li="${k}" type="number" inputmode="numeric" step="1000" min="1" value="${l.price||''}" placeholder="Precio" aria-label="Precio de ${esc(i.name)}"></label>${i.price?`<small class="num ${below?'bad':''}">${below?(min<i.price?'Mínimo autorizado ':'Precio fijo ')+clp.format(min):min<i.price?'Lista '+clp.format(i.price)+' · mín. '+clp.format(min):'Precio fijo'}</small>`:''}`:`<span class="num">${clp.format(l.price)} c/u</span>`}</div>
      <div class="qty">${i.qty>1||l.qty>1?`<button data-cart="${m.id}" data-cq="${k}:-1" aria-label="Menos">−</button><output class="num">${l.qty}</output><button data-cart="${m.id}" data-cq="${k}:1" aria-label="Más" ${l.qty>=i.qty?'disabled':''}>+</button>`:''}${L.length>1?`<button class="x" data-cart="${m.id}" data-cx="${k}" aria-label="Quitar">×</button>`:''}</div></div>`}).join('');
  return `<div class="checkout">${rows}
    <div class="seg3">${['Efectivo','Tarjeta','Transferencia'].map(x=>`<button data-cart="${m.id}" data-cmeth="${x}" aria-pressed="${c.method===x}">${x==='Transferencia'?'Transfer.':x}</button>`).join('')}</div>
    <button class="btn primary paybtn" data-cart="${m.id}" data-cpay="1" ${bad?'disabled':''}>Confirmar <span class="num" data-ctot="${m.id}">${clp.format(total)}</span></button>
    <button class="link" data-cart="${m.id}" data-ccan="1">Cancelar</button></div>`;
}
function upsellHTML(m){
  if(!m.upsell||!m.upsell.length||m.undone)return '';
  return m.upsell.map(u=>{const i=u.id&&byId(u.id);
    if(!i)return `<div class="upsell"><span class="ui">!</span><p>${fmt(u.text)}</p></div>`;
    return `<div class="upsell"><span class="thumb">${thumb(i)}</span><div class="mid"><small>${fmt(u.text)}</small><b>${esc(i.name)}</b><span class="num">${ptxt(i)}</span></div>${avail(i)?`<button class="btn" data-upsell="${i.id}">Agregar</button>`:''}</div>`}).join('');
}
function compareHTML(m){
  const [a,b]=m.compare.map(byId);if(!a||!b)return '';
  const memo=i=>/incluye/i.test(i.notes)?'Incluida':/(a parte|aparte|sin tarjeta|sin memoria)/i.test(i.notes)?'Aparte':'—';
  const rows=[['Precio',i=>ptxt(i)],['Tipo',i=>i.type],['Estado',i=>i.cond],['Memoria',memo],['Probado',i=>i.tested.length?i.tested.length+' pruebas':'—'],['Stock',i=>free(i)+' disp.']];
  const cheaper=a.price&&b.price&&a.price!==b.price?(a.price<b.price?a:b):null;
  const ready=memo(a)==='Incluida'&&memo(b)!=='Incluida'?a:memo(b)==='Incluida'&&memo(a)!=='Incluida'?b:null;
  const tips=[];if(cheaper)tips.push(`Si busca precio: **${shortName(cheaper)}** (${clp.format(Math.abs(a.price-b.price))} menos).`);
  if(ready)tips.push(`Si la quiere lista para usar: **${shortName(ready)}**, que trae memoria.`);
  if(a.type!==b.type)tips.push(`Una es ${a.type.toLowerCase()} y la otra ${b.type.toLowerCase()}: pregúntale si quiere rollo o digital.`);
  const pa=a.pitch||'',pb=b.pitch||'';
  return `<div class="cmp"><div class="cmph"><button data-open="${a.id}"><span class="thumb">${thumb(a)}</span><b>${esc(a.name)}</b></button><button data-open="${b.id}"><span class="thumb">${thumb(b)}</span><b>${esc(b.name)}</b></button></div>
    ${rows.filter(([l,f])=>!(f(a)==='—'&&f(b)==='—')).map(([l,f])=>{const va=f(a),vb=f(b);return `<div class="cmpr"><span class="num">${esc(va)}</span><small>${l}</small><span class="num">${esc(vb)}</span></div>`}).join('')}
    ${pa||pb?`<div class="cmpp"><p>${esc(pa)}</p><p>${esc(pb)}</p></div>`:''}
    ${tips.length?`<div class="cmpt">${tips.map(x=>`<p>${fmt(x)}</p>`).join('')}</div>`:''}
    <div class="cmpa"><button class="btn" data-sell="${a.id}">Vender</button><button class="btn" data-sell="${b.id}">Vender</button></div></div>`;
}
function countHTML(){
  const c=counts();
  const tile=(n,l,q)=>`<button class="ktile" data-say="${esc(q)}"><b class="num">${n}</b><span>${l}</span></button>`;
  return `<div class="kgrid">${tile(c.dig,'Digitales','digitales')}${tile(c.ana,'Análogas','análogas')}${c.spec?tile(c.spec,esc(c.specNames.length===1?shortName({name:c.specNames[0]}):'Especiales'),c.specNames.length===1?c.specNames[0]:'instantáneas'):''}${tile(c.acc,'Accesorios','accesorios')}</div>
    <div class="ksum num"><span><b>${c.cam}</b> cámaras en total</span>${c.held?`<span>${c.held} ${plural(c.held,'apartada','apartadas')}</span>`:''}${c.accTypes.length?`<span>${c.accTypes.map(([k,n])=>n+' '+(n===1?k.toLowerCase():PLURAL[k])).join(' · ')}</span>`:''}</div>`;
}
function summaryHTML(){
  const ok=evSales().filter(s=>!s.void);if(!ok.length)return '';
  const tot=ok.reduce((a,s)=>a+s.price,0),by=m=>ok.filter(s=>s.method===m).reduce((a,s)=>a+s.price,0),disc=ok.reduce((a,s)=>a+Math.max(0,s.list-s.price),0);
  const agg={};for(const s of ok){agg[s.name]=(agg[s.name]||0)+1}
  const top=Object.entries(agg).sort((a,b)=>b[1]-a[1]).slice(0,3);
  return `<div class="sum"><div class="sumh"><small>${esc(S.event.name)}</small><b class="num">${clp.format(tot)}</b><span class="num">${ok.length} ${plural(ok.length,'venta','ventas')}${disc?' · rebajas por '+clp.format(disc):''}</span></div>
    <div class="sumr num">${['Efectivo','Tarjeta','Transferencia'].map(m=>`<div><small>${m==='Transferencia'?'Transfer.':m}</small><b>${clp.format(by(m))}</b></div>`).join('')}</div>
    ${top.length?`<div class="sumt"><small>Lo más vendido</small>${top.map(([n,q])=>`<span>${q}× ${esc(n)}</span>`).join('')}</div>`:''}
    <div class="say"><button data-act="copyReport">Copiar resumen</button></div></div>`;
}
function helpHTML(){
  const g=[['Buscar','“¿Tienes Olympus?”, “análogas bajo 40 lucas”, “algo sumergible”, “la segunda”'],['Precios','“¿Cuánto cuesta la Ginfax?”, “¿cuánto le puedo rebajar?”'],['Vender','“Vendí la FE-230 y 2 rollos en efectivo”, “véndela”'],['Apartar','“Aparta la Instax para Diego, vuelve a las 6”, “libera la de Diego”'],['Comparar','“Compara la Canon S5 con la Fujifilm S”'],['Stock y caja','“¿Cuántas digitales quedan?”, “resumen”, “lo más vendido”']];
  if(!S.seller)g.push(['Dueño','“Cambia el precio de la Ginfax a 28 lucas”, “llegaron 3 rollos Kodak”, “agrega Nikon F3 350 lucas”']);
  return `<div class="helpg">${g.map(([a,b])=>`<div><b>${a}</b><span>${b}</span></div>`).join('')}</div>`;
}
function editHTML(m){
  const e=m.edit,i=byId(e.id);if(!i)return '';
  if(e.state==='done')return `<div class="receipt"><span class="ck">✓</span><div class="rmid"><b>${esc(i.name)}</b><span>Actualizado</span></div></div>`;
  if(e.state==='cancel')return `<div class="receipt void"><span class="ck">×</span><div class="rmid"><b>${esc(i.name)}</b><span>Sin cambios</span></div></div>`;
  return `<div class="btnrow"><button class="btn" data-editno="${m.id}" style="flex:0 1 120px">No</button><button class="btn primary" data-editok="${m.id}">Sí, cambiar</button></div>`;
}

/* ================= render chat ================= */
const shortName=i=>{const base=i.name.replace(/\s*\(.*?\)\s*/g,' ').trim();const dup=S.items.filter(x=>x.id!==i.id&&x.name.replace(/\s*\(.*?\)\s*/g,' ').trim()===base).length;if(dup)return i.name;const w=base.split(/\s+/);return w.length>4?w.slice(0,4).join(' '):base};
const nAcc=()=>nAvail()-nCam();
const meta=i=>{const p=[i.type];if(i.compatible)p.push('para '+i.compatible);else if(i.cond&&i.cond!=='Muy buena')p.push(i.cond);if(i.held>0&&live(i))p.push((i.held>1?i.held+' apartadas':'apartada')+(i.holdFor?' · '+i.holdFor:''));return p.join(' · ')};
const stock=i=>!live(i)?'<span class="st bad">Vendida</span>':free(i)<=0?'<span class="st hold">Apartada</span>':free(i)>1?`<span class="st ok num">${free(i)} disp.</span>`:'<span class="st ok">Disponible</span>';
function rowHTML(i,attrs){return `<button class="row2 ${live(i)?'':'dim'}" ${attrs||`data-open="${i.id}"`}><span class="thumb">${thumb(i)}</span><span class="mid"><span class="nm">${esc(i.name)}</span><span class="meta">${esc(meta(i))}</span></span><span class="right"><span class="price num${i.price>0?'':' np'}">${ptxt(i)}</span>${stock(i)}</span></button>`}
const cardHTML=i=>rowHTML(i);
function tileHTML(i,attrs){return `<button class="tile ${live(i)?'':'dim'}" ${attrs||`data-open="${i.id}"`}><span class="tthumb">${thumb(i)}</span><span class="tnm">${esc(i.name)}</span><span class="tft"><span class="price num${i.price>0?'':' np'}">${i.price>0?clp.format(i.price):'Consultar'}</span>${stock(i)}</span></button>`}
function bigHTML(i){
  return `<div class="big"><button class="top" data-open="${i.id}"><span class="thumb">${thumb(i)}</span><span class="mid"><h4>${esc(i.name)}</h4><span class="meta">${esc(meta(i))}</span></span><svg class="chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6"/></svg></button>
  <div class="pr"><span class="price num${i.price>0?'':' np'}">${ptxt(i)}</span>${stock(i)}</div>
  ${i.pitch?`<div class="pitch"><small>Para el cliente</small>${esc(i.pitch)}</div>`:''}
  ${i.notes?`<div class="bnote">${esc(i.notes)}</div>`:''}
  ${live(i)?`<div class="acts"><button class="btn primary" data-sell="${i.id}">Vender</button>${free(i)>0?`<button class="btn" data-hold="${i.id}">Apartar</button>`:''}${i.held>0?`<button class="btn" data-release="${i.id}">Liberar</button>`:''}</div>`:''}</div>`;
}
const pickAttr=(m,i)=>m.pick&&live(i)?`data-picksell="${i.id}" data-cm="${m.id}"`:m.pickHold!=null&&avail(i)?`data-pickhold="${i.id}" data-cm="${m.id}"`:'';
function itemsHTML(m){
  const its=(m.items||[]).map(byId).filter(Boolean);if(!its.length)return '';
  if(m.detail&&its.length===1)return bigHTML(its[0]);
  if(its.length<=3||m.pick||m.pickHold!=null)return `<div class="rows">${its.slice(0,8).map(i=>rowHTML(i,pickAttr(m,i))).join('')}</div>${its.length>8?`<button class="more" data-list="${m.id}">Ver las ${its.length}</button>`:''}`;
  return `<div class="car" role="list">${its.slice(0,12).map(i=>tileHTML(i)).join('')}${its.length>12?`<button class="tile more-tile" data-list="${m.id}"><b class="num">+${its.length-12}</b><span>Ver todas</span></button>`:''}</div><button class="more" data-list="${m.id}">Ver lista completa (${its.length})</button>`;
}
function confirmHTML(m){
  const c=m.confirm,i=byId(c.id);if(!i)return '';
  if(c.state==='done'){const s=S.sales.find(x=>x.id===c.sale);
    const st=!s?'No se registró':s.void?'Anulada':s.pending?'Guardada · se enviará con señal':'Registrada';
    return `<div class="receipt ${s&&s.void?'void':''}"><span class="ck">${s&&s.void?'×':'✓'}</span><div class="rmid"><b>${esc(i.name)}</b><span class="num">${s?clp.format(s.price)+' · '+s.method:''} · ${st}</span></div>${s&&!s.void&&!m.undone?`<button class="undo" data-undo="${m.id}">Deshacer</button>`:''}</div>`}
  if(c.state==='cancel')return `<div class="receipt void"><span class="ck">×</span><div class="rmid"><b>${esc(i.name)}</b><span>Venta cancelada</span></div></div>`;
  if(!live(i))return `<div class="receipt void"><span class="ck">×</span><div class="rmid"><b>${esc(i.name)}</b><span>Ya no está disponible</span></div></div>`;
  const min=i.min||i.price,below=c.price<min,free=!i.price;
  const opts=free?[]:[...new Set([i.price,Math.round((i.price+min)/2/1000)*1000,min])].filter(v=>v>=min&&v<=i.price);
  return `<div class="checkout"><div class="cohead"><span class="thumb">${thumb(i)}</span><div class="mid"><b>${esc(i.name)}</b><span>${esc(i.type)}</span></div></div>
    ${free?`<label class="f" style="margin:0">Precio acordado<input class="cpin" data-cm="${m.id}" type="number" inputmode="numeric" min="1" step="1000" placeholder="Ej: 25000" value="${c.price||''}"></label>`:opts.length>1?`<div class="opts">${opts.map((v,k)=>`<button class="opt num" data-cm="${m.id}" data-cprice="${v}" aria-pressed="${c.price===v}">${k===0?'Lista ':v===min?'Mínimo ':''}${clp.format(v)}</button>`).join('')}</div>`:''}
    ${below?`<div class="warn">${clp.format(c.price)} está bajo el mínimo (${clp.format(min)}).</div>`:''}
    <div class="seg3">${['Efectivo','Tarjeta','Transferencia'].map(x=>`<button data-cm="${m.id}" data-cmethod="${x}" aria-pressed="${c.method===x}">${x==='Transferencia'?'Transfer.':x}</button>`).join('')}</div>
    <button class="btn primary paybtn" data-cm="${m.id}" data-cok="1" ${below||!(c.price>0)?'disabled':''}>Confirmar <span class="num" data-ctot="${m.id}">${clp.format(c.price||0)}</span></button>
    <button class="link" data-cm="${m.id}" data-ccancel="1">Cancelar</button></div>`;
}
const words=t=>fmt(t).split(/(<[^>]+>|\s+)/).map(x=>/^<|^\s+$|^$/.test(x)?x:`<span class="w">${x}</span>`).join('');
function msgHTML(m,fresh){
  if(m.from==='me')return `<div class="msg me${fresh?' fresh':''}"><div class="bubble">${esc(m.text)}</div></div>`;
  let h=`<div class="msg bot${fresh?' fresh':''}">`+AP('av')+'<div class="bcol">';
  if(m.text)h+=`<p>${fresh?words(m.text):fmt(m.text)}</p>`;
  h+=`<div class="payload">${itemsHTML(m)}`;
  if(m.cart)h+=cartHTML(m);
  if(m.upsell)h+=upsellHTML(m);
  if(m.compare)h+=compareHTML(m);
  if(m.count)h+=countHTML();
  if(m.summary&&m===chat.filter(x=>x.summary).slice(-1)[0])h+=summaryHTML();
  if(m.help)h+=helpHTML();
  if(m.edit)h+=editHTML(m);
  if(m.confirm)h+=confirmHTML(m);
  if(m.undo&&!m.undone&&!m.confirm&&!m.cart){const sale=m.undo.sale&&S.sales.find(s=>s.id===m.undo.sale);const holdOk=m.undo.hold&&byId(m.undo.hold)?.status==='apart';
    if((sale&&!sale.void)||holdOk)h+=`<button class="undo" data-undo="${m.id}">Deshacer</button>`}
  if(m.editHint&&!S.seller)h+=`<div class="say"><button data-edit="${m.editHint}">Completar ficha</button></div>`;
  return h+'</div></div></div>';
}
function starters(){
  const av=S.items.filter(avail),cams=av.filter(isCam),acc=av.filter(i=>!isCam(i));
  const cnt=a=>a.reduce((x,i)=>x+free(i),0);
  const out=[];
  const cheap=cams.filter(i=>i.price>0&&i.price<=50000);if(cheap.length)out.push(['Bajo $50.000',`${cnt(cheap)} cámaras`,'¿Qué hay bajo 50 lucas?']);
  const ana=cams.filter(isAnalog),dig=cams.filter(i=>i.type==='Digital');
  const types=CAM_TYPES.map(t=>[t,cams.filter(i=>i.type===t)]).filter(x=>x[1].length).sort((a,b)=>cnt(b[1])-cnt(a[1]));
  if(dig.length)out.push(['Digitales',`${cnt(dig)} disponibles`,'digitales']);if(ana.length)out.push(['Análogas',`${cnt(ana)} disponibles`,'análogas']);
  if(acc.length)out.push(['Rollos y accesorios',`${cnt(acc)} unidades`,'accesorios']);
  out.push(['¿Qué sabes hacer?','Ejemplos de preguntas','ayuda']);
  return out.slice(0,4);
}
function renderHome(){
  const first=(me.name||'').split(' ')[0];
  let sub=`${nCam()} cámaras y ${nAcc()} accesorios disponibles`;
  if(!S.items.length)sub=S.seller?'El dueño todavía no carga productos.':'Tu inventario está vacío. Toca + para cargar productos.';
  const st=S.items.length?`<div class="starters">${starters().map(([a,b,q])=>`<button class="starter" data-say="${esc(q)}"><b>${esc(a)}</b><span class="num">${esc(b)}</span></button>`).join('')}</div>`:'';
  return `<div class="home">${AP('ap')}<div class="hi gtext">Hola${first?' '+esc(first):''}</div><h1>¿Qué busca el cliente?</h1><p class="num">${esc(sub)}</p></div>${st}`;
}
let lastFresh=null;
function renderChat(scroll=true){
  if(!me.role)return;
  const home=!chat.length;document.body.classList.toggle('home',home);
  const last=chat[chat.length-1];const fresh=last&&last.id!==lastFresh&&scroll?last.id:null;
  if(last)lastFresh=last.id;
  $('#chat').innerHTML=home?renderHome():chat.map(m=>msgHTML(m,m.id===fresh)).join('');
  if(fresh){const ws=[...document.querySelectorAll('.msg.fresh .w')];const step=Math.min(28,900/Math.max(1,ws.length));ws.forEach((w,k)=>w.style.animationDelay=(k*step)+'ms');
    const pl=document.querySelector('.msg.fresh .payload');if(pl)pl.style.animationDelay=Math.min(900,ws.length*step)+'ms'}
  renderHeader();renderSugg();
  if(scroll&&!home)requestAnimationFrame(()=>{const msgs=document.querySelectorAll('#chat .msg');const lm=msgs[msgs.length-1];const prev=msgs[msgs.length-2];
    const target=(prev&&prev.classList.contains('me')?prev:lm);if(target)window.scrollTo({top:Math.max(0,target.getBoundingClientRect().top+window.scrollY-84),behavior:'smooth'})});
}
function renderHeader(){
  if(!me.role)return;
  $('#hName').textContent=S.event.name||'Puesto';
  const net=!online?`<span class="netpill off">Sin señal${outbox.length?' · '+outbox.length+' por enviar':''}</span>`:outbox.length?`<span class="netpill">Enviando ${outbox.length}</span>`:'';
  $('#hStats').innerHTML=(net?net+' ':'')+`<span class="num">${nCam()} cámaras · ${nAcc()} acc.</span>${S.seller?' <span class="badge">Vendedor</span>':''}`;
  const av=$('#meAv');if(av)av.textContent=((me.name||me.email||'?').trim()[0]||'?').toUpperCase();
}
function nextSteps(){
  const lastBot=[...chat].reverse().find(m=>m.from==='bot');
  if(pending)return ['Cancelar'];
  if(!S.items.length)return S.seller?[]:['Pegar lista','Ayuda'];
  if(lastBot&&lastBot.say&&lastBot.say.length)return lastBot.say;
  const last=ctx.last&&byId(ctx.last);
  if(last&&live(last)){const s=[];if((last.min||last.price)<last.price)s.push('¿Cuánto puedo rebajar?');if(isCam(last))s.push('Algo más barato');s.push('Resumen del día','Ayuda');return s}
  return defaultSay();
}
function renderSugg(){
  const s=document.body.classList.contains('home')?[]:nextSteps();
  $('#sugg').innerHTML=s.map(x=>`<button data-say="${esc(x)}">${esc(x)}</button>`).join('');
}
function after(){saveCache();renderChat()}
function send(text){
  if(text==='Pegar lista'){if(!S.seller){openImport()}return}
  if(text==='Ver todo'){meSay(text);const av=S.items.filter(live).sort((a,b)=>(avail(b)-avail(a))||a.price-b.price);bot({text:`Todo el inventario: **${av.length} productos**.`,items:av.map(i=>i.id)});return thinking()}
  if(text==='¿Cuánto puedo rebajar?'&&ctx.last){meSay(text);minIntent('minimo '+byId(ctx.last).name);return thinking()}
  if(text==='Algo más barato'&&ctx.last){const l=byId(ctx.last);meSay(text);const c=S.items.filter(i=>avail(i)&&i.price>0&&i.price<l.price&&i.type===l.type).sort((a,b)=>b.price-a.price);
    bot(c.length?{text:`${c.length===1?'Hay una':'Hay '+c.length} ${c.length>1?PLURAL[l.type]:l.type.toLowerCase()} más barata${c.length>1?'s':''} que la ${shortName(l)}:`,items:c.map(i=>i.id)}:{text:`No hay ${PLURAL[l.type]} más baratas que la ${shortName(l)}.`});return thinking()}
  handle(text);thinking();
}
function thinking(){saveCache();renderChatTyping();setTimeout(()=>renderChat(),380)}
function renderChatTyping(){
  document.body.classList.remove('home');
  const msgs=chat.slice(0,-1);const me2=msgs[msgs.length-1];
  $('#chat').innerHTML=msgs.map(m=>msgHTML(m,m===me2&&m.from==='me')).join('')+'<div class="msg bot">'+AP('av spin')+'<div class="bcol"><div class="typing"><i></i><i></i><i></i></div></div></div>';
  $('#sugg').innerHTML='';
  requestAnimationFrame(()=>window.scrollTo({top:document.body.scrollHeight,behavior:'smooth'}));
}
function openList(id){
  const m=msgById(id);if(!m)return;listIds=(m.items||[]).slice();listSort='rel';listTitle=(m.text||'Resultados').replace(/\*\*/g,'').replace(/[:.]\s*$/,'');renderList();openSheet('listSheet');$('#listBody').scrollTop=0;
}
let listIds=[],listSort='rel',listTitle='';
function renderList(){
  let its=listIds.map(byId).filter(Boolean);
  if(listSort==='asc')its.sort((a,b)=>(a.price||9e9)-(b.price||9e9));if(listSort==='desc')its.sort((a,b)=>b.price-a.price);
  $('#listTitle').textContent=listTitle;
  $('#listSeg').innerHTML=[['rel','Relevancia'],['asc','Menor precio'],['desc','Mayor precio']].map(([k,l])=>`<button data-lsort="${k}" aria-pressed="${listSort===k}">${l}</button>`).join('');
  $('#listBody').innerHTML=`<div class="rows">${its.map(i=>rowHTML(i)).join('')}</div>`;
}

/* ================= ficha ================= */
let openId=null,showMin=false;
function openItem(id){openId=id;showMin=false;ctx.last=id;renderItem();openSheet('itemSheet');$('#itemBody').scrollTop=0}
function renderItem(){
  const i=byId(openId);if(!i){closeSheet();return}const min=i.min||i.price;
  $('#itemLbl').textContent=i.type+' · '+i.cond;
  const alts=S.items.filter(x=>x.id!==i.id&&avail(x)&&x.type===i.type&&Math.abs(x.price-i.price)<=i.price*.35).sort((a,b)=>Math.abs(a.price-i.price)-Math.abs(b.price-i.price)).slice(0,3);
  $('#itemBody').innerHTML=`<div class="hero">${i.photo?`<img src="${esc(i.photo)}" alt="${esc(i.name)}">`:sil(i.type)}</div>
    <div class="dtitle">${esc(i.name)}</div><div>${dot(i)}</div>
    ${i.held>0&&live(i)?`<div class="note" style="margin-top:10px;background:var(--hold-bg);border-color:transparent"><b>${i.held>1?i.held+' apartadas':'Apartada'}:</b> ${esc(i.holdFor)}</div>`:''}
    <div class="pricebox"><div><small>Precio</small><span class="price num${i.price>0?'':' np'}">${ptxt(i)}</span></div>${i.price===0?'<small>Pregunta al dueño</small>':min<i.price?`<button class="reveal" data-act="toggleMin">${showMin?`Mínimo<b class="num">${clp.format(min)}</b>`:'Ver mínimo'}</button>`:'<small>Precio fijo</small>'}</div>
    ${i.compatible?`<div class="note" style="margin-top:12px"><b>Sirve para:</b> ${esc(i.compatible)}</div>`:''}
    ${i.pitch?`<div class="pitchbox"><small>Qué decirle al cliente</small><p>${esc(i.pitch)}</p></div>`:''}
    ${i.tested.length?`<h3>Probado y funcionando</h3><div class="checks">${i.tested.map(t=>`<span>✓ ${esc(t)}</span>`).join('')}</div>`:''}
    ${i.notes?`<h3>Detalles y defectos</h3><div class="note">${esc(i.notes)}</div>`:''}
    ${i.qty>1?`<p class="hint num">Quedan ${i.qty} unidades.</p>`:''}
    ${alts.length?`<h3>Si no la convence, ofrécele</h3><div class="stack">${alts.map(cardHTML).join('')}</div>`:''}`;
  const f=[];
  if(live(i)){f.push(i.held>0&&free(i)<=0?`<button class="btn" data-release="${i.id}" style="flex:0 1 120px">Liberar</button>`:`<button class="btn" data-hold="${i.id}" style="flex:0 1 120px">Apartar</button>`);f.push(`<button class="btn primary" data-sell="${i.id}">Vender</button>`)}
  if(!S.seller)f.push(`<button class="btn" data-edit="${i.id}" style="flex:0 0 auto">Editar</button>`);
  $('#itemFoot').innerHTML=`<div class="btnrow">${f.join('')}</div>`;
}

/* ================= menú ================= */
let menuTab='inventario';
async function openMenu(tab){menuTab=tab||(S.seller?'ventas':'inventario');renderMenu();openSheet('menuSheet');
  if(!S.seller&&menuTab==='ajustes')loadInvite();}
async function loadInvite(){const {data}=await sb.from('secrets').select('invite_code').eq('id',1).maybeSingle();if(data){inviteCode=data.invite_code;if(menuTab==='ajustes')renderMenu()}}
function renderMenu(){
  const tabs=S.seller?[['ventas','Ventas'],['ajustes','Cuenta']]:[['inventario','Inventario'],['ventas','Ventas'],['ajustes','Ajustes']];
  if(!tabs.some(t=>t[0]===menuTab))menuTab=tabs[0][0];
  $('#menuSeg').innerHTML=tabs.map(([k,l])=>`<button data-mtab="${k}" aria-pressed="${k===menuTab}">${l}</button>`).join('');
  let h='';
  if(menuTab==='inventario'){
    const items=[...S.items].sort((a,b)=>(live(b)-live(a))||a.name.localeCompare(b.name));
    h=`<div class="btnrow"><button class="btn primary" data-act="newItem">+ Agregar cámara</button><button class="btn" data-act="openImport">Pegar lista</button></div>
      <p class="hint">También puedes escribir en el chat: “agrega Nikon F3 350 lucas mínimo 320”.</p>
      <h3>${items.length} productos · ${nAvail()} disponibles</h3>
      <div class="list">${items.map(i=>`<div class="row"><span class="thumb">${thumb(i)}</span><button class="info" data-edit="${i.id}"><b>${esc(i.name)}</b><span class="num">${i.price>0?clp.format(i.price)+' · mín. '+clp.format(i.min||i.price):'Sin precio'}${i.status==='apart'&&live(i)?' · apartada':''}</span></button><div class="step"><button data-dec="${i.id}" aria-label="Restar unidad">−</button><output class="num" style="color:var(--${i.qty<=0?'bad':'ink'})">${i.qty}</output><button data-inc="${i.id}" aria-label="Sumar unidad">+</button></div></div>`).join('')||'<div class="empty">Aún no hay cámaras.</div>'}</div>`;
  }else if(menuTab==='ventas'){
    const all=evSales(),ok=all.filter(s=>!s.void),tot=ok.reduce((a,s)=>a+s.price,0),by=m=>ok.filter(s=>s.method===m).reduce((a,s)=>a+s.price,0),disc=ok.reduce((a,s)=>a+Math.max(0,s.list-s.price),0);
    const who=id=>{const m=base.members.find(x=>x.user_id===id);return m?(m.user_id===me.id?'tú':(m.name||(m.role==='owner'?'dueño':'vendedor'))):''};
    h=`<div class="kpis"><div class="kpi big2"><small>${esc(S.event.name)}</small><div class="num">${clp.format(tot)}</div><span class="num">${ok.length} ventas · rebajas por ${clp.format(disc)}</span></div>
      ${['Efectivo','Tarjeta','Transferencia'].map(m=>`<div class="kpi"><small>${m==='Transferencia'?'Transfer.':m}</small><div class="num">${clp.format(by(m))}</div></div>`).join('')}</div>
      <h3>Detalle</h3><div class="list">${[...all].reverse().map(s=>{const canVoid=!S.seller||(s.sellerId===me.id&&Date.now()-s.ts<30*60e3);
        return `<div class="row ${s.void?'void':''}"><div class="info"><b>${esc(s.name)}</b><span class="num">${new Date(s.ts).toLocaleTimeString('es-CL',{hour:'2-digit',minute:'2-digit'})} · ${clp.format(s.price)}${s.price<s.list?` (lista ${clp.format(s.list)})`:''} · ${s.method}${who(s.sellerId)?' · '+esc(who(s.sellerId)):''}${s.pending?' · por enviar':''}</span></div>${s.void?'<span class="dot bad">Anulada</span>':canVoid?`<button class="btn" style="height:36px;font-size:13px" data-voidm="${s.id}">Anular</button>`:''}</div>`}).join('')||'<div class="empty">Sin ventas en este evento.</div>'}</div>
      <h3>Cierre</h3><div class="btnrow"><button class="btn" data-act="copyReport">Copiar resumen</button>${S.seller?'':'<button class="btn" data-act="downloadCSV">Descargar ventas</button><button class="btn" data-act="closeEvent">Nuevo evento</button>'}</div><div id="closeBox"></div>`;
  }else{
    const acct=`<h3>Tu cuenta</h3><div class="toggle"><div><b>${esc(me.name||me.email)}</b><span>${esc(me.email)} · ${me.role==='owner'?'Dueño':'Vendedor'}</span></div></div>
      <div class="btnrow" style="margin-top:10px"><button class="btn" data-act="clearChat">Limpiar conversación</button><button class="btn danger" data-act="signOut">Cerrar sesión</button></div>`;
    if(S.seller)h=acct;
    else{
      const sellers=base.members.filter(m=>m.role==='seller');
      h=`<label class="f">Nombre del evento<input id="evtInput" value="${esc(S.event.name)}" placeholder="Ej: Feria de fotografía análoga"></label>
      <h3>Invitar a un vendedor</h3>
      <div class="codebox"><div><small style="color:var(--muted);font-size:13px">Código del puesto</small><br><b class="num" id="codeTxt">${esc(inviteCode||'······')}</b></div><button class="btn" data-act="copyCode" style="height:40px">Copiar</button></div>
      <p class="hint">El vendedor abre esta misma dirección, crea su cuenta y escribe este código. Cambia el código si ya no quieres que alguien más pueda unirse.</p>
      <div class="btnrow" style="margin-top:8px"><button class="btn" data-act="rotateCode">Cambiar código</button></div>
      <h3>Vendedores</h3><div class="list">${sellers.map(m=>`<div class="row"><div class="info"><b>${esc(m.name||'Sin nombre')}</b><span>Desde ${new Date(m.created_at).toLocaleDateString('es-CL')}</span></div><button class="btn danger" style="height:36px;font-size:13px" data-rmember="${m.user_id}">Quitar</button></div>`).join('')||'<div class="empty">Aún no hay vendedores.</div>'}</div>
      <div id="rmBox"></div>${acct}`;
    }
  }
  $('#menuBody').innerHTML=h;
}

/* ================= editor + importar ================= */
let editing=null,eTests=[],ePhoto='',ePhotoBlob=null,impRows=[];
function openEdit(i){
  editing=i?i.id:null;eTests=[...(i?.tested||[])];ePhoto=i?.photo||'';ePhotoBlob=null;
  $('#editTitle').textContent=i?'Editar cámara':'Nueva cámara';
  $('#eName').value=i?.name||'';$('#eQty').value=i?.qty??1;
  $('#eType').innerHTML=TYPES.map(t=>`<option ${t===(i?.type||'Réflex')?'selected':''}>${t}</option>`).join('');
  $('#eCond').innerHTML=CONDS.map(t=>`<option ${t===(i?.cond||'Muy buena')?'selected':''}>${t}</option>`).join('');
  $('#eCompat').value=i?.compatible||'';$('#ePrice').value=i?.price??'';$('#eMin').value=i?.min??'';$('#ePitch').value=i?.pitch||'';$('#eNotes').value=i?.notes||'';
  renderTicks();renderEThumb();$('#delBtn').hidden=!i;$('#delBox').innerHTML='';
  closeSheet(true);openSheet('editSheet');$('#editForm').scrollTop=0;if(!i)setTimeout(()=>$('#eName').focus(),250);
}
function renderTicks(){$('#eTicks').innerHTML=TESTS.map(t=>`<button type="button" data-tick="${t}" aria-pressed="${eTests.includes(t)}">${eTests.includes(t)?'✓ ':''}${t}</button>`).join('')}
function renderEThumb(){$('#eThumb').innerHTML=ePhoto?`<img src="${esc(ePhoto)}" alt="">`:sil($('#eType').value||'Réflex');$('#rmPhoto').hidden=!ePhoto}
$('#eType').addEventListener('change',renderEThumb);
$('#eName').addEventListener('change',e=>{if(!editing&&e.target.value){$('#eType').value=guessType(e.target.value);renderEThumb()}});
$('#ePhoto').addEventListener('change',e=>{
  const f=e.target.files[0];if(!f)return;const r=new FileReader();
  r.onload=()=>{const img=new Image();img.onload=()=>{const m=900,k=Math.min(1,m/Math.max(img.width,img.height));const c=document.createElement('canvas');c.width=Math.round(img.width*k);c.height=Math.round(img.height*k);c.getContext('2d').drawImage(img,0,0,c.width,c.height);ePhoto=c.toDataURL('image/jpeg',.78);c.toBlob(b=>{ePhotoBlob=b},'image/jpeg',.78);renderEThumb()};img.onerror=()=>toast('No se pudo leer esa imagen');img.src=r.result};
  r.readAsDataURL(f);e.target.value='';
});
const money=s=>{const n=String(s||'').replace(/[^\d]/g,'');return n?+n:NaN};
function openImport(){$('#impTxt').value='';parseImport();closeSheet(true);openSheet('importSheet');setTimeout(()=>$('#impTxt').focus(),250)}
function parseImport(){
  const lines=$('#impTxt').value.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
  impRows=lines.map(l=>{
    const p=l.split(/\t|;|\|/).map(x=>x.trim());let [name,price,min,cond]=p;
    if(p.length===1){const m=l.match(/^(.*?)[\s,:-]+\$?\s*([\d.]{4,})\s*$/);if(m){name=m[1];price=m[2]}}
    const pr=money(price),mn=money(min),c=CONDS.find(x=>norm(x)===norm(cond))||'Muy buena';
    return {name:(name||'').replace(/,$/,''),price:pr,min:isNaN(mn)||mn>pr||mn<=0?pr:mn,cond:c,type:guessType(name||''),ok:!!name&&pr>0};
  });
  const good=impRows.filter(r=>r.ok).length,bad=impRows.length-good;
  $('#impPreview').innerHTML=impRows.length?`<b class="num" style="font-size:14px">${good} listas para agregar${bad?` · ${bad} sin precio, se omiten`:''}</b><div class="list" style="margin-top:8px">${impRows.slice(0,40).map(r=>`<div class="row" style="${r.ok?'':'opacity:.5'}"><span class="thumb">${sil(r.type)}</span><div class="info"><b>${esc(r.name||'(sin nombre)')}</b><span class="num">${r.ok?clp.format(r.price)+' · '+r.type+' · '+r.cond:'Falta el precio'}</span></div></div>`).join('')}</div>`:'';
  $('#impBtn').disabled=!good;$('#impBtn').textContent=good?`Agregar ${good} ${good===1?'cámara':'cámaras'}`:'Agregar';
}
$('#impTxt').addEventListener('input',parseImport);
async function uploadPhoto(blob){
  const path=uuid()+'.jpg';
  const {error}=await sb.storage.from('fotos').upload(path,blob,{contentType:'image/jpeg',cacheControl:'31536000'});
  if(error)throw error;return sb.storage.from('fotos').getPublicUrl(path).data.publicUrl;
}

/* ================= utilidades ================= */
let tT;function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('on');clearTimeout(tT);tT=setTimeout(()=>t.classList.remove('on'),2600)}
function openSheet(id){$('#scrim').classList.add('on');$('#'+id).classList.add('on')}
function closeSheet(keep){if(!keep)$('#scrim').classList.remove('on');document.querySelectorAll('.sheet').forEach(s=>s.classList.remove('on'))}
async function copy(text,ok){try{await navigator.clipboard.writeText(text);toast(ok)}catch(e){toast('No se pudo copiar en este navegador')}}
function report(){
  const ok=evSales().filter(s=>!s.void),tot=ok.reduce((a,s)=>a+s.price,0),by=m=>ok.filter(s=>s.method===m).reduce((a,s)=>a+s.price,0);
  return `${S.event.name} · ${new Date().toLocaleDateString('es-CL')}\nTotal: ${clp.format(tot)} (${ok.length} ventas)\nEfectivo ${clp.format(by('Efectivo'))} · Tarjeta ${clp.format(by('Tarjeta'))} · Transferencia ${clp.format(by('Transferencia'))}\n\nVendidas:\n${ok.map(s=>`${s.name} — ${clp.format(s.price)} (${s.method})`).join('\n')||'—'}\n\nApartadas:\n${S.items.filter(i=>i.status==='apart'&&live(i)).map(i=>`${i.name} — ${i.holdFor||'sin nombre'}`).join('\n')||'—'}\n\nQuedan ${nAvail()} disponibles.`;
}
async function downloadCSV(){
  const {data,error}=await sb.from('sales').select('*').order('sold_at');
  if(error){toast(isNet(error)?'Necesitas señal para descargar':'No se pudo descargar');return}
  const rows=[['fecha','evento','producto','precio_lista','precio_venta','medio','vendedor','anulada']].concat(data.map(s=>[s.sold_at,s.event_name,s.name,s.list_price,s.price,s.method,(base.members.find(m=>m.user_id===s.seller_id)||{}).name||'',s.voided?1:0]));
  const csv='﻿'+rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download=`ventas-puesto-${new Date().toISOString().slice(0,10)}.csv`;document.body.appendChild(a);a.click();a.remove();
}
const msgById=id=>chat.find(m=>m.id===id);
async function ownerWrite(promise,okMsg){
  const {data,error}=await promise;
  if(error){toast(isNet(error)?'Necesitas señal para editar el inventario':'No se pudo guardar: '+error.message);return null}
  if(okMsg)toast(okMsg);return data;
}

/* ================= eventos ================= */
document.addEventListener('click',async e=>{
  const t=e.target.closest('button,[data-act]');if(!t)return;const d=t.dataset;
  if(t.id==='sendBtn')return;
  if(d.say){if(d.say==='Cancelar'&&pending){pending=null;meSay('Cancelar');bot({text:'Ok, cancelado.'});after();return}send(d.say);return}
  if(d.open){openItem(d.open);return}
  if(d.sell){const i=byId(d.sell);closeSheet();startSell(i);after();return}
  if(d.hold){const i=byId(d.hold);closeSheet();askHold(i);after();$('#msg').focus();return}
  if(d.release){const i=byId(d.release);closeSheet();doRelease(i);after();return}
  if(d.picksell){const m=msgById(d.cm);startSell(byId(d.picksell),m?.pick?.price,m?.pick?.method,m?.pick?.qty);after();return}
  if(d.pickhold){const m=msgById(d.cm),i=byId(d.pickhold);if(m.pickHold)doHold(i,m.pickHold,m.pickQty);else askHold(i,m.pickQty);after();return}
  if(d.upsell){const i=byId(d.upsell);if(i)startCart([{id:i.id,qty:1,price:i.price}]);after();return}
  if(d.editok||d.editno){const m=msgById(d.editok||d.editno);if(!m||!m.edit||m.edit.state!=='open')return;if(d.editno){m.edit.state='cancel';after();return}
    const e=m.edit;const row={[e.field]:e.value};const i=byId(e.id);if(e.field==='price'&&(i.min||0)>e.value)row.min_price=e.value;if(e.field==='min_price'&&e.value>i.price){toast('El mínimo no puede ser mayor que el precio');return}
    const ok=await ownerWrite(sb.from('items').update(row).eq('id',e.id).select().single(),'Actualizado');if(ok){const k=base.items.findIndex(x=>x.id===ok.id);if(k>=0)base.items[k]=ok;derive();e.state='done'}after();return}
  if(d.cart){const m=msgById(d.cart);if(!m||!m.cart||m.cart.state!=='open')return;const c=m.cart;
    if(d.cq){const [k,dv]=d.cq.split(':').map(Number);const l=c.lines[k],i=byId(l.id);l.qty=Math.max(1,Math.min(i.qty,l.qty+dv))}
    if(d.cx!=null){c.lines.splice(+d.cx,1);if(!c.lines.length)c.state='cancel'}
    if(d.cmeth)c.method=d.cmeth;
    if(d.ccan)c.state='cancel';
    if(d.cpay){confirmCart(m);after();return}
    saveCache();renderChat(false);return}
  if(d.list){openList(d.list);return}
  if(d.lsort){listSort=d.lsort;renderList();return}
  if(d.expand){const m=msgById(d.expand);m.limit=999;saveCache();renderChat(false);return}
  if(d.cm){const m=msgById(d.cm);if(!m||!m.confirm)return;
    if(d.cprice){m.confirm.price=+d.cprice;saveCache();renderChat(false);return}
    if(d.cmethod){m.confirm.method=d.cmethod;saveCache();renderChat(false);return}
    if(d.ccancel){m.confirm.state='cancel';saveCache();renderChat(false);return}
    if(d.cok){confirmSale(m);after();return}}
  if(d.undo){const m=msgById(d.undo);if(m.undo.sales){m.undo.sales.forEach(id=>voidSale(id,true));m.undone=true;bot({text:`Venta anulada. ${m.undo.sales.length>1?'Los productos vuelven':'El producto vuelve'} al stock.`})}else if(m.undo.sale)voidSale(m.undo.sale);else if(m.undo.hold){const i=byId(m.undo.hold);m.undone=true;if(i)for(let k=0;k<(m.undo.n||1);k++)enqueue({kind:'release',id:uuid(),item_id:i.id,who:m.undo.who||null});bot({text:'Deshecho. Vuelve a estar disponible.'})}after();return}
  if(d.mtab){menuTab=d.mtab;renderMenu();if(menuTab==='ajustes'&&!S.seller)loadInvite();return}
  if(d.edit){if(!S.seller)openEdit(byId(d.edit));return}
  if(d.tick){eTests=eTests.includes(d.tick)?eTests.filter(x=>x!==d.tick):[...eTests,d.tick];renderTicks();return}
  if(d.inc||d.dec){if(S.seller)return;const i=byId(d.inc||d.dec);const q=Math.max(0,i.qty+(d.inc?1:-1));
    const r=base.items.find(x=>x.id===i.id);const prev=r.qty;r.qty=q;derive();renderMenu();renderHeader();
    const ok=await ownerWrite(sb.from('items').update({qty:q}).eq('id',i.id).select().single());if(!ok){r.qty=prev;derive();renderMenu()}return}
  if(d.voidm){voidSale(d.voidm);saveCache();renderMenu();renderChat(false);toast('Venta anulada');return}
  if(d.rmember){$('#rmBox').innerHTML=`<div class="confirm">¿Quitar a este vendedor? Ya no podrá ver ni vender.<div class="btnrow"><button class="btn" data-act="cancelRm">Cancelar</button><button class="btn danger" data-rmok="${d.rmember}">Quitar</button></div></div>`;return}
  if(d.rmok){const ok=await ownerWrite(sb.from('members').delete().eq('user_id',d.rmok).select(),'Vendedor quitado');if(ok){base.members=base.members.filter(m=>m.user_id!==d.rmok);renderMenu()}return}
  const i=byId(openId);
  switch(d.act){
    case 'closeSheet':closeSheet();renderChat(false);break;
    case 'openMenu':case 'plus':openMenu();break;
    case 'toggleMin':showMin=!showMin;renderItem();break;
    case 'newItem':openEdit(null);break;
    case 'openImport':openImport();break;
    case 'doImport':{const good=impRows.filter(r=>r.ok);if(!good.length)break;t.disabled=true;
      const rows=good.map(r=>({name:r.name,type:r.type,cond:r.cond,price:r.price,min_price:r.min,qty:1}));
      const data=await ownerWrite(sb.from('items').insert(rows).select());t.disabled=false;
      if(data){data.forEach(r=>{if(!base.items.some(x=>x.id===r.id))base.items.push(r)});derive();closeSheet();bot({text:`Agregué **${data.length}** ${data.length===1?'cámara':'cámaras'}. Ya puedes buscarlas.`});after()}break}
    case 'rmPhoto':ePhoto='';ePhotoBlob=null;renderEThumb();break;
    case 'saveItem':{
      const name=$('#eName').value.trim(),price=Math.round(+$('#ePrice').value),qty=Math.round(+$('#eQty').value),minRaw=$('#eMin').value;
      if(!name){toast('Falta marca y modelo');$('#eName').focus();break}
      if(!(price>=0)||$('#ePrice').value===''){toast('Falta el precio de venta (0 = sin precio)');$('#ePrice').focus();break}
      if(!(qty>=0)||$('#eQty').value===''){toast('Revisa las unidades');$('#eQty').focus();break}
      const min=minRaw===''?price:Math.round(+minRaw);if(!(min>=0)||min>price){toast('El mínimo no puede ser mayor que el precio');$('#eMin').focus();break}
      t.disabled=true;let photo=ePhoto;
      if(ePhotoBlob){try{photo=await uploadPhoto(ePhotoBlob)}catch(err){toast(isNet(err)?'Necesitas señal para subir la foto':'No se pudo subir la foto');t.disabled=false;break}}
      const row={name,price,min_price:min,qty,type:$('#eType').value,cond:$('#eCond').value,tested:eTests,compatible:$('#eCompat').value.trim(),pitch:$('#ePitch').value.trim(),notes:$('#eNotes').value.trim(),photo_url:photo.startsWith('data:')?'':photo};
      const data=await ownerWrite(editing?sb.from('items').update(row).eq('id',editing).select().single():sb.from('items').insert(row).select().single(),editing?'Cambios guardados':'Cámara agregada');
      t.disabled=false;
      if(data){const k=base.items.findIndex(x=>x.id===data.id);if(k>=0)base.items[k]=data;else base.items.push(data);derive();saveCache();closeSheet();renderChat(false)}break}
    case 'askDelete':$('#delBox').innerHTML=`<div class="confirm">¿Eliminar esta cámara? Las ventas registradas se conservan.<div class="btnrow"><button type="button" class="btn" data-act="cancelDel">Cancelar</button><button type="button" class="btn danger" data-act="doDelete">Eliminar</button></div></div>`;break;
    case 'cancelDel':$('#delBox').innerHTML='';break;
    case 'doDelete':{const ok=await ownerWrite(sb.from('items').delete().eq('id',editing).select(),'Cámara eliminada');if(ok){base.items=base.items.filter(x=>x.id!==editing);derive();saveCache();closeSheet();renderChat(false)}break}
    case 'copyReport':copy(report(),'Resumen copiado');break;
    case 'downloadCSV':downloadCSV();break;
    case 'closeEvent':$('#closeBox').innerHTML=`<div class="confirm neutral">Las ventas quedan guardadas y el contador vuelve a cero en todos los celulares. El stock no cambia.<label class="f" style="margin:10px 0 0">Nombre del próximo evento<input id="nextEvt" placeholder="Ej: Mercado de las Pulgas, domingo"></label><div class="btnrow"><button class="btn" data-act="cancelClose">Cancelar</button><button class="btn primary" data-act="doClose">Empezar</button></div></div>`;break;
    case 'cancelClose':$('#closeBox').innerHTML='';break;
    case 'doClose':{const n=$('#nextEvt').value.trim();const {error}=await sb.rpc('start_event',{p_name:n});
      if(error){toast(isNet(error)?'Necesitas señal para empezar un evento':'No se pudo: '+error.message);break}
      try{await loadAll()}catch(err){}derive();chat=[];saveCache();closeSheet();renderChat();toast('Nuevo evento: '+S.event.name);break}
    case 'clearChat':chat=[];ctx.last=null;pending=null;saveCache();closeSheet();renderChat();break;
    case 'copyCode':copy(inviteCode,'Código copiado');break;
    case 'rotateCode':{const {data,error}=await sb.rpc('rotate_invite_code');if(error){toast('No se pudo cambiar el código');break}inviteCode=data;renderMenu();toast('Código nuevo: '+data);break}
    case 'cancelRm':$('#rmBox').innerHTML='';break;
    case 'signOut':await signOut();break;
    case 'toggleAuth':authMode=authMode==='in'?'up':'in';renderAuth();break;
    case 'backToLogin':authMode='in';showGate('auth');break;
  }
});
const SR=window.SpeechRecognition||window.webkitSpeechRecognition;let rec=null;
function syncComposer(){const has=!!$('#msg').value.trim();$('#sendBtn').hidden=!has&&!!SR;$('#micBtn').hidden=has||!SR;$('#sendBtn').disabled=!has}
$('#micBtn').addEventListener('click',()=>{
  if(rec){rec.stop();return}
  try{rec=new SR();rec.lang='es-CL';rec.interimResults=true;rec.maxAlternatives=1}catch(e){toast('Tu navegador no permite dictar');return}
  const b=$('#micBtn');b.classList.add('on');$('#msg').placeholder='Te escucho…';
  rec.onresult=e=>{const r=[...e.results].map(x=>x[0].transcript).join('');$('#msg').value=r;if(e.results[e.results.length-1].isFinal){rec.stop()}};
  rec.onerror=e=>{if(e.error==='not-allowed')toast('Permite el micrófono para dictar')};
  rec.onend=()=>{b.classList.remove('on');$('#msg').placeholder='Pregunta o anota una venta';rec=null;const v=$('#msg').value.trim();if(v){$('#msg').value='';syncComposer();send(v)}};
  rec.start();
});
$('#composer').addEventListener('submit',e=>{e.preventDefault();const v=$('#msg').value.trim();if(!v)return;$('#msg').value='';syncComposer();document.body.classList.remove('typing');send(v)});
document.addEventListener('input',e=>{const el=e.target;if(el.classList&&el.classList.contains('clp')){const m=msgById(el.dataset.cart);if(!m||!m.cart)return;const l=m.cart.lines[+el.dataset.li];l.price=Math.round(+el.value)||0;
  const tot=m.cart.lines.reduce((x,y)=>x+(y.price||0)*y.qty,0);const t=document.querySelector(`[data-ctot="${m.id}"]`);if(t)t.textContent=clp.format(tot);
  const bad=m.cart.lines.some(y=>{const i=byId(y.id);return !(y.price>0)||y.price<(i.min||i.price)});const b=document.querySelector(`[data-cart="${m.id}"][data-cpay]`);if(b)b.disabled=bad;saveCache();return}
  if(!el.classList||!el.classList.contains('cpin'))return;const m=msgById(el.dataset.cm);if(!m)return;
  m.confirm.price=Math.round(+el.value)||0;const tot=document.querySelector(`[data-ctot="${m.id}"]`);if(tot)tot.textContent=clp.format(m.confirm.price);
  const ok=document.querySelector(`[data-cm="${m.id}"][data-cok]`);if(ok)ok.disabled=!(m.confirm.price>0);saveCache()});
$('#msg').addEventListener('input',e=>{syncComposer();document.body.classList.toggle('typing',!!e.target.value)});syncComposer();
$('#editForm').addEventListener('submit',e=>{e.preventDefault();document.querySelector('[data-act="saveItem"]').click()});
document.addEventListener('change',async e=>{if(e.target.id==='evtInput'){const v=e.target.value.trim();if(!v)return;
  const ok=await ownerWrite(sb.from('settings').update({event_name:v}).eq('id',1).select().single(),'Evento renombrado');if(ok){base.settings=ok;derive();renderHeader()}}});

/* ================= login ================= */
let authMode='in';
function showGate(which){
  $('#app').hidden=true;$('#gate').hidden=false;document.body.classList.remove('home');
  $('#authForm').hidden=which!=='auth';$('#joinForm').hidden=which!=='join';$('#checkMail').hidden=which!=='mail';
  if(which==='auth')renderAuth();
  if(which==='join'){$('#gateTitle').textContent='Únete al puesto';$('#gateSub').textContent='Pídele al dueño el código de 6 caracteres. Lo encuentra en Ajustes.';$('#joinErr').textContent='';setTimeout(()=>$('#jCode').focus(),100)}
  if(which==='mail'){$('#gateTitle').textContent='Revisa tu correo';$('#gateSub').textContent=''}
}
function renderAuth(){
  const up=authMode==='up';
  $('#gateTitle').textContent=up?'Crea tu cuenta':'Entra para vender';
  $('#gateSub').textContent=up?'Si vas a vender, pídele al dueño el código del puesto.':'';
  $('#nameRow').hidden=!up;$('#codeRow').hidden=!up;$('#authBtn').textContent=up?'Crear cuenta':'Entrar';
  $('#authToggle').textContent=up?'Ya tengo cuenta':'¿Primera vez? Crea tu cuenta';
  $('#aPass').autocomplete=up?'new-password':'current-password';$('#authErr').textContent='';
}
const AUTH_ERR=m=>/invalid login/i.test(m)?'Correo o contraseña incorrectos.':/already registered|already exists/i.test(m)?'Ese correo ya tiene cuenta. Entra con tu contraseña.':/password/i.test(m)?'La contraseña debe tener al menos 6 caracteres.':/email.*confirm/i.test(m)?'Confirma tu correo antes de entrar. Revisa tu bandeja.':/rate|too many/i.test(m)?'Demasiados intentos. Espera un minuto.':isNet(m)?'Sin conexión. Necesitas señal para entrar la primera vez.':m;
const SIGNUP_ERR={need_code:'Este puesto ya tiene dueño. Escribe el código que te dio para unirte como vendedor.',bad_code:'Ese código no es válido. Pídele al dueño el código actual.',exists:'Ese correo ya tiene cuenta. Toca “Ya tengo cuenta” y entra.',bad_email:'Escribe un correo válido.',weak_password:'La contraseña debe tener al menos 6 caracteres.',no_name:'Escribe tu nombre.'};
async function signupFn(body){
  const res=await fetch(CFG.supabaseUrl+'/functions/v1/signup',{method:'POST',headers:{'Content-Type':'application/json','apikey':CFG.supabaseKey},body:JSON.stringify(body)});
  return res.json();
}
$('#authForm').addEventListener('submit',async e=>{
  e.preventDefault();const email=$('#aEmail').value.trim(),password=$('#aPass').value,name=$('#aName').value.trim();
  if(!/^\S+@\S+\.\S+$/.test(email)){$('#authErr').textContent='Escribe un correo válido.';return}
  if(password.length<6){$('#authErr').textContent='La contraseña debe tener al menos 6 caracteres.';return}
  if(authMode==='up'&&!name){$('#authErr').textContent='Escribe tu nombre.';$('#aName').focus();return}
  const b=$('#authBtn');b.disabled=true;$('#authErr').textContent='';
  try{
    if(authMode==='up'){
      const code=$('#aCode').value.trim().toUpperCase();
      let out;try{out=await signupFn({email,password,name,code})}catch(err){$('#authErr').textContent='Sin conexión. Necesitas señal para crear la cuenta.';return}
      if(out.error){$('#authErr').textContent=SIGNUP_ERR[out.error]||'No se pudo crear la cuenta. Intenta de nuevo.';if(out.error==='need_code'||out.error==='bad_code')$('#aCode').focus();return}
    }
    const r=await sb.auth.signInWithPassword({email,password});
    if(r.error){$('#authErr').textContent=AUTH_ERR(r.error.message);return}
    await enter(r.data.session);
  }finally{b.disabled=false}
});
$('#joinForm').addEventListener('submit',async e=>{
  e.preventDefault();const code=$('#jCode').value.trim().toUpperCase();
  if(code.length<6){$('#joinErr').textContent='El código tiene 6 caracteres.';return}
  const {data,error}=await sb.rpc('join_store',{p_code:code,p_name:me.name});
  if(error){$('#joinErr').textContent=/bad_code/.test(error.message)?'Ese código no es válido. Pídele al dueño el código actual.':isNet(error)?'Sin conexión.':error.message;return}
  me.role=data;await start();
});
async function enter(session){
  const u=session.user;me={id:u.id,email:u.email,name:(u.user_metadata&&u.user_metadata.name)||'',role:me.id===u.id?me.role:null};
  const {data,error}=await sb.rpc('claim_owner',{p_name:me.name});
  if(error){if(me.role&&isNet(error)){await start(true);return}$('#authErr').textContent=AUTH_ERR(error.message);showGate('auth');return}
  if(data==='none'){me.role=null;showGate('join');return}
  me.role=data;await start();
}
async function start(offline){
  $('#gate').hidden=true;$('#app').hidden=false;
  derive();renderChat(false);
  if(!offline){try{await loadAll();derive();setOnline(true)}catch(e){if(isNet(e))setOnline(false);else toast('No se pudo cargar: '+e.message)}}
  const mine=base.members.find(m=>m.user_id===me.id);if(mine){me.role=mine.role;if(!me.name)me.name=mine.name}
  saveCache();subscribe();flush();renderChat(false);
}
async function signOut(){
  if(outbox.length&&!confirmLeave()){return}
  try{if(channel)sb.removeChannel(channel);await sb.auth.signOut()}catch(e){}
  clearCache();base={items:[],sales:[],settings:{event_name:'',event_started:new Date(0).toISOString()},members:[]};me={id:null,role:null,name:'',email:''};outbox=[];chat=[];
  closeSheet();authMode='in';showGate('auth');
}
let leaveArmed=0;function confirmLeave(){if(Date.now()-leaveArmed<5000)return true;leaveArmed=Date.now();toast(`Hay ${outbox.length} acciones sin enviar. Toca otra vez para salir igual.`);return false}
sb.auth.onAuthStateChange((ev,session)=>{if(ev==='SIGNED_OUT'&&me.id){/* handled */}});

/* ================= arranque ================= */
(async()=>{
  const cached=loadCache();
  if(cached&&me.role){$('#gate').hidden=true;$('#app').hidden=false;derive();renderChat(false)}
  let session=null;
  try{const r=await sb.auth.getSession();session=r.data.session}catch(e){}
  if(!session){if(cached&&me.role&&!navigator.onLine){online=false;await start(true);return}showGate('auth');return}
  try{await enter(session)}catch(e){if(cached&&me.role)await start(true);else showGate('auth')}
})();
if('serviceWorker' in navigator&&location.protocol==='https:'){
  const hadController=!!navigator.serviceWorker.controller;let reloaded=false;
  navigator.serviceWorker.addEventListener('controllerchange',()=>{if(hadController&&!reloaded&&!outbox.length){reloaded=true;location.reload()}});
  navigator.serviceWorker.register('sw.js',{updateViaCache:'none'}).then(r=>r.update()).catch(()=>{});
}
})();
