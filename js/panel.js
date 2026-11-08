/* Puesto · Panel del dueño (inventario, ventas, ajustes), editor, importar y utilidades */
'use strict';
/* ================= menú ================= */
let menuTab='inventario';
async function openMenu(tab){menuTab=tab||(S.seller?'ventas':'inventario');renderMenu();openSheet('menuSheet');
  if(!S.seller&&menuTab==='ajustes')loadInvite();}
async function loadInvite(){const {data}=await sb.from('secrets').select('invite_code').eq('id',1).maybeSingle();if(data){inviteCode=data.invite_code;if(menuTab==='ajustes')renderMenu()}}
let invQ='',invF='all',invEdit=null;
function renderMenu(){
  const tabs=S.seller?[['ventas','Ventas'],['ajustes','Cuenta']]:[['inventario','Inventario'],['ventas','Ventas'],['ferias','Ferias'],['ajustes','Ajustes']];
  if(!tabs.some(t=>t[0]===menuTab))menuTab=tabs[0][0];
  $('#menuSeg').innerHTML=tabs.map(([k,l])=>`<button data-mtab="${k}" aria-pressed="${k===menuTab}">${l}</button>`).join('');
  let h='';
  if(menuTab==='inventario'){
    const L=S.items,tot=i=>i.total!=null?i.total:i.qty,units=L.reduce((x,i)=>x+tot(i),0),here_=L.reduce((x,i)=>x+i.qty,0),value=L.reduce((x,i)=>x+i.price*tot(i),0),noPrice=L.filter(i=>tot(i)>0&&!i.price).length,out=L.filter(i=>!tot(i)).length;
    h=`<div class="ikpi"><div><small>Unidades</small><b class="num">${units}</b><span class="num">${S.places.length>1?here_+' en '+esc(S.event.name):L.length+' productos'}</span></div><div><small>Valor a precio lista</small><b class="num">${clp.format(value)}</b><span class="num">${L.length} productos</span></div></div>
      <div class="btnrow"><button class="btn primary" data-act="newItem">+ Agregar</button><button class="btn" data-act="openImport">Pegar lista</button></div>
      <div class="isearch"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><input id="invQ" value="${esc(invQ)}" placeholder="Buscar en el inventario" autocomplete="off" enterkeyhint="search"></div>
      <div class="ichips">${[['all','Todo'],['cam','Cámaras'],['acc','Accesorios'],['noprice',`Sin precio${noPrice?' '+noPrice:''}`],['out',`Agotados${out?' '+out:''}`]].map(([k,l])=>`<button data-invf="${k}" aria-pressed="${invF===k}">${l}</button>`).join('')}</div>
      <div id="invList"></div>
      <p class="hint">Toca el precio para cambiarlo. Los botones − + cambian las unidades ${S.places.length>1?'en <b>'+esc(S.event.name)+'</b>':''}. Toca el nombre para editar la ficha.</p>`;
  }else if(menuTab==='ventas'){
    const all=evSales(),ok=all.filter(s=>!s.void);
    const who=id=>{const m=base.members.find(x=>x.user_id===id);return m?(m.user_id===me.id?'tú':(m.name||(m.role==='owner'?'dueño':'vendedor'))):''};
    h=(ok.length?summaryHTML():`<div class="sum"><div class="sumh"><small>${esc(S.event.name)}</small><b class="num">$0</b><span>Sin ventas todavía</span></div></div>`)+
      `<h3>Ventas del evento</h3><div class="slist">${[...all].reverse().map(s=>{const canVoid=!S.seller||(s.sellerId===me.id&&Date.now()-s.ts<30*60e3);
        return `<div class="vrow ${s.void?'void':''}"><div class="vt num">${new Date(s.ts).toLocaleTimeString('es-CL',{hour:'2-digit',minute:'2-digit'})}</div><div class="vm"><b>${esc(s.name)}</b><span class="num">${s.method}${s.price<s.list?` · rebaja ${clp.format(s.list-s.price)}`:''}${who(s.sellerId)?' · '+esc(who(s.sellerId)):''}${s.pending?' · por enviar':''}${s.void?' · anulada':''}</span></div><div class="vr"><b class="num">${clp.format(s.price)}</b>${!s.void&&canVoid?`<button class="link" data-voidm="${s.id}">Anular</button>`:''}</div></div>`}).join('')||'<div class="empty">Las ventas aparecen aquí al instante.</div>'}</div>
      ${!S.seller&&S.places.filter(p=>p.kind==='feria').length>1?`<h3>Todas las ferias abiertas</h3><div class="slist">${S.places.filter(p=>p.kind==='feria').map(p=>{const v=salesAt(p.id);return `<div class="vrow"><div class="vm"><b>${esc(p.name)}</b><span class="num">${v.length} ${plural(v.length,'venta','ventas')}</span></div><div class="vr"><b class="num">${clp.format(sum(v,s=>s.price))}</b></div></div>`}).join('')}</div>`:''}
      <h3>Cierre</h3><div class="btnrow"><button class="btn" data-act="copyReport">Copiar resumen</button>${S.seller?'':'<button class="btn" data-act="downloadCSV">Descargar CSV</button>'}</div>${S.seller?'':'<button class="btn" style="width:100%;margin-top:8px" data-act="openFerias">Cerrar o abrir ferias</button>'}`;
  }else if(menuTab==='ferias'){h=feriasHTML()}else{
    const acct=`<h3>Tu cuenta</h3><div class="acard"><span class="aav">${esc(((me.name||me.email||'?').trim()[0]||'?').toUpperCase())}</span><div><b>${esc(me.name||me.email)}</b><span>${esc(me.email)} · ${me.role==='owner'?'Dueño':'Vendedor'}</span></div></div>
      <div class="btnrow" style="margin-top:10px"><button class="btn" data-act="clearChat">Limpiar asistente</button><button class="btn danger" data-act="signOut">Cerrar sesión</button></div>`;
    if(S.seller)h=acct;
    else{
      const sellers=base.members.filter(m=>m.role==='seller');
      h=`<h3>Invitar a un vendedor</h3>
      <div class="invite"><small>Código del puesto</small><b class="num" id="codeTxt">${esc(inviteCode||'······')}</b><span>El vendedor abre <u>${esc(location.host+location.pathname)}</u>, crea su cuenta y escribe este código.</span>
        <div class="btnrow"><button class="btn primary" data-act="shareInvite">Compartir</button><button class="btn" data-act="copyCode">Copiar código</button></div></div>
      <h3>Vendedores</h3><div class="slist">${sellers.map(m=>`<div class="vrow"><div class="vm"><b>${esc(m.name||'Sin nombre')}</b><span>Desde ${new Date(m.created_at).toLocaleDateString('es-CL')}</span></div><div class="vr"><button class="link danger" data-rmember="${m.user_id}">Quitar</button></div></div>`).join('')||'<div class="empty">Aún no hay vendedores.</div>'}</div>
      <div id="rmBox"></div>
      <button class="link" data-act="rotateCode" style="padding-left:0">Cambiar el código de invitación</button>
      ${acct}`;
    }
  }
  $('#menuBody').innerHTML=h;
  if(menuTab==='inventario')renderInvList();
}
function renderInvList(){
  const el=$('#invList');if(!el)return;
  let L=[...S.items];
  const tot=i=>i.total!=null?i.total:i.qty;
  if(invF==='cam')L=L.filter(isCam);if(invF==='acc')L=L.filter(i=>!isCam(i));if(invF==='noprice')L=L.filter(i=>tot(i)>0&&!i.price);if(invF==='out')L=L.filter(i=>!tot(i));
  if(invQ.trim()){const t=norm(invQ);L=L.filter(i=>norm(i.name+' '+i.type+' '+i.compatible).includes(t)||t.split(/(?=\d)/).every(x=>norm(i.name).includes(x)))}
  L.sort((a,b)=>((tot(b)>0)-(tot(a)>0))||a.name.localeCompare(b.name));
  el.innerHTML=L.length?`<div class="slist">${L.map(i=>`<div class="irow${tot(i)?'':' dim'}"><button class="im" data-edit="${i.id}"><b>${esc(i.name)}</b><span class="num">${tot(i)!==i.qty?tot(i)+' en total · ':''}${esc(i.type)}${i.min&&i.min<i.price?' · mín. '+clp.format(i.min):''}${i.held?' · '+i.held+' apart.':''}</span></button>
    ${invEdit===i.id?`<label class="ipin"><span>$</span><input id="ipe" class="num" type="number" inputmode="numeric" step="1000" min="0" value="${i.price||''}" data-ipid="${i.id}"></label>`:`<button class="ipr num${i.price?'':' np'}" data-ipe="${i.id}">${i.price?clp.format(i.price):'Poner precio'}</button>`}
    <div class="step"><button data-dec="${i.id}" aria-label="Restar unidad">−</button><output class="num${i.qty?'':' bad'}">${i.qty}</output><button data-inc="${i.id}" aria-label="Sumar unidad">+</button></div></div>`).join('')}</div>`:'<div class="empty">No hay productos con ese filtro.</div>';
  if(invEdit){const x=$('#ipe');if(x){x.focus();x.select()}}
}
async function savePrice(id,v){
  if(invEdit!==id)return;invEdit=null;const i=byId(id);v=Math.round(+v);if(!i||!(v>=0)||v===i.price){renderInvList();return}
  const row={price:v};if((i.min||0)>v)row.min_price=v;
  const r=base.items.find(x=>x.id===id);const prev={...r};Object.assign(r,{price:v,min_price:row.min_price??r.min_price});derive();renderInvList();
  const ok=await ownerWrite(sb.from('items').update(row).eq('id',id).select().single(),`Precio: ${clp.format(v)}`);
  if(ok){Object.assign(r,ok)}else Object.assign(r,prev);derive();renderInvList();if(mode==='search')renderSearch();
}

/* ================= editor + importar ================= */
let editing=null,eTests=[],ePhoto='',ePhotoBlob=null,impRows=[];
function openEdit(i){
  editing=i?i.id:null;eTests=[...(i?.tested||[])];ePhoto=i?.photo||'';ePhotoBlob=null;
  $('#editTitle').textContent=i?'Editar cámara':'Nueva cámara';
  $('#eName').value=i?.name||'';$('#eQty').value=i?.qty??1;$('#eQtyLbl').textContent=S.places.length>1?'Unidades en '+S.event.name:'Unidades';
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
const msgById=id=>id==='pos'?coMsg:chat.find(m=>m.id===id);
async function ownerWrite(promise,okMsg){
  const {data,error}=await promise;
  if(error){toast(isNet(error)?'Necesitas señal para editar el inventario':'No se pudo guardar: '+error.message);return null}
  if(okMsg)toast(okMsg);return data;
}

/* --- stock por lugar (dueño) --- */
const addTo=()=>multi()&&here?{add_to:here}:{};
function addedItem(r){if(!base.items.some(x=>x.id===r.id))base.items.push(r);
  if(multi()&&r.qty>0){const pid=placeById(r.add_to)&&placeById(r.add_to).open?r.add_to:bodegaId();if(pid&&!base.stock.some(x=>x.item_id===r.id&&x.place_id===pid))base.stock.push({item_id:r.id,place_id:pid,qty:r.qty,held:0,hold_for:''})}}
async function setStock(id,q){
  if(!multi()){const ok=await ownerWrite(sb.from('items').update({qty:q}).eq('id',id).select().single());if(ok){const r=base.items.find(x=>x.id===id);Object.assign(r,ok);derive()}return !!ok}
  const k=base.stock.findIndex(x=>x.item_id===id&&x.place_id===here);const prev=k>=0?{...base.stock[k]}:null;
  if(k>=0)base.stock[k].qty=q;else base.stock.push({item_id:id,place_id:here,qty:q,held:0,hold_for:''});derive();renderHeader();
  const {error}=await sb.rpc('set_stock',{p_item_id:id,p_place_id:here,p_qty:q});
  if(error){toast(isNet(error)?'Necesitas señal para editar el inventario':'No se pudo: '+(PERM[errCode(error)]||error.message));
    const j=base.stock.findIndex(x=>x.item_id===id&&x.place_id===here);if(prev)base.stock[j]=prev;else base.stock.splice(j,1);derive();return false}
  if(q===0)base.stock=base.stock.filter(x=>!(x.item_id===id&&x.place_id===here));
  derive();saveCache();return true;
}
