/* Puesto · Manejo de toques, teclado y cambios */
'use strict';
/* ================= eventos ================= */
document.addEventListener('click',async e=>{
  const t=e.target.closest('button,[data-act]');if(!t)return;const d=t.dataset;
  if(t.id==='sendBtn')return;
  if(d.say){if(d.say==='Cancelar'&&pending){pending=null;meSay('Cancelar');bot({text:'Ok, cancelado.'});after();return}send(d.say);return}
  if(d.add){addToCart(d.add);return}
  if(d.brand!=null){sBrand=d.brand||null;renderSearch();window.scrollTo({top:0});return}
  if(d.filter==='__brand'){sBrand=null;renderSearch();return}
  if(d.filter){sFilter=sFilter===d.filter&&d.filter!=='all'?'all':d.filter;renderSearch();window.scrollTo({top:0});return}
  if(d.sort){sSort=sSort===null?'asc':sSort==='asc'?'desc':null;renderSearch();return}
  if(d.ask!=null){$('#msg').blur();askAssistant(d.ask);return}
  if(d.holdno){holdFormFor=null;renderItem();return}
  if(d.holdok){const i=byId(d.holdok),w=($('#holdWho').value||'').trim()||'sin nombre';const W=w.replace(/^\w/,x=>x.toUpperCase());holdFormFor=null;doHold(i,W,1);saveCache();toast(`Apartada para ${W}`);renderItem();if(mode==='search')renderSearch();return}
  if(d.open){holdFormFor=null;openItem(d.open);return}
  if(d.sell){const i=byId(d.sell);if(mode==='search'){if(!posCart.lines.find(l=>l.id===i.id))addToCart(i.id,true);closeSheet(true);openCheckout();return}closeSheet();startSell(i);after();return}
  if(d.hold){const i=byId(d.hold);if(mode==='search'){holdFormFor=i.id;renderItem();return}closeSheet();askHold(i);after();$('#msg').focus();return}
  if(d.release){const i=byId(d.release);doRelease(i);saveCache();if(mode==='search'){toast('Liberada');renderItem();renderSearch();return}closeSheet();after();return}
  if(d.picksell){const m=msgById(d.cm);startSell(byId(d.picksell),m?.pick?.price,m?.pick?.method,m?.pick?.qty);after();return}
  if(d.pickhold){const m=msgById(d.cm),i=byId(d.pickhold);if(m.pickHold)doHold(i,m.pickHold,m.pickQty);else askHold(i,m.pickQty);after();return}
  if(d.upsell){const i=byId(d.upsell);if(!i)return;if($('#coSheet').classList.contains('on')){posCart={lines:[{id:i.id,qty:1,price:i.price}],method:posCart.method};openCheckout();return}startCart([{id:i.id,qty:1,price:i.price}]);after();return}
  if(d.editok||d.editno){const m=msgById(d.editok||d.editno);if(!m||!m.edit||m.edit.state!=='open')return;if(d.editno){m.edit.state='cancel';after();return}
    const e=m.edit;if(e.field==='qty'){const ok=await setStock(e.id,e.value);if(ok)e.state='done';after();return}
    const row={[e.field]:e.value};const i=byId(e.id);if(e.field==='price'&&(i.min||0)>e.value)row.min_price=e.value;if(e.field==='min_price'&&e.value>i.price){toast('El mínimo no puede ser mayor que el precio');return}
    const ok=await ownerWrite(sb.from('items').update(row).eq('id',e.id).select().single(),'Actualizado');if(ok){const k=base.items.findIndex(x=>x.id===ok.id);if(k>=0)base.items[k]=ok;derive();e.state='done'}after();return}
  if(d.cart){const m=msgById(d.cart);if(!m||!m.cart||m.cart.state!=='open')return;const c=m.cart;
    if(d.cq){const [k,dv]=d.cq.split(':').map(Number);const l=c.lines[k],i=byId(l.id);l.qty=Math.max(1,Math.min(i.qty,l.qty+dv))}
    if(d.cx!=null){c.lines.splice(+d.cx,1);if(!c.lines.length)c.state='cancel'}
    if(d.cmeth)c.method=d.cmeth;
    if(d.ccan)c.state='cancel';
    if(d.cpay){confirmCart(m);if(m===coMsg){posCart={lines:[],method:c.method};saveCache();renderCheckout();renderSearch();return}after();return}
    if(m===coMsg){posCart.method=c.method;if(c.state==='cancel'){if(d.ccan)posCart.lines=[];coMsg=null;closeSheet()}else renderCheckout();saveCache();renderCartBar();renderSearch();return}
    saveCache();renderChat(false);return}
  if(d.list){openList(d.list);return}
  if(d.lsort){listSort=d.lsort;renderList();return}
  if(d.expand){const m=msgById(d.expand);m.limit=999;saveCache();renderChat(false);return}
  if(d.cm){const m=msgById(d.cm);if(!m||!m.confirm)return;
    if(d.cprice){m.confirm.price=+d.cprice;saveCache();renderChat(false);return}
    if(d.cmethod){m.confirm.method=d.cmethod;saveCache();renderChat(false);return}
    if(d.ccancel){m.confirm.state='cancel';saveCache();renderChat(false);return}
    if(d.cok){confirmSale(m);after();return}}
  if(d.undo){const m=msgById(d.undo);setTimeout(()=>{if($('#coSheet').classList.contains('on'))renderCheckout();if(mode==='search')renderSearch()},30);if(m.undo.sales){m.undo.sales.forEach(id=>voidSale(id,true));m.undone=true;bot({text:`Venta anulada. ${m.undo.sales.length>1?'Los productos vuelven':'El producto vuelve'} al stock.`})}else if(m.undo.sale)voidSale(m.undo.sale);else if(m.undo.hold){const i=byId(m.undo.hold);m.undone=true;if(i)for(let k=0;k<(m.undo.n||1);k++)enqueue({kind:'release',id:uuid(),item_id:i.id,who:m.undo.who||null});bot({text:'Deshecho. Vuelve a estar disponible.'})}after();return}
  if(d.invf){invF=d.invf;renderMenu();return}
  if(d.ipe){invEdit=d.ipe;renderInvList();return}
  if(d.mtab){menuTab=d.mtab;renderMenu();if(menuTab==='ajustes'&&!S.seller)loadInvite();return}
  if(d.edit){if(!S.seller)openEdit(byId(d.edit));return}
  if(d.tick){eTests=eTests.includes(d.tick)?eTests.filter(x=>x!==d.tick):[...eTests,d.tick];renderTicks();return}
  if(d.inc||d.dec){if(S.seller)return;const i=byId(d.inc||d.dec);const q=Math.max(i.held||0,i.qty+(d.inc?1:-1));if(q===i.qty){toast(i.held?'Hay unidades apartadas':'No hay unidades');return}
    await setStock(i.id,q);renderInvList();if(mode==='search')renderSearch();return}
  if(d.voidm){voidSale(d.voidm);saveCache();renderMenu();renderChat(false);toast('Venta anulada');return}
  if(d.rmember){$('#rmBox').innerHTML=`<div class="confirm">¿Quitar a este vendedor? Ya no podrá ver ni vender.<div class="btnrow"><button class="btn" data-act="cancelRm">Cancelar</button><button class="btn danger" data-rmok="${d.rmember}">Quitar</button></div></div>`;return}
  if(d.rmok){const ok=await ownerWrite(sb.from('members').delete().eq('user_id',d.rmok).select(),'Vendedor quitado');if(ok){base.members=base.members.filter(m=>m.user_id!==d.rmok);renderMenu()}return}
  const i=byId(openId);
  switch(d.act){
    case 'closeSheet':holdFormFor=null;if(coMsg&&coMsg.cart.state!=='open')coMsg=null;closeSheet();if(mode==='chat')renderChat(false);else renderSearch();break;
    case 'toChat':askAssistant('');break;
    case 'toSearch':setMode('search');break;
    case 'toggleMode':if(mode==='chat')setMode('search',{focus:true});else{const q=$('#msg').value.trim();askAssistant(q&&isCommand(q)?q:'')}break;
    case 'openCart':openCheckout();break;
    case 'clearQ':sQuery='';$('#msg').value='';syncComposer();renderSearch();$('#msg').focus();break;
    case 'openMenu':case 'plus':openMenu();break;
    case 'toggleMin':showMin=!showMin;renderItem();break;
    case 'newItem':openEdit(null);break;
    case 'openImport':openImport();break;
    case 'doImport':{const good=impRows.filter(r=>r.ok);if(!good.length)break;t.disabled=true;
      const rows=good.map(r=>({name:r.name,type:r.type,cond:r.cond,price:r.price,min_price:r.min,qty:1,...addTo()}));
      const data=await ownerWrite(sb.from('items').insert(rows).select());t.disabled=false;
      if(data){data.forEach(addedItem);derive();closeSheet();bot({text:`Agregué **${data.length}** ${data.length===1?'cámara':'cámaras'}. Ya puedes buscarlas.`});after()}break}
    case 'rmPhoto':ePhoto='';ePhotoBlob=null;renderEThumb();break;
    case 'saveItem':{
      const name=$('#eName').value.trim(),price=Math.round(+$('#ePrice').value),qty=Math.round(+$('#eQty').value),minRaw=$('#eMin').value;
      if(!name){toast('Falta marca y modelo');$('#eName').focus();break}
      if(!(price>=0)||$('#ePrice').value===''){toast('Falta el precio de venta (0 = sin precio)');$('#ePrice').focus();break}
      if(!(qty>=0)||$('#eQty').value===''){toast('Revisa las unidades');$('#eQty').focus();break}
      const min=minRaw===''?price:Math.round(+minRaw);if(!(min>=0)||min>price){toast('El mínimo no puede ser mayor que el precio');$('#eMin').focus();break}
      t.disabled=true;let photo=ePhoto;
      if(ePhotoBlob){try{photo=await uploadPhoto(ePhotoBlob)}catch(err){toast(isNet(err)?'Necesitas señal para subir la foto':'No se pudo subir la foto');t.disabled=false;break}}
      const prevQty=editing?byId(editing).qty:null;
      const row={name,price,min_price:min,...(editing?{}:{qty,...addTo()}),type:$('#eType').value,cond:$('#eCond').value,tested:eTests,compatible:$('#eCompat').value.trim(),pitch:$('#ePitch').value.trim(),notes:$('#eNotes').value.trim(),photo_url:photo.startsWith('data:')?'':photo};
      const data=await ownerWrite(editing?sb.from('items').update(row).eq('id',editing).select().single():sb.from('items').insert(row).select().single(),editing?'Cambios guardados':'Cámara agregada');
      t.disabled=false;
      if(data){const k=base.items.findIndex(x=>x.id===data.id);if(k>=0)base.items[k]=data;else addedItem(data);if(editing&&qty!==prevQty)await setStock(data.id,qty);derive();saveCache();closeSheet();renderChat(false)}break}
    case 'askDelete':$('#delBox').innerHTML=`<div class="confirm">¿Eliminar esta cámara? Las ventas registradas se conservan.<div class="btnrow"><button type="button" class="btn" data-act="cancelDel">Cancelar</button><button type="button" class="btn danger" data-act="doDelete">Eliminar</button></div></div>`;break;
    case 'cancelDel':$('#delBox').innerHTML='';break;
    case 'doDelete':{const ok=await ownerWrite(sb.from('items').delete().eq('id',editing).select(),'Cámara eliminada');if(ok){base.items=base.items.filter(x=>x.id!==editing);derive();saveCache();closeSheet();renderChat(false)}break}
    case 'copyReport':copy(report(),'Resumen copiado');break;
    case 'downloadCSV':downloadCSV();break;
    case 'closeEvent_legacy':$('#closeBox').innerHTML=`<div class="confirm neutral">Las ventas quedan guardadas y el contador vuelve a cero en todos los celulares. El stock no cambia.<label class="f" style="margin:10px 0 0">Nombre del próximo evento<input id="nextEvt" placeholder="Ej: Mercado de las Pulgas, domingo"></label><div class="btnrow"><button class="btn" data-act="cancelClose">Cancelar</button><button class="btn primary" data-act="doClose">Empezar</button></div></div>`;break;
    case 'cancelClose':$('#closeBox').innerHTML='';break;
    case 'doClose':{const n=$('#nextEvt').value.trim();const {error}=await sb.rpc('start_event',{p_name:n});
      if(error){toast(isNet(error)?'Necesitas señal para empezar un evento':'No se pudo: '+error.message);break}
      try{await loadAll()}catch(err){}derive();chat=[];saveCache();closeSheet();renderChat();toast('Nuevo evento: '+S.event.name);break}
    case 'clearChat':chat=[];ctx.last=null;pending=null;saveCache();closeSheet();renderChat();break;
    case 'copyCode':copy(inviteCode,'Código copiado');break;
    case 'shareInvite':{const url=location.origin+location.pathname;const text=`Únete a mi puesto en Puesto: ${url}\nCrea tu cuenta y usa el código ${inviteCode}`;try{if(navigator.share){await navigator.share({title:'Puesto',text});break}}catch(e){if(e&&e.name==='AbortError')break}copy(text,'Invitación copiada');break}
    case 'rotateCode':{const {data,error}=await sb.rpc('rotate_invite_code');if(error){toast('No se pudo cambiar el código');break}inviteCode=data;renderMenu();toast('Código nuevo: '+data);break}
    case 'cancelRm':$('#rmBox').innerHTML='';break;
    case 'signOut':await signOut();break;
    case 'toggleAuth':authMode=authMode==='in'?'up':'in';renderAuth();break;
    case 'backToLogin':authMode='in';showGate('auth');break;
  }
});
const SR=window.SpeechRecognition||window.webkitSpeechRecognition;let rec=null;
function syncComposer(){const has=!!$('#msg').value.trim();const srch=mode==='search';$('#sendBtn').hidden=srch||(!has&&!!SR);$('#micBtn').hidden=has||!SR;$('#sendBtn').disabled=!has;$('#clrBtn').hidden=!srch||!has}
$('#micBtn').addEventListener('click',()=>{
  if(rec){rec.stop();return}
  try{rec=new SR();rec.lang='es-CL';rec.interimResults=true;rec.maxAlternatives=1}catch(e){toast('Tu navegador no permite dictar');return}
  const b=$('#micBtn');b.classList.add('on');$('#msg').placeholder='Te escucho…';
  rec.onresult=e=>{const r=[...e.results].map(x=>x[0].transcript).join('');$('#msg').value=r;if(e.results[e.results.length-1].isFinal){rec.stop()}};
  rec.onerror=e=>{if(e.error==='not-allowed')toast('Permite el micrófono para dictar')};
  rec.onend=()=>{b.classList.remove('on');rec=null;const v=$('#msg').value.trim();if(mode==='search'){$('#msg').placeholder='Busca modelo o precio';if(v&&isCommand(v)){$('#msg').value='';sQuery='';askAssistant(v)}else{sQuery=v;renderSearch()}syncComposer();return}$('#msg').placeholder='Pregunta o anota una venta';if(v){$('#msg').value='';syncComposer();send(v)}};
  rec.start();
});
$('#composer').addEventListener('submit',e=>{e.preventDefault();const v=$('#msg').value.trim();if(mode==='search'){if(v&&isCommand(v)){$('#msg').value='';sQuery='';askAssistant(v)}else $('#msg').blur();return}if(!v)return;$('#msg').value='';syncComposer();document.body.classList.remove('typing');send(v)});
document.addEventListener('input',e=>{const el=e.target;if(el.classList&&el.classList.contains('clp')){const m=msgById(el.dataset.cart);if(!m||!m.cart)return;const l=m.cart.lines[+el.dataset.li];l.price=Math.round(+el.value)||0;
  const tot=m.cart.lines.reduce((x,y)=>x+(y.price||0)*y.qty,0);const t=document.querySelector(`[data-ctot="${m.id}"]`);if(t)t.textContent=clp.format(tot);
  const bad=m.cart.lines.some(y=>{const i=byId(y.id);return !(y.price>0)||y.price<(i.min||i.price)});const b=document.querySelector(`[data-cart="${m.id}"][data-cpay]`);if(b)b.disabled=bad;saveCache();return}
  if(!el.classList||!el.classList.contains('cpin'))return;const m=msgById(el.dataset.cm);if(!m)return;
  m.confirm.price=Math.round(+el.value)||0;const tot=document.querySelector(`[data-ctot="${m.id}"]`);if(tot)tot.textContent=clp.format(m.confirm.price);
  const ok=document.querySelector(`[data-cm="${m.id}"][data-cok]`);if(ok)ok.disabled=!(m.confirm.price>0);saveCache()});
let sT;$('#msg').addEventListener('input',e=>{syncComposer();if(mode==='search'){sQuery=e.target.value;clearTimeout(sT);sT=setTimeout(renderSearch,40);return}document.body.classList.toggle('typing',!!e.target.value)});syncComposer();
$('#editForm').addEventListener('submit',e=>{e.preventDefault();document.querySelector('[data-act="saveItem"]').click()});
document.addEventListener('input',e=>{if(e.target.id==='invQ'){invQ=e.target.value;renderInvList()}});
document.addEventListener('keydown',e=>{if(e.target.id==='ipe'&&e.key==='Enter'){e.preventDefault();e.target.blur()}if(e.target.id==='ipe'&&e.key==='Escape'){invEdit=null;renderInvList()}});
document.addEventListener('focusout',e=>{if(e.target.id==='ipe')savePrice(e.target.dataset.ipid,e.target.value)});
document.addEventListener('change',async e=>{if(e.target.id==='evtInput'){const v=e.target.value.trim();if(!v)return;
  const ok=await ownerWrite(sb.from('settings').update({event_name:v}).eq('id',1).select().single(),'Evento renombrado');if(ok){base.settings=ok;derive();renderHeader()}}});

