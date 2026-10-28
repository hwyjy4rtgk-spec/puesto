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

const TYPES=['Réflex','Compacta','Telemétrica','Formato medio','Instantánea','Digital','Lente','Película','Accesorio'];
const PLURAL={'Réflex':'réflex','Compacta':'compactas','Telemétrica':'telemétricas','Formato medio':'de formato medio','Instantánea':'instantáneas','Digital':'digitales','Lente':'lentes','Película':'rollos','Accesorio':'accesorios'};
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
 'Accesorio':'<rect x="16" y="14" width="32" height="20" rx="4"/><path d="M22 14v-4h20v4"/><circle cx="32" cy="24" r="5"/>'
};
const sil=t=>`<svg viewBox="0 0 64 44" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${SIL[t]||SIL['Accesorio']}</svg>`;
function guessType(n){const s=norm(n);
  if(/polaroid|instax|onestep|sx70/.test(s))return 'Instantánea';
  if(/cybershot|coolpix|powershot|ixus|lumix|finepix|exilim|digital/.test(s))return 'Digital';
  if(/rollo|pelicula|film|portra|iso\d/.test(s))return 'Película';
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

const vItem=r=>({id:r.id,name:r.name,type:r.type,cond:r.cond,price:r.price,min:r.min_price,qty:r.qty,tested:r.tested||[],pitch:r.pitch||'',notes:r.notes||'',photo:r.photo_url||'',status:r.status,holdFor:r.hold_for||''});
const vSale=r=>({id:r.id,itemId:r.item_id,name:r.name,list:r.list_price,price:r.price,method:r.method,ts:Date.parse(r.sold_at),void:!!r.voided,sellerId:r.seller_id,eventStarted:Date.parse(r.event_started),pending:!!r.pending});
function derive(){
  const items=new Map(base.items.map(r=>[r.id,{...r}]));
  const sales=new Map(base.sales.map(r=>[r.id,{...r}]));
  for(const op of outbox){
    const it=items.get(op.item_id);
    if(op.kind==='sell'){if(sales.has(op.id))continue;if(it){it.qty=Math.max(0,it.qty-1);it.status='disp';it.hold_for=''}
      sales.set(op.id,{id:op.id,item_id:op.item_id,name:op.name,list_price:op.list,price:op.price,method:op.method,sold_at:op.sold_at,voided:false,seller_id:me.id,event_started:base.settings.event_started,pending:true})}
    if(op.kind==='void'){const s=sales.get(op.sale_id);if(s&&!s.voided){s.voided=true;const i2=items.get(s.item_id);if(i2)i2.qty+=1}}
    if(op.kind==='hold'&&it){it.status='apart';it.hold_for=op.who}
    if(op.kind==='release'&&it){it.status='disp';it.hold_for=''}
  }
  S.items=[...items.values()].map(vItem);
  S.sales=[...sales.values()].map(vSale).sort((a,b)=>a.ts-b.ts);
  S.event={name:base.settings.event_name,started:Date.parse(base.settings.event_started)};
  S.seller=me.role!=='owner';
}
const byId=id=>S.items.find(i=>i.id===id);
const live=i=>i&&i.qty>0;
const avail=i=>live(i)&&i.status!=='apart';
const evSales=()=>S.sales.filter(s=>s.eventStarted>=S.event.started);
const nAvail=()=>S.items.filter(avail).reduce((a,i)=>a+i.qty,0);
const thumb=i=>i.photo?`<img src="${esc(i.photo)}" alt="" loading="lazy">`:sil(i.type);
const dot=i=>!live(i)?'<span class="dot bad">Vendida</span>':i.status==='apart'?'<span class="dot hold">Apartada</span>':`<span class="dot ok">${i.qty>1?i.qty+' disp.':'Disponible'}</span>`;

/* ================= servidor ================= */
const PERM={sold_out:'ya estaba vendida',below_min:'el precio quedó bajo el mínimo',forbidden:'no tienes permiso',not_found:'ya no existe en el inventario',bad_method:'medio de pago inválido'};
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
  if(op.kind==='sell')return sb.rpc('sell_item',{p_sale_id:op.id,p_item_id:op.item_id,p_price:op.price,p_method:op.method,p_sold_at:op.sold_at});
  if(op.kind==='void')return sb.rpc('void_sale',{p_sale_id:op.sale_id});
  if(op.kind==='hold')return sb.rpc('hold_item',{p_item_id:op.item_id,p_who:op.who});
  if(op.kind==='release')return sb.rpc('release_item',{p_item_id:op.item_id});
}
function applyToBase(op,data){
  const it=base.items.find(r=>r.id===op.item_id);
  if(op.kind==='sell'&&data){if(!base.sales.some(s=>s.id===data.id))base.sales.push(data);if(it){it.qty=Math.max(0,it.qty-1);it.status='disp';it.hold_for=''}}
  if(op.kind==='void'){const s=base.sales.find(x=>x.id===op.sale_id);if(s&&!s.voided){s.voided=true;const i2=base.items.find(r=>r.id===s.item_id);if(i2)i2.qty+=1}}
  if(op.kind==='hold'&&it){it.status='apart';it.hold_for=op.who}
  if(op.kind==='release'&&it){it.status='disp';it.hold_for=''}
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
const STOP=new Set('tienes tiene tenemos tengo hay alguna alguno algun algo una uno un la el lo los las de del que quiero quiere busca busco buscan cliente clienta camara camaras me muestra muestrame ver precio cuanto cuesta vale sale y con para en por a o al tu su esta este esa ese estas esos sus mas menos queda quedan hola porfa favor si no e oye dame dime cual cuales q k le se es son hay'.split(' '));
const TYPEW=[[/^(reflex|slr|reflexs)$/,'Réflex'],[/^(compactas?|bolsillo|pointandshoot)$/,'Compacta'],[/^(telemetricas?|rangefinders?)$/,'Telemétrica'],[/^(instantaneas?|instax)$/,'Instantánea'],[/^(digitales|digital)$/,'Digital'],[/^(lentes?|objetivos?)$/,'Lente'],[/^(rollos?|peliculas?|film|films)$/,'Película'],[/^(tlr)$/,'Formato medio'],[/^(accesorios?)$/,'Accesorio']];
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
function takeMethod(text){const t=deac(text);for(const[re,m]of METH)if(re.test(t))return {method:m,rest:deac(text).replace(new RegExp('\\b(con|en|por|pago)?\\s*('+re.source+')\\w*','g'),' ').trim()};return {method:null,rest:text}}
function takeBudget(text){
  let t=deac(text),min=null,max=null;const N='\\$?\\s*(\\d{1,3}(?:[.\\s]\\d{3})+|\\d+(?:[.,]\\d+)?)\\s*(lucas?|mil|k|palos?)?';let m;
  if((m=t.match(new RegExp('entre\\s+'+N+'\\s+y\\s+'+N)))){min=toCLP(m[1],m[2]||m[4]);max=toCLP(m[3],m[4]);t=t.replace(m[0],' ')}
  if((m=t.match(new RegExp('(bajo|menos de|hasta|maximo|no mas de|por debajo de|debajo de|menor a|menos que|tope|presupuesto( de)?)\\s+'+N)))){max=toCLP(m[3],m[4]);t=t.replace(m[0],' ')}
  if((m=t.match(new RegExp('(mas de|sobre|desde|arriba de|mayor a|mas que)\\s+'+N)))){min=toCLP(m[2],m[3]);t=t.replace(m[0],' ')}
  if(min==null&&max==null&&(m=t.match(new RegExp('(?:^|\\s)(?:unas?|como|tipo|por)?\\s*'+N+'(?=\\s|$)')))&&m[2]){max=toCLP(m[1],m[2]);t=t.replace(m[0],' ')}
  return {min,max,rest:t};
}
function analyze(text){
  let {min,max,rest}=takeBudget(text);let type=null,brand=null,beginner=false;
  if(/formato medio|medio formato|\b120\b|\btlr\b/.test(rest)){type='Formato medio';rest=rest.replace(/formato medio|medio formato|\b120\b|\btlr\b/,' ')}
  if(/para empezar|principiante|primera camara|aprender|facil de usar|novat/.test(rest)){beginner=true;rest=rest.replace(/para empezar|principiante|primera camara|aprender|facil de usar|novat\w*/,' ')}
  if(/polaroid/.test(rest)&&!S.items.some(i=>/polaroid/i.test(i.name)))type='Instantánea';
  const brands=[...new Set(S.items.map(i=>norm(brandOf(i.name))))];const toks=[];
  for(const w of rest.split(/[^a-z0-9/.-]+/).filter(Boolean)){
    const n=norm(w);if(!n)continue;
    const tw=TYPEW.find(([re])=>re.test(n));if(tw&&!type){type=tw[1];continue}
    if(!brand&&brands.includes(n)){brand=n;continue}
    if(STOP.has(n))continue;toks.push(n);
  }
  return {min,max,type,brand,beginner,toks};
}
function match(a,pool){
  return pool.filter(i=>{
    if(a.type&&i.type!==a.type)return false;
    if(a.brand&&norm(brandOf(i.name))!==a.brand)return false;
    if(a.max!=null&&i.price>a.max)return false;
    if(a.min!=null&&i.price<a.min)return false;
    if(a.beginner&&!['Réflex','Compacta','Telemétrica'].includes(i.type))return false;
    const nm=norm(i.name);return a.toks.every(t=>nm.includes(t));
  }).sort((x,y)=>{
    if(a.beginner){const bx=/empezar|aprender|automatic/.test(deac(x.pitch))?0:1,by=/empezar|aprender|automatic/.test(deac(y.pitch))?0:1;if(bx!==by)return bx-by}
    return (avail(y)-avail(x))||(a.max!=null||a.min!=null?x.price-y.price:0)||x.name.localeCompare(y.name)});
}
function describe(a,n){
  let s=a.type?PLURAL[a.type]:(n===1?'cámara':'cámaras');if(a.type&&n===1)s=a.type.toLowerCase();
  if(a.brand)s+=' '+brandOf(S.items.find(i=>norm(brandOf(i.name))===a.brand)?.name||a.brand);
  if(a.toks.length&&!a.brand)s+=' “'+a.toks.join(' ')+'”';
  if(a.beginner)s+=' para empezar';
  if(a.min!=null&&a.max!=null)s+=` entre ${clp.format(a.min)} y ${clp.format(a.max)}`;
  else if(a.max!=null)s+=` hasta ${clp.format(a.max)}`;else if(a.min!=null)s+=` desde ${clp.format(a.min)}`;
  return s;
}
function nearby(a){
  const pool=S.items.filter(avail);let r=[];
  if(a.toks.length)r=pool.filter(i=>a.toks.some(t=>t.length>=3&&norm(i.name).includes(t.slice(0,3))));
  if(!r.length&&a.brand)r=pool.filter(i=>norm(brandOf(i.name))===a.brand);
  if(!r.length&&a.type)r=pool.filter(i=>i.type===a.type);
  if(!r.length&&a.max!=null)r=pool.filter(i=>i.price<=a.max*1.3);
  return r.sort((x,y)=>x.price-y.price).slice(0,4);
}

/* ================= respuestas ================= */
let ctx={last:null},pending=null;
function bot(m){chat.push({id:uuid(),from:'bot',ts:Date.now(),...m})}
function meSay(text){chat.push({id:uuid(),from:'me',ts:Date.now(),text})}
function handle(raw){
  const text=raw.trim();if(!text)return;meSay(text);
  const t=deac(text).replace(/[¿?¡!]/g,' ').replace(/\s+/g,' ').trim();
  if(pending&&pending.kind==='holdName'){const i=byId(pending.id);pending=null;if(live(i)&&!/^(cancela|no|olvida)/.test(t)){doHold(i,text);return}bot({text:'Ok, no la aparté.'});return}
  if(/^(hola|buenas|buen dia|buenos dias|buenas tardes|hey|wena)\b/.test(t)&&t.split(' ').length<=3){bot({text:`Hola${me.name?' '+me.name.split(' ')[0]:''}. Quedan **${nAvail()} disponibles**. Pregúntame por una cámara, una marca o un presupuesto.`,say:defaultSay()});return}
  if(/\b(ayuda|como funciona|que puedo|que haces|comandos)\b/.test(t)){help();return}
  if(/\b(resumen|cuanto (llevo|llevamos|vendi|vendimos|hemos)|total del dia|caja|cierre|ventas de hoy|como vamos)\b/.test(t)){summary();return}
  if(/^(deshace|deshacer|me equivoque|anula|anular)\b/.test(t)){const s=[...evSales()].reverse().find(x=>!x.void&&(!S.seller||x.sellerId===me.id));if(s)voidSale(s.id);else bot({text:'No hay ventas tuyas para anular en este evento.'});return}
  if(/^(vend[ií]|vendi|vendimos|se vendio|vendida|venta|vendela|vende|vender|cobra|cobrar)\b/.test(t)){sellIntent(t);return}
  if(/^(aparta|apartala|apartar|reserva|reservala|guarda|guardala)\b/.test(t)){holdIntent(t);return}
  if(/^(libera|liberala|desaparta|suelta|ya no la quiere)\b/.test(t)){releaseIntent(t);return}
  if(/^(agrega|agregar|anade|anadir|nueva|nuevo|ingresa|ingresar)\b/.test(t)){addIntent(text);return}
  if(!S.items.length){bot({text:S.seller?'El dueño todavía no carga cámaras. Cuando lo haga aparecen aquí al instante.':'Tu inventario está vacío. Escríbeme “agrega Nikon F3 350 lucas mínimo 320” o toca **+** para pegar tu lista entera.',say:S.seller?[]:['Pegar lista']});return}
  if(/\b(minimo|cuanto (le )?puedo (bajar|rebajar|dejar)|ultimo precio|rebaja|descuento)\b/.test(t)){minIntent(t);return}
  if(/\bapartad/.test(t)){const h=S.items.filter(i=>i.status==='apart'&&live(i));bot(h.length?{text:`Hay **${h.length}** ${h.length===1?'apartada':'apartadas'}:`,items:h.map(i=>i.id)}:{text:'No hay cámaras apartadas.'});return}
  find(t);
}
function find(t){
  const a=analyze(t);
  if(!a.toks.length&&!a.type&&!a.brand&&a.max==null&&a.min==null&&!a.beginner){overview();return}
  const all=match(a,S.items.filter(live)),av=all.filter(avail),held=all.filter(i=>i.status==='apart');
  if(!all.length){
    const sold=a.toks.length?match({...a,min:null,max:null},S.items.filter(i=>!live(i))):[];const near=nearby(a);
    if(sold.length){bot({text:`La **${sold[0].name}** ya se vendió.${near.length?' Puedes ofrecerle estas:':''}`,items:near.map(i=>i.id)});return}
    bot({text:`No tengo ${describe(a,2)}.${near.length?' Lo más parecido:':' Prueba con otra marca o con un tipo de cámara.'}`,items:near.map(i=>i.id),say:near.length?[]:defaultSay()});return;
  }
  if(all.length===1){const i=all[0];ctx.last=i.id;bot({text:i.status==='apart'?`Tengo una, pero está **apartada** (${i.holdFor||'sin nombre'}).`:`Sí, tengo ${a.type&&!a.toks.length?'una':'esta'}:`,items:[i.id],detail:true});return}
  let txt=`Tengo **${av.length}** ${describe(a,av.length)}`;txt+=held.length?`, más ${held.length} ${held.length===1?'apartada':'apartadas'}.`:'.';
  if(a.max!=null||a.min!=null||a.beginner)txt+=' Ordenadas por precio.';
  bot({text:txt,items:[...av,...held].map(i=>i.id),limit:6});
}
function overview(){
  const av=S.items.filter(avail);const by=TYPES.map(t=>[t,av.filter(i=>i.type===t).reduce((a,i)=>a+i.qty,0)]).filter(x=>x[1]);
  if(!by.length){bot({text:'No quedan cámaras disponibles.'});return}
  bot({text:`Quedan **${nAvail()} disponibles**: ${by.map(([t,n])=>`${n} ${n===1?t.toLowerCase():PLURAL[t].replace(/^de /,'')}`).join(', ')}.`,say:by.slice(0,5).map(([t])=>t==='Película'?'Rollos':t==='Formato medio'?'Formato medio':PLURAL[t].charAt(0).toUpperCase()+PLURAL[t].slice(1)).concat(['Ver todo'])});
}
function help(){bot({text:'Escríbeme como le hablarías a un compañero. Por ejemplo:',say:['¿Tienes Canon?','Algo bajo 100 lucas','Réflex para empezar','Vendí la Pentax en 200 efectivo','Aparta la Olympus para Diego','Resumen del día']})}
function summary(){
  const ok=evSales().filter(s=>!s.void),tot=ok.reduce((a,s)=>a+s.price,0),by=m=>ok.filter(s=>s.method===m).reduce((a,s)=>a+s.price,0);
  bot({text:ok.length?`Llevas **${clp.format(tot)}** en ${ok.length} ${ok.length===1?'venta':'ventas'}. Efectivo ${clp.format(by('Efectivo'))}, tarjeta ${clp.format(by('Tarjeta'))}, transferencia ${clp.format(by('Transferencia'))}. Quedan ${nAvail()} disponibles.`:`Todavía no hay ventas en “${S.event.name}”. Quedan ${nAvail()} disponibles.`,copyReport:ok.length>0});
}
function resolveItem(t,pool){
  const a=analyze(t);
  if(!a.toks.length&&!a.type&&!a.brand)return ctx.last&&pool.includes(byId(ctx.last))?[byId(ctx.last)]:[];
  return match({...a,min:null,max:null,beginner:false},pool);
}
function sellIntent(t){
  let body=t.replace(/^(vend[ií]|vendi|vendimos|se vendio|vendida|venta( de)?|vendela|vende|vender|cobra|cobrar)\s*/,'');
  const mm=takeMethod(body);body=mm.rest;const pool=S.items.filter(live);
  const pr=takePrice(body,num=>pool.some(i=>norm(i.name).includes(num)));body=pr.rest;
  const c=resolveItem(body,pool);
  if(!c.length){bot({text:body?'No encuentro esa cámara entre las que quedan. ¿Cómo se llama?':'¿Cuál vendiste? Escríbeme la marca o el modelo.'});return}
  if(c.length>1){bot({text:'¿Cuál de estas?',items:c.map(i=>i.id),pick:{price:pr.price,method:mm.method},limit:6});return}
  startSell(c[0],pr.price,mm.method);
}
function startSell(i,price,method){
  ctx.last=i.id;if(!live(i)){bot({text:`La ${i.name} ya está vendida.`});return}
  bot({text:i.status==='apart'?`Ojo: está apartada (${i.holdFor||'sin nombre'}). Si igual la vendes, confirma:`:'Confirma la venta:',confirm:{id:i.id,price:price||i.price,method:method||'Efectivo',state:'open'}});
}
function holdIntent(t){
  let body=t.replace(/^(aparta|apartala|apartar|reserva|reservala|guarda|guardala)\s*/,'');let who='';
  const m=body.match(/\b(para|a nombre de|de)\s+(.+)$/);const pool=S.items.filter(avail);
  if(m){const tryRest=body.slice(0,m.index).trim();if(resolveItem(tryRest,pool).length||!tryRest){who=m[2];body=tryRest}}
  const c=resolveItem(body,pool);
  if(!c.length){bot({text:'No encuentro esa cámara entre las disponibles.'});return}
  if(c.length>1){bot({text:'¿Cuál apartamos?',items:c.map(i=>i.id),pickHold:who||'',limit:6});return}
  if(who)doHold(c[0],who.charAt(0).toUpperCase()+who.slice(1));else askHold(c[0]);
}
function askHold(i){ctx.last=i.id;pending={kind:'holdName',id:i.id};bot({text:`¿A nombre de quién apartamos la **${i.name}**? Puedes agregar a qué hora vuelve.`})}
function doHold(i,who){ctx.last=i.id;enqueue({kind:'hold',id:uuid(),item_id:i.id,who});bot({text:`Listo, **${i.name}** apartada para ${who}.`,undo:{hold:i.id}})}
function releaseIntent(t){
  const body=t.replace(/^(libera|liberala|desaparta|suelta|ya no la quiere)\s*/,'');
  const pool=S.items.filter(i=>i.status==='apart'&&live(i));
  const c=body?resolveItem(body,pool):(pool.length===1?pool:resolveItem('',pool));
  if(!c.length){bot({text:pool.length?'¿Cuál liberamos?':'No hay cámaras apartadas.',items:pool.map(i=>i.id)});return}
  if(c.length>1){bot({text:'¿Cuál liberamos?',items:c.map(i=>i.id)});return}
  doRelease(c[0]);
}
function doRelease(i){enqueue({kind:'release',id:uuid(),item_id:i.id});bot({text:`**${i.name}** vuelve a estar disponible.`})}
function minIntent(t){
  const body=t.replace(/\b(cual es el|cuanto (le )?puedo (bajar|rebajar|dejar)|minimo|ultimo precio|rebaja|descuento|precio)\b/g,' ');
  const c=resolveItem(body,S.items.filter(live));
  if(c.length!==1){bot({text:c.length?'¿De cuál?':'¿De qué cámara? Dime la marca o el modelo.',items:c.map(i=>i.id),limit:6});return}
  const i=c[0];ctx.last=i.id;const min=i.min||i.price;
  bot({text:min<i.price?`La **${i.name}** está en ${clp.format(i.price)}. Puedes dejarla hasta en **${clp.format(min)}**.`:`La **${i.name}** tiene precio fijo: ${clp.format(i.price)}.`});
}
async function addIntent(text){
  if(S.seller){bot({text:'Solo el dueño puede agregar cámaras.'});return}
  let body=text.replace(/^\s*(agrega|agregar|añade|anade|añadir|anadir|nueva|nuevo|ingresa|ingresar)\s*(una|un|la|el)?\s*(camara|cámara)?\s*/i,'');
  let min=null;const mm=body.match(/m[ií]nimo\s*\$?\s*([\d.]+)\s*(lucas?|mil|k)?/i);if(mm){min=toCLP(mm[1],mm[2]);body=body.replace(mm[0],' ')}
  let cond='Muy buena';for(const c of CONDS){const re=new RegExp(c,'i');if(re.test(body)||re.test(deac(body))){cond=c;body=body.replace(re,' ')}}
  const pr=takePrice(body);body=pr.rest.replace(/\s+/g,' ').replace(/[,;]+$/,'').trim();
  if(!body||!pr.price){bot({text:'Para agregar escríbeme modelo y precio. Por ejemplo: “agrega Nikon F3 350 lucas mínimo 320”. También puedes pegar una lista entera con el botón +.',say:['Pegar lista']});return}
  const name=body.charAt(0).toUpperCase()+body.slice(1);
  const row={name,type:guessType(name),cond,price:pr.price,min_price:min&&min<=pr.price?min:pr.price,qty:1};
  const {data,error}=await sb.from('items').insert(row).select().single();
  if(error){bot({text:isNet(error)?'Necesito señal para agregar cámaras. Inténtalo de nuevo en un momento.':'No pude agregarla: '+error.message});after();return}
  if(!base.items.some(r=>r.id===data.id))base.items.push(data);derive();ctx.last=data.id;
  bot({text:`Agregada como ${row.type.toLowerCase()}, estado ${cond.toLowerCase()}. Toca la ficha para completar qué decirle al cliente y lo probado.`,items:[data.id],editHint:data.id});after();
}
const defaultSay=()=>['¿Qué hay bajo 100 lucas?','Réflex para empezar','Compactas','Apartadas','Resumen del día'];

/* ================= acciones ================= */
function confirmSale(msg){
  const c=msg.confirm,i=byId(c.id);if(!live(i)||c.state!=='open')return;
  const min=i.min||i.price;if(c.price<min)return;
  const op={kind:'sell',id:uuid(),item_id:i.id,name:i.name,list:i.price,price:c.price,method:c.method,sold_at:new Date().toISOString()};
  c.state='done';c.sale=op.id;enqueue(op);
  bot({text:`**Vendida.** ${i.name} en ${clp.format(op.price)} (${op.method.toLowerCase()}). Quedan ${nAvail()} disponibles.${online?'':' Sin señal: se enviará apenas vuelva.'}`,undo:{sale:op.id}});
  try{navigator.vibrate&&navigator.vibrate(30)}catch(e){}
}
function voidSale(id){
  const s=S.sales.find(x=>x.id===id);if(!s||s.void)return;
  const k=outbox.findIndex(o=>o.kind==='sell'&&o.id===id);
  if(k>=0){outbox.splice(k,1);derive();saveCache()}else enqueue({kind:'void',id:uuid(),sale_id:id,item_id:s.itemId});
  chat.forEach(m=>{if(m.undo&&m.undo.sale===id)m.undone=true});
  bot({text:`Anulé la venta de **${s.name}**. Vuelve a estar disponible.`});
}

/* ================= render chat ================= */
function cardHTML(i){return `<button class="card ${live(i)?'':'dim'}" data-open="${i.id}"><span class="thumb">${thumb(i)}</span><span class="mid"><span class="nm">${esc(i.name)}</span><span class="meta">${esc(i.type)} · ${esc(i.cond)}${i.status==='apart'&&i.holdFor&&live(i)?' · '+esc(i.holdFor):''}</span></span><span class="right"><span class="price num">${clp.format(i.price)}</span>${dot(i)}</span></button>`}
function bigHTML(i){
  return `<div class="big"><button class="top" data-open="${i.id}"><span class="thumb">${thumb(i)}</span><span style="min-width:0;flex:1"><h4>${esc(i.name)}</h4><div class="meta">${esc(i.type)} · ${esc(i.cond)}</div></span></button>
  <div class="pr"><span class="price num">${clp.format(i.price)}</span>${dot(i)}</div>
  ${i.pitch?`<div class="pitch">${esc(i.pitch)}</div>`:''}
  ${live(i)?`<div class="acts"><button class="btn primary" data-sell="${i.id}">Vender</button>${i.status==='apart'?`<button class="btn" data-release="${i.id}">Liberar</button>`:`<button class="btn" data-hold="${i.id}">Apartar</button>`}<button class="btn ghost" data-open="${i.id}" style="flex:0 0 auto">Ficha</button></div>`:''}</div>`;
}
function confirmHTML(m){
  const c=m.confirm,i=byId(c.id);if(!i)return '';
  if(c.state==='done'){const s=S.sales.find(x=>x.id===c.sale);return `<div class="confirmc done"><h4>${esc(i.name)}</h4><span class="state">${!s?'Venta no registrada':s.void?'Venta registrada y luego anulada':s.pending?'Venta guardada · esperando señal':'Venta registrada'}</span></div>`}
  if(c.state==='cancel')return `<div class="confirmc done"><h4>${esc(i.name)}</h4><span class="state">Venta cancelada</span></div>`;
  if(!live(i))return `<div class="confirmc done"><h4>${esc(i.name)}</h4><span class="state">Ya no está disponible</span></div>`;
  const min=i.min||i.price,below=c.price<min;
  const opts=[...new Set([i.price,Math.round((i.price+min)/2/1000)*1000,min])].filter(v=>v>=min&&v<=i.price);
  return `<div class="confirmc"><h4>${esc(i.name)}</h4>
    <div class="opts">${opts.map((v,k)=>`<button class="opt num" data-cm="${m.id}" data-cprice="${v}" aria-pressed="${c.price===v}">${k===0?'Lista ':v===min&&k?'Mínimo ':''}${clp.format(v)}</button>`).join('')}</div>
    ${below?`<div class="warn">${clp.format(c.price)} está bajo el mínimo autorizado (${clp.format(min)}). Elige un precio de arriba o consulta al dueño.</div>`:''}
    <div class="opts">${['Efectivo','Tarjeta','Transferencia'].map(x=>`<button class="opt" data-cm="${m.id}" data-cmethod="${x}" aria-pressed="${c.method===x}">${x}</button>`).join('')}</div>
    <div class="ctotal"><span class="state">Total</span><span class="price num">${clp.format(c.price)}</span></div>
    <div class="btnrow"><button class="btn" data-cm="${m.id}" data-ccancel="1" style="flex:0 1 110px">Cancelar</button><button class="btn primary" data-cm="${m.id}" data-cok="1" ${below?'disabled':''}>Confirmar venta</button></div></div>`;
}
function msgHTML(m){
  if(m.from==='me')return `<div class="msg me"><div class="bubble">${esc(m.text)}</div></div>`;
  let h='<div class="msg bot">'+AP('av');
  if(m.text)h+=`<p>${fmt(m.text)}</p>`;
  if(m.items&&m.items.length){
    const its=m.items.map(byId).filter(Boolean);
    if(m.detail&&its.length===1)h+=bigHTML(its[0]);
    else if(its.length){const lim=m.limit||99,shown=its.slice(0,lim);
      h+=`<div class="stack">${shown.map(i=>{let x=cardHTML(i);
        if(m.pick&&live(i))x=x.replace(`data-open="${i.id}"`,`data-picksell="${i.id}" data-cm="${m.id}"`);
        if(m.pickHold!=null&&avail(i))x=x.replace(`data-open="${i.id}"`,`data-pickhold="${i.id}" data-cm="${m.id}"`);
        return x}).join('')}</div>`;
      if(its.length>lim)h+=`<button class="more" data-expand="${m.id}">Ver ${its.length-lim} más</button>`;}
  }
  if(m.confirm)h+=confirmHTML(m);
  if(m.undo&&!m.undone){const sale=m.undo.sale&&S.sales.find(s=>s.id===m.undo.sale);const holdOk=m.undo.hold&&byId(m.undo.hold)?.status==='apart';
    if((sale&&!sale.void)||holdOk)h+=`<button class="undo" data-undo="${m.id}">Deshacer</button>`}
  if(m.copyReport)h+=`<div class="say"><button data-act="copyReport">Copiar resumen</button></div>`;
  if(m.editHint&&!S.seller)h+=`<div class="say"><button data-edit="${m.editHint}">Completar ficha</button></div>`;
  if(m.say&&m.say.length)h+=`<div class="say">${m.say.map(s=>`<button data-say="${esc(s)}">${esc(s)}</button>`).join('')}</div>`;
  return h+'</div>';
}
function renderHome(){
  const held=S.items.filter(i=>i.status==='apart'&&live(i)).length;
  const first=(me.name||'').split(' ')[0];
  let sub=`${nAvail()} cámaras disponibles${held?' · '+held+' apartadas':''}`;
  if(!S.items.length)sub=S.seller?'El dueño todavía no carga cámaras.':'Tu inventario está vacío. Toca + para cargar tus cámaras.';
  return `<div class="home">${AP('ap')}<div class="hi gtext">Hola${first?' '+esc(first):''}</div><h1>¿Qué busca el cliente?</h1><p class="num">${esc(sub)}</p></div>`;
}
function renderChat(scroll=true){
  if(!me.role)return;
  const home=!chat.length;document.body.classList.toggle('home',home);
  $('#chat').innerHTML=home?renderHome():chat.map(msgHTML).join('');
  renderHeader();renderSugg();
  if(scroll&&!home)requestAnimationFrame(()=>window.scrollTo({top:document.body.scrollHeight,behavior:'smooth'}));
}
function renderHeader(){
  if(!me.role)return;
  const ok=evSales().filter(s=>!s.void),tot=ok.reduce((a,s)=>a+s.price,0);
  $('#hName').textContent=S.event.name||'Puesto';
  const net=!online?`<span class="netpill off">Sin señal${outbox.length?' · '+outbox.length+' por enviar':''}</span>`:outbox.length?`<span class="netpill">Enviando ${outbox.length}</span>`:'';
  $('#hStats').innerHTML=net?net+` <span class="num">${nAvail()} disp.</span>`:`<span class="num">${nAvail()} disponibles · <i>${clp.format(tot)}</i></span>${S.seller?' <span class="badge">Vendedor</span>':''}`;
  $('#meAv').textContent=((me.name||me.email||'?').trim()[0]||'?').toUpperCase();
}
function renderSugg(){
  let s;const last=ctx.last&&byId(ctx.last);
  if(pending)s=['Cancelar'];
  else if(!S.items.length)s=S.seller?[]:['Pegar lista','Ayuda'];
  else if(last&&live(last))s=[`Mínimo de la ${brandOf(last.name)}`,'Algo más barato','Resumen del día','Ayuda'];
  else s=defaultSay();
  $('#sugg').innerHTML=s.map(x=>`<button data-say="${esc(x)}">${esc(x)}</button>`).join('');
}
function after(){saveCache();renderChat()}
function send(text){
  if(text==='Pegar lista'){if(!S.seller){openImport()}return}
  if(text==='Ver todo'){meSay(text);const av=S.items.filter(live).sort((a,b)=>(avail(b)-avail(a))||a.price-b.price);bot({text:`Todo el listado (${av.length}):`,items:av.map(i=>i.id),limit:8});after();return}
  if(text==='Algo más barato'&&ctx.last){const l=byId(ctx.last);meSay(text);const c=S.items.filter(i=>avail(i)&&i.price<l.price&&i.type===l.type).sort((a,b)=>b.price-a.price);
    bot(c.length?{text:`${c.length===1?'Hay una':'Hay '+c.length} ${c.length>1?PLURAL[l.type]:l.type.toLowerCase()} más barata${c.length>1?'s':''}:`,items:c.map(i=>i.id),limit:6}:{text:`No hay ${PLURAL[l.type]} más baratas que esa.`});after();return}
  const r=handle(text);saveCache();renderChatTyping();setTimeout(()=>renderChat(),260);
}
function renderChatTyping(){
  document.body.classList.remove('home');
  $('#chat').innerHTML=chat.slice(0,-1).map(msgHTML).join('')+'<div class="msg bot">'+AP('av')+'<div class="typing"><i></i><i></i><i></i></div></div>';
  requestAnimationFrame(()=>window.scrollTo({top:document.body.scrollHeight,behavior:'smooth'}));
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
    ${i.status==='apart'&&i.holdFor&&live(i)?`<div class="note" style="margin-top:10px;background:var(--hold-bg);border-color:transparent"><b>Apartada:</b> ${esc(i.holdFor)}</div>`:''}
    <div class="pricebox"><div><small>Precio</small><span class="price num">${clp.format(i.price)}</span></div>${min<i.price?`<button class="reveal" data-act="toggleMin">${showMin?`Mínimo<b class="num">${clp.format(min)}</b>`:'Ver mínimo'}</button>`:'<small>Precio fijo</small>'}</div>
    ${i.pitch?`<div class="pitchbox"><small>Qué decirle al cliente</small><p>${esc(i.pitch)}</p></div>`:''}
    ${i.tested.length?`<h3>Probado y funcionando</h3><div class="checks">${i.tested.map(t=>`<span>✓ ${esc(t)}</span>`).join('')}</div>`:''}
    ${i.notes?`<h3>Detalles y defectos</h3><div class="note">${esc(i.notes)}</div>`:''}
    ${i.qty>1?`<p class="hint num">Quedan ${i.qty} unidades.</p>`:''}
    ${alts.length?`<h3>Si no la convence, ofrécele</h3><div class="stack">${alts.map(cardHTML).join('')}</div>`:''}`;
  const f=[];
  if(live(i)){f.push(i.status==='apart'?`<button class="btn" data-release="${i.id}" style="flex:0 1 120px">Liberar</button>`:`<button class="btn" data-hold="${i.id}" style="flex:0 1 120px">Apartar</button>`);f.push(`<button class="btn primary" data-sell="${i.id}">Vender</button>`)}
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
      <div class="list">${items.map(i=>`<div class="row"><span class="thumb">${thumb(i)}</span><button class="info" data-edit="${i.id}"><b>${esc(i.name)}</b><span class="num">${clp.format(i.price)} · mín. ${clp.format(i.min||i.price)}${i.status==='apart'&&live(i)?' · apartada':''}</span></button><div class="step"><button data-dec="${i.id}" aria-label="Restar unidad">−</button><output class="num" style="color:var(--${i.qty<=0?'bad':'ink'})">${i.qty}</output><button data-inc="${i.id}" aria-label="Sumar unidad">+</button></div></div>`).join('')||'<div class="empty">Aún no hay cámaras.</div>'}</div>`;
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
  $('#ePrice').value=i?.price??'';$('#eMin').value=i?.min??'';$('#ePitch').value=i?.pitch||'';$('#eNotes').value=i?.notes||'';
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
  if(d.picksell){const m=msgById(d.cm);startSell(byId(d.picksell),m?.pick?.price,m?.pick?.method);after();return}
  if(d.pickhold){const m=msgById(d.cm),i=byId(d.pickhold);if(m.pickHold)doHold(i,m.pickHold);else askHold(i);after();return}
  if(d.expand){const m=msgById(d.expand);m.limit=999;saveCache();renderChat(false);return}
  if(d.cm){const m=msgById(d.cm);if(!m||!m.confirm)return;
    if(d.cprice){m.confirm.price=+d.cprice;saveCache();renderChat(false);return}
    if(d.cmethod){m.confirm.method=d.cmethod;saveCache();renderChat(false);return}
    if(d.ccancel){m.confirm.state='cancel';saveCache();renderChat(false);return}
    if(d.cok){confirmSale(m);after();return}}
  if(d.undo){const m=msgById(d.undo);if(m.undo.sale)voidSale(m.undo.sale);else if(m.undo.hold){const i=byId(m.undo.hold);m.undone=true;if(i)enqueue({kind:'release',id:uuid(),item_id:i.id});bot({text:'Deshecho. Vuelve a estar disponible.'})}after();return}
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
      if(!(price>0)){toast('Falta el precio de venta');$('#ePrice').focus();break}
      if(!(qty>=0)||$('#eQty').value===''){toast('Revisa las unidades');$('#eQty').focus();break}
      const min=minRaw===''?price:Math.round(+minRaw);if(!(min>0)||min>price){toast('El mínimo debe estar entre 1 y el precio');$('#eMin').focus();break}
      t.disabled=true;let photo=ePhoto;
      if(ePhotoBlob){try{photo=await uploadPhoto(ePhotoBlob)}catch(err){toast(isNet(err)?'Necesitas señal para subir la foto':'No se pudo subir la foto');t.disabled=false;break}}
      const row={name,price,min_price:min,qty,type:$('#eType').value,cond:$('#eCond').value,tested:eTests,pitch:$('#ePitch').value.trim(),notes:$('#eNotes').value.trim(),photo_url:photo.startsWith('data:')?'':photo};
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
$('#composer').addEventListener('submit',e=>{e.preventDefault();const v=$('#msg').value.trim();if(!v)return;$('#msg').value='';$('#sendBtn').disabled=true;document.body.classList.remove('typing');send(v)});
$('#msg').addEventListener('input',e=>{$('#sendBtn').disabled=!e.target.value.trim();document.body.classList.toggle('typing',!!e.target.value)});
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
