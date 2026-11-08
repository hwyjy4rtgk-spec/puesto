/* Puesto · Acciones del asistente, tarjetas (cobro, comparar, conteos) y render del chat */
'use strict';
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
  const c=counts(),ok=evSales().filter(s=>!s.void);const b=[...new Set(S.items.filter(avail).filter(isCam).map(i=>brandOf(i.name)))];
  return [['Resumen del día',`${ok.length} ${plural(ok.length,'venta','ventas')}`,'Resumen del día'],['¿Cuántas quedan?',`${c.cam} cámaras · ${c.acc} acc.`,'¿Cuántas quedan?'],
    ['Comparar dos cámaras',`Ej: ${b[0]||'Canon'} vs ${b[1]||'Olympus'}`,`Compara la ${b[0]||'Canon'} con la ${b[1]||'Olympus'}`],['¿Qué sabes hacer?','Ejemplos de frases','ayuda']];
}
function renderHome(){
  const first=(me.name||'').split(' ')[0];
  let sub='Vende, aparta, compara o pide el resumen escribiendo como hablas.';
  if(!S.items.length)sub=S.seller?'El dueño todavía no carga productos.':'Tu inventario está vacío. Toca + para cargar productos.';
  const st=S.items.length?`<div class="starters">${starters().map(([a,b,q])=>`<button class="starter" data-say="${esc(q)}"><b>${esc(a)}</b><span class="num">${esc(b)}</span></button>`).join('')}</div>`:'';
  return `<div class="home">${AP('ap')}<div class="hi gtext">Hola${first?' '+esc(first):''}</div><h1>¿En qué te ayudo?</h1><p class="num">${esc(sub)}</p></div>${st}`;
}
let lastFresh=null;
function renderChat(scroll=true){
  if(!me.role)return;if(mode!=='chat'){$('#chat').innerHTML=chat.map(m=>msgHTML(m,false)).join('');renderHeader();return}
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
  $('#hName').innerHTML=esc(S.event.name||'Puesto')+(S.places.length>1?' <span class="caret">▾</span>':'');
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
function renderSugg(){if(mode!=='chat'){$('#sugg').innerHTML='';return}
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

