/* Puesto · Varias ferias: elegir dónde vendo, mover cámaras entre lugares y administrar ferias */
'use strict';
const sum=(a,f)=>a.reduce((x,y)=>x+f(y),0);
// unidades (o libres) de un producto en un lugar, incluida la cola sin señal
function qtyAt(i,pid){if(pid===here)return i.qty;const w=(i.where||[]).find(x=>x.id===pid);return w?w.qty:0}
function freeAt(i,pid){if(pid===here)return free(i);const w=(i.where||[]).find(x=>x.id===pid);return w?w.free:0}
const unitsAt=pid=>sum(S.items,i=>qtyAt(i,pid));
const salesAt=pid=>S.sales.filter(s=>s.place===pid&&!s.void);
const sellersOf=pid=>base.pm.filter(m=>m.place_id===pid).map(m=>base.members.find(x=>x.user_id===m.user_id)).filter(m=>m&&m.role==='seller');
const kindLbl=p=>p.kind==='bodega'?'Bodega':'Feria';

/* ---------- ¿dónde estoy vendiendo? ---------- */
function openPlaces(){renderPlaces();openSheet('placeSheet')}
function renderPlaces(){
  const L=S.places;
  $('#placeBody').innerHTML=`<div class="plist">${L.map(p=>{const ok=salesAt(p.id),u=unitsAt(p.id);
    return `<button class="prow${p.id===here?' on':''}" data-here="${p.id}"><span class="pk ${p.kind}">${p.kind==='bodega'?'B':esc((p.name.trim()[0]||'F').toUpperCase())}</span><span class="pm"><b>${esc(p.name)}</b><span class="num">${u} ${plural(u,'unidad','unidades')}${p.kind==='feria'?` · ${clp.format(sum(ok,s=>s.price))} en ${ok.length} ${plural(ok.length,'venta','ventas')}`:''}</span></span>${p.id===here?'<span class="pchk">✓</span>':''}</button>`}).join('')}</div>
    ${L.length>1?`<button class="btn" style="width:100%;margin-top:12px" data-act="openMove">Mover cámaras entre ${S.seller?'mis ferias':'lugares'}</button>`:''}
    ${S.seller?'':'<button class="btn primary" style="width:100%;margin-top:8px" data-act="openFerias">Abrir, cerrar y asignar ferias</button>'}`;
}

/* ---------- mover cámaras ---------- */
let mv={from:null,to:null,q:'',sel:{}};
function openMove(from,to){
  const L=S.places;if(L.length<2){toast('Necesitas al menos dos lugares');return}
  mv={from:from||here||L[0].id,to:null,q:'',sel:{}};
  mv.to=to&&to!==mv.from?to:(L.find(p=>p.id!==mv.from&&p.kind==='feria')||L.find(p=>p.id!==mv.from)).id;
  renderMove();openSheet('moveSheet');$('#moveBody').scrollTop=0;
}
function renderMove(){
  const L=S.places,opt=sel=>L.map(p=>`<option value="${p.id}" ${p.id===sel?'selected':''}>${esc(p.name)}</option>`).join('');
  $('#moveHead').innerHTML=`<div class="mvsel"><label><small>Desde</small><select id="mvFrom">${opt(mv.from)}</select></label><button class="mvswap" data-act="mvSwap" aria-label="Invertir">⇄</button><label><small>Hacia</small><select id="mvTo">${opt(mv.to)}</select></label></div>
    <div class="isearch" style="margin-top:10px"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><input id="mvQ" value="${esc(mv.q)}" placeholder="Buscar modelo" autocomplete="off" enterkeyhint="search"></div>`;
  renderMoveList();
}
function renderMoveList(){
  let L=S.items.filter(i=>freeAt(i,mv.from)>0);
  if(mv.q.trim()){const t=norm(mv.q);L=L.filter(i=>norm(i.name+' '+i.type).includes(t)||t.split(/(?=\d)/).every(x=>norm(i.name).includes(x)))}
  L.sort((a,b)=>(isCam(b)-isCam(a))||a.name.localeCompare(b.name));
  const n=sum(Object.values(mv.sel),x=>x),total=sum(S.items.filter(i=>freeAt(i,mv.from)>0),i=>freeAt(i,mv.from));
  $('#moveBody').innerHTML=mv.from===mv.to?'<div class="empty">Elige dos lugares distintos.</div>':L.length?`<div class="mvall"><span class="num">${total} ${plural(total,'unidad libre','unidades libres')} en ${esc(placeName(mv.from))}</span><button class="link" data-act="mvAll">${n?'Limpiar':'Elegir todo'}</button></div><div class="slist">${L.map(i=>{const f=freeAt(i,mv.from),k=mv.sel[i.id]||0;
    return `<div class="irow${k?' pick':''}"><button class="im" data-mvone="${i.id}"><b>${esc(i.name)}</b><span class="num">${f} ${plural(f,'libre','libres')}${qtyAt(i,mv.to)?` · ya hay ${qtyAt(i,mv.to)} en destino`:''}</span></button>
      <div class="step"><button data-mvdec="${i.id}" aria-label="Menos" ${k?'':'disabled'}>−</button><output class="num">${k}</output><button data-mvinc="${i.id}" aria-label="Más" ${k>=f?'disabled':''}>+</button></div></div>`}).join('')}</div>`
    :`<div class="empty">${mv.q?'No hay coincidencias.':'No hay unidades libres en '+esc(placeName(mv.from))+'.'}</div>`;
  const b=$('#mvGo');b.disabled=!n||mv.from===mv.to;b.textContent=n?`Mover ${n} a ${placeName(mv.to)}`:'Elige qué mover';
}
function doMove(){
  const n=sum(Object.values(mv.sel),x=>x);if(!n||mv.from===mv.to)return;
  for(const [id,q] of Object.entries(mv.sel)){if(!q)continue;const i=byId(id);if(!i)continue;
    enqueue({kind:'move',id:uuid(),item_id:id,name:i.name,from:mv.from,to:mv.to,qty:Math.min(q,freeAt(i,mv.from))})}
  toast(`${n} ${plural(n,'unidad','unidades')} a ${placeName(mv.to)}${online?'':' · se enviará con señal'}`);
  closeSheet();refreshUI();
}
function moveOne(itemId,from,to){const i=byId(itemId);if(!i||freeAt(i,from)<1){toast('No quedan unidades libres ahí');return}
  enqueue({kind:'move',id:uuid(),item_id:itemId,name:i.name,from,to,qty:1});
  toast(to===here?`Traída desde ${placeName(from)}`:`Llevada a ${placeName(to)}`);refreshUI()}

/* ---------- pestaña Ferias (dueño) ---------- */
let fairOpen=null,fairBox=null;
function feriasHTML(){
  const L=[...S.places].sort((a,b)=>(a.kind==='bodega')-(b.kind==='bodega')||Date.parse(a.started_at)-Date.parse(b.started_at));
  const sellers=base.members.filter(m=>m.role==='seller');
  const newBox=fairBox==='new'?`<div class="fcard new"><label class="f" style="margin-top:0">Nombre de la feria<input id="nfName" placeholder="Ej: Feria Persa · Domingo" autocomplete="off"></label>
      ${sellers.length?`<small class="fl">¿Quién vende ahí?</small><div class="ftoggles">${sellers.map(m=>`<label class="ftog"><input type="checkbox" value="${m.user_id}" class="nfSel"><span>${esc(m.name||'Sin nombre')}</span></label>`).join('')}</div>`:''}
      <div class="btnrow"><button class="btn" data-act="cancelFair">Cancelar</button><button class="btn primary" data-act="doNewFair">Abrir feria</button></div></div>`:'';
  return `<div class="btnrow"><button class="btn primary" data-act="newFair">+ Nueva feria</button><button class="btn" data-act="openMove">Mover cámaras</button></div>${newBox}
    ${L.map(p=>{const ok=salesAt(p.id),u=unitsAt(p.id),sl=sellersOf(p.id),open=fairOpen===p.id;
      return `<div class="fcard${p.id===here?' here':''}"><div class="fh"><span class="pk ${p.kind}">${p.kind==='bodega'?'B':esc((p.name.trim()[0]||'F').toUpperCase())}</span><div class="fm"><b>${esc(p.name)}</b><span>${kindLbl(p)}${p.id===here?' · este celular':''}</span></div></div>
        <div class="fk num"><div><small>Unidades</small><b>${u}</b></div>${p.kind==='feria'?`<div><small>Vendido</small><b>${clp.format(sum(ok,s=>s.price))}</b></div><div><small>Ventas</small><b>${ok.length}</b></div>`:''}</div>
        ${p.kind==='feria'?`<div class="fsel">${sl.length?sl.map(m=>`<span>${esc(m.name||'Vendedor')}</span>`).join(''):'<span class="muted">Sin vendedores asignados</span>'}</div>`:''}
        <div class="btnrow">${p.id!==here?`<button class="btn" data-here="${p.id}">Usar aquí</button>`:''}<button class="btn" data-fopen="${p.id}">${open?'Listo':'Opciones'}</button></div>
        ${open?`<div class="fopts">
          <label class="f">Nombre<input class="fRen" data-pid="${p.id}" value="${esc(p.name)}"></label>
          ${p.kind==='feria'?`<small class="fl">Vendedores en esta feria</small>${sellers.length?`<div class="ftoggles">${sellers.map(m=>{const on=base.pm.some(x=>x.place_id===p.id&&x.user_id===m.user_id);return `<label class="ftog"><input type="checkbox" data-pmt="${p.id}:${m.user_id}" ${on?'checked':''}><span>${esc(m.name||'Sin nombre')}</span></label>`}).join('')}</div>`:'<p class="hint">Invita vendedores desde Ajustes.</p>'}
          <button class="btn" style="width:100%" data-act="openMoveTo" data-pid="${p.id}">Llevar cámaras a esta feria</button>
          ${fairBox==='close:'+p.id?`<div class="confirm" style="margin-top:10px">Las <b>${u}</b> ${plural(u,'unidad','unidades')} que quedan vuelven a la bodega (los apartados se liberan). Las ventas quedan guardadas.<div class="btnrow"><button class="btn" data-act="cancelFair">Cancelar</button><button class="btn danger" data-fclose="${p.id}">Cerrar feria</button></div></div>`
            :`<button class="btn danger" style="width:100%;margin-top:8px" data-act="askCloseFair" data-pid="${p.id}">Cerrar esta feria</button>`}`:''}
        </div>`:''}
      </div>`}).join('')}`;
}
async function doNewFair(){
  const name=($('#nfName').value||'').trim();if(!name){toast('Ponle nombre a la feria');$('#nfName').focus();return}
  const users=[...document.querySelectorAll('.nfSel:checked')].map(x=>x.value);
  const {data,error}=await sb.rpc('open_fair',{p_name:name,p_users:users});
  if(error){toast(isNet(error)?'Necesitas señal para abrir una feria':'No se pudo: '+error.message);return}
  if(!base.places.some(p=>p.id===data.id))base.places.push(data);
  users.forEach(u=>{if(!base.pm.some(m=>m.place_id===data.id&&m.user_id===u))base.pm.push({place_id:data.id,user_id:u})});
  fairBox=null;derive();saveCache();toast(`Feria abierta: ${data.name}`);
  openMove(here&&here!==data.id?here:bodegaId(),data.id);
}
async function closeFair(pid){
  const p=placeById(pid);const {data,error}=await sb.rpc('close_fair',{p_place_id:pid});
  if(error){toast(isNet(error)?'Necesitas señal para cerrar la feria':'No se pudo: '+error.message);return}
  fairBox=null;fairOpen=null;try{await loadAll()}catch(e){}derive();saveCache();renderMenu();renderHeader();if(mode==='search')renderSearch();
  toast(`${p?p.name:'Feria'} cerrada · ${data} ${plural(data,'unidad volvió','unidades volvieron')} a la bodega`);
}
async function togglePM(pid,uid,on){
  const q=on?sb.from('place_members').insert({place_id:pid,user_id:uid}).select():sb.from('place_members').delete().eq('place_id',pid).eq('user_id',uid).select();
  const ok=await ownerWrite(q,on?'Vendedor asignado':'Vendedor quitado de la feria');
  if(ok){if(on){if(!base.pm.some(m=>m.place_id===pid&&m.user_id===uid))base.pm.push({place_id:pid,user_id:uid})}else base.pm=base.pm.filter(m=>!(m.place_id===pid&&m.user_id===uid));derive();saveCache()}
  renderMenu();
}

/* ---------- toques ---------- */
document.addEventListener('click',async e=>{
  const t=e.target.closest('button,[data-act]');if(!t)return;const d=t.dataset;
  if(d.here){setHere(d.here);closeSheet();toast(`Vendiendo en ${placeName(d.here)}`);return}
  if(d.bring){const [it,from]=d.bring.split(':');moveOne(it,from,here);return}
  if(d.take){const [it,to]=d.take.split(':');moveOne(it,here,to);return}
  if(d.mvinc||d.mvdec){const id=d.mvinc||d.mvdec,i=byId(id),f=freeAt(i,mv.from);mv.sel[id]=Math.max(0,Math.min(f,(mv.sel[id]||0)+(d.mvinc?1:-1)));if(!mv.sel[id])delete mv.sel[id];renderMoveList();return}
  if(d.mvone){const i=byId(d.mvone),f=freeAt(i,mv.from);mv.sel[d.mvone]=(mv.sel[d.mvone]||0)>=f?0:f;if(!mv.sel[d.mvone])delete mv.sel[d.mvone];renderMoveList();return}
  if(d.fopen){fairOpen=fairOpen===d.fopen?null:d.fopen;fairBox=null;renderMenu();return}
  if(d.fclose){t.disabled=true;await closeFair(d.fclose);return}
  switch(d.act){
    case 'titleTap':if(S.places.length>1)openPlaces();else openMenu();break;
    case 'openPlaces':openPlaces();break;
    case 'openFerias':closeSheet(true);openMenu('ferias');break;
    case 'openMove':closeSheet(true);openMove();break;
    case 'openMoveTo':closeSheet(true);openMove(here!==d.pid?here:bodegaId(),d.pid);break;
    case 'mvSwap':[mv.from,mv.to]=[mv.to,mv.from];mv.sel={};renderMove();break;
    case 'mvAll':{const any=Object.keys(mv.sel).length;mv.sel={};if(!any)for(const i of S.items){const f=freeAt(i,mv.from);if(f>0)mv.sel[i.id]=f}renderMoveList();break}
    case 'doMove':doMove();break;
    case 'newFair':fairBox=fairBox==='new'?null:'new';renderMenu();if(fairBox)setTimeout(()=>$('#nfName')&&$('#nfName').focus(),50);break;
    case 'cancelFair':fairBox=null;renderMenu();break;
    case 'doNewFair':t.disabled=true;await doNewFair();t.disabled=false;break;
    case 'askCloseFair':fairBox='close:'+d.pid;renderMenu();break;
  }
});
document.addEventListener('change',async e=>{
  const el=e.target;
  if(el.id==='mvFrom'){mv.from=el.value;if(mv.to===mv.from)mv.to=(S.places.find(p=>p.id!==mv.from)||{}).id;mv.sel={};renderMove();return}
  if(el.id==='mvTo'){mv.to=el.value;renderMoveList();return}
  if(el.dataset&&el.dataset.pmt){const [pid,uid]=el.dataset.pmt.split(':');await togglePM(pid,uid,el.checked);return}
  if(el.classList&&el.classList.contains('fRen')){const v=el.value.trim(),pid=el.dataset.pid;if(!v)return;
    const ok=await ownerWrite(sb.from('places').update({name:v}).eq('id',pid).select().single(),'Nombre actualizado');
    if(ok){const k=base.places.findIndex(p=>p.id===pid);if(k>=0)base.places[k]=ok;derive();saveCache();renderHeader();renderMenu()}}
});
document.addEventListener('input',e=>{if(e.target.id==='mvQ'){mv.q=e.target.value;renderMoveList()}});
