/* Puesto · Vista principal: buscador, índice por marca, carro y ficha del producto */
'use strict';
/* ================= buscador (vista principal) ================= */
let mode='search',sFilter='all',sSort=null,sQuery='',holdFormFor=null,sBrand=null,recent=[];
const SERIES=/^(powershot|cyber-shot|cybershot|coolpix|finepix|camedia|easyshare|lumix|exilim|optio|digimax|vivicam|instax|advantix|prima|infinity|superzoom|trip|freedom|pop|fino|star|discovery|smart|live|fun|touch|digiart|dmc|dsc|mini|1)$/i;
function modelCode(i){
  const brand=brandOf(i.name);let base=i.name.replace(new RegExp('^'+brand.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\s*','i'),'');
  const paren=(base.match(/\(([^)]*)\)/)||[])[1]||'';base=base.replace(/\s*\([^)]*\)\s*/g,' ').trim();
  const w=base.split(/\s+/).filter(Boolean);let k=w.findIndex(x=>/\d/.test(x)&&!/^1$/.test(x));
  let code,series,rest='';
  if(k<0){code=w.filter(x=>!SERIES.test(x)).join(' ')||w.join(' ');series=w.filter(x=>SERIES.test(x)).join(' ')}
  else{const cw=w.slice(k,k+2).filter((x,j)=>j===0||/^(is|wp|ii|iii|zoom|se|hd|sd|dx|af|x2)$/i.test(x));code=cw.join(' ');series=w.slice(0,k).join(' ');rest=w.slice(k+cw.length).join(' ');
    if(code.replace(/\W/g,'').length<3){code=(series?series+' ':'')+code;series=''}}
  const extra=[rest,paren].filter(Boolean).join(' · ');
  return {code:code||base,series,extra};
}
const pushRecent=id=>{recent=[id,...recent.filter(x=>x!==id)].slice(0,8);try{localStorage.setItem('puesto.recent',JSON.stringify(recent))}catch(e){}};
try{recent=JSON.parse(localStorage.getItem('puesto.recent')||'[]')}catch(e){}
let posCart={lines:[],method:'Efectivo'},coMsg=null;
const CMD_RE=/^(vend\w*|cobr\w*|se (lo |la )?llev\w*|apart\w*|reserv\w*|separ\w*|liber\w*|desapart\w*|compar\w*|cuant[oa]s?|resumen|cierre|caja|cambia|cambiar|pon|ponle|llegaron|agrega|anade|anula|me equivoque|deshac\w*|ayuda|lo mas vendido|que se (ha )?vendi\w*|cuanto (cuesta|vale|sale|llevamos|llevo|le puedo)|que incluye|minimo|hola|gracias|cual es mejor|diferencia)\b/;
const VERB_STRIP=/^(vend\w*|cobr\w*|se (lo |la )?llev\w*|apart\w*|reserv\w*|separ\w*|liber\w*|compar\w*|cuanto (cuesta|vale|sale)|que incluye|minimo de)\s+/;
const isCommand=q=>{const t=deac(q).replace(/[¿?¡!.]/g,' ').trim();return CMD_RE.test(t)||(/\?/.test(q)&&t.split(/\s+/).length>3)};
function searchItems(q,pool){
  let t=deac(q).replace(/[¿?¡!]/g,' ').trim().replace(VERB_STRIP,'');
  t=t.replace(/\b(cuant[oa]s?|quedan?|hay|tienes|tenemos|stock|todavia|aun|me|nos)\b/g,' ').replace(/\s+/g,' ').trim();
  t=t.replace(/\s+(para|a nombre de)\s+.+$/,'').replace(/\b(en|con)\s+(efectivo|tarjeta|transfer\w*)\b/g,' ');
  if(!t)return {items:pool,a:null};
  const money=/(\$|lucas?|mil\b|bajo|hasta|menos de|entre|mas de|desde|\d+k\b|\d{4,})/.test(t);
  let a;
  if(money)a=analyze(t);
  else{const saveBudget=takeBudget;a=analyze(t.replace(/(\d)/g,'$1'));a.min=null;a.max=null;
    const nums=t.match(/\b\d{1,3}\b/g)||[];for(const n of nums)if(!a.toks.includes(n)&&!a.toks.some(x=>x.includes(n)))a.toks.push(n)}
  if(!a.toks.length&&!a.type&&!a.brand&&!a.group&&a.max==null&&a.min==null&&!a.beginner)return {items:pool,a};
  let r=match(a,pool);
  if((a.max!=null||a.min!=null)&&!a.toks.length&&!(a.type&&ACC_TYPES.includes(a.type))&&a.group!=='acc'&&sFilter!=='acc')r=r.filter(isCam);
  return {items:r,a};
}
function filterPool(){
  let p=S.items.filter(live);
  if(sBrand)p=p.filter(i=>sBrand==='__acc'?!isCam(i):isCam(i)&&brandOf(i.name)===sBrand);
  if(sFilter==='dig')p=p.filter(i=>i.type==='Digital');
  if(sFilter==='ana')p=p.filter(isAnalog);
  if(sFilter==='cheap')p=p.filter(i=>isCam(i)&&i.price>0&&i.price<=50000);
  if(sFilter==='acc')p=p.filter(i=>!isCam(i));
  if(sFilter==='held')p=p.filter(i=>i.held>0);
  if(sFilter==='inst')p=p.filter(i=>i.type==='Instantánea');
  return p;
}
function renderFilters(){
  const L=S.items.filter(live),u=l=>l.reduce((x,i)=>x+free(i),0);
  const held=L.reduce((x,i)=>x+i.held,0);
  const f=[['all','Todo',null],['dig','Digitales',u(L.filter(i=>i.type==='Digital'))],['ana','Análogas',u(L.filter(isAnalog))],['cheap','≤ $50 mil',u(L.filter(i=>isCam(i)&&i.price>0&&i.price<=50000))],['acc','Accesorios',u(L.filter(i=>!isCam(i)))]];
  if(held)f.push(['held','Apartadas',held]);
  if(sBrand)f.unshift(['__brand',(sBrand==='__acc'?'Accesorios':sBrand)+' ×',null]);
  $('#filters').innerHTML=f.map(([k,l,n])=>`<button data-filter="${k}" aria-pressed="${sFilter===k}">${l}${n!=null?` <span class="num">${n}</span>`:''}</button>`).join('')+
    `<button class="sortb" data-sort="1" aria-pressed="${!!sSort}">${sSort==='desc'?'Precio ↓':'Precio ↑'}</button>`;
}
function mTile(i){const m=modelCode(i),f=free(i),inCart=posCart.lines.find(l=>l.id===i.id);
  return `<div class="mtile${f<=0?' dim':''}"><button class="mbody" data-open="${i.id}">${m.series?`<small>${esc(m.series)}</small>`:''}<b>${esc(m.code)}</b>${m.extra?`<em>${esc(m.extra)}</em>`:''}<span class="mft"><span class="num mp${i.price>0?'':' np'}">${i.price>0?clp.format(i.price):'Consultar'}</span><span class="st ${f<=0?'hold':'ok'} num">${f<=0?'Apartada':f+' disp.'}</span></span></button>${f>0?`<button class="madd${inCart?' in':''}" data-add="${i.id}" aria-label="Agregar al carro">${inCart?`<b class="num">${inCart.qty}</b>`:'+'}</button>`:''}</div>`}
function sRow(i){
  const f=free(i),inCart=posCart.lines.find(l=>l.id===i.id);
  const st=!live(i)?'Vendida':f<=0?'Apartada':f>1?f+' disp.':'1 disp.';
  const sub=[i.type];if(i.compatible)sub.push(i.compatible);if(i.held>0)sub.push(i.held+' apart.');
  return `<div class="srow${f<=0?' dim':''}"><button class="sbody" data-open="${i.id}"><span class="thumb">${thumb(i)}</span><span class="mid"><span class="nm">${hl(i.name)}</span><span class="meta">${esc(sub.join(' · '))}</span></span><span class="right"><span class="price num${i.price>0?'':' np'}">${i.price>0?clp.format(i.price):'Consultar'}</span><span class="st ${f<=0?'hold':'ok'} num">${st}</span></span></button>${f>0?`<button class="addb${inCart?' in':''}" data-add="${i.id}" aria-label="Agregar ${esc(i.name)} al carro">${inCart?`<b class="num">${inCart.qty}</b>`:'<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>'}</button>`:'<span class="addb ph"></span>'}</div>`;
}
let hlToks=[];
function hl(name){if(!hlToks.length)return esc(name);
  return esc(name).replace(/[A-Za-z0-9ÁÉÍÓÚáéíóúñÑµ.-]+/g,w=>{const n=norm(w);return n&&hlToks.some(t=>t.length>=2&&(n.includes(t)||t.includes(n)&&n.length>=3))?`<mark>${w}</mark>`:w})}
function renderSearch(){
  if(!me.role)return;
  const q=sQuery.trim();
  renderFilters();
  let pool=filterPool(),{items,a}=q?searchItems(q,pool):{items:pool,a:null};
  hlToks=a?a.toks:[];
  if(sSort)items=[...items].sort((x,y)=>sSort==='asc'?(x.price||9e9)-(y.price||9e9):(y.price||0)-(x.price||0));
  else if(!q)items=[...items].sort((x,y)=>(avail(y)-avail(x))||x.name.localeCompare(y.name));
  let h='';
  if(!q&&sFilter==='all'){
    const ok=evSales().filter(s=>!s.void),tot=ok.reduce((x,s)=>x+s.price,0);const held=S.items.reduce((x,i)=>x+(live(i)?i.held:0),0);
    h+=`<div class="today"><button class="tcard" data-ask="Resumen del día"><small>Hoy · ${esc(S.event.name)}</small><b class="num">${clp.format(tot)}</b><span class="num">${ok.length} ${plural(ok.length,'venta','ventas')}</span></button>
      <button class="tcard alt" data-filter="${held?'held':'ana'}"><small>${held?'Apartadas':'Análogas'}</small><b class="num">${held||units(S.items.filter(i=>avail(i)&&isAnalog(i)))}</b><span>${held?'Ver quién':'Ver todas'}</span></button></div>`;
  }
  if(sBrand){const n=units(pool);h+=`<div class="bhead"><button class="bback" data-brand="" aria-label="Volver a marcas"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg></button><div><b>${sBrand==='__acc'?'Accesorios':esc(sBrand)}</b><span class="num">${n} ${plural(n,'unidad','unidades')} · toca el modelo</span></div></div>`;
    if(!q&&!sSort){h+=`<div class="mgrid">${[...items].sort((x,y)=>(avail(y)-avail(x))||modelCode(x).code.localeCompare(modelCode(y).code,'es',{numeric:true})).map(mTile).join('')}</div>`;$('#search').innerHTML=h;renderCartBar();return}}
  else if(!q&&sFilter==='all'){
    const cams=S.items.filter(i=>live(i)&&isCam(i)),bm={};for(const i of cams){const b=brandOf(i.name);bm[b]=(bm[b]||0)+free(i)}
    const accN=units(S.items.filter(i=>live(i)&&!isCam(i)));
    h+=`<div class="shead"><span>Por marca</span><span>sin escribir</span></div><div class="bgrid">${Object.entries(bm).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).map(([b,n])=>`<button class="btile" data-brand="${esc(b)}"><b>${esc(b)}</b><span class="num">${n}</span></button>`).join('')}${accN?`<button class="btile acc" data-brand="__acc"><b>Accesorios</b><span class="num">${accN}</span></button>`:''}</div>`;
    const rec=recent.map(byId).filter(i=>i&&live(i)).slice(0,6);
    if(rec.length)h+=`<div class="shead"><span>Vistos recién</span></div><div class="car rec">${rec.map(i=>`<button class="rtile" data-open="${i.id}"><span class="rc">${esc(modelCode(i).code)}</span><span class="rb">${esc(brandOf(i.name))}</span><span class="num rp">${i.price>0?clp.format(i.price):'Consultar'}</span></button>`).join('')}</div>`;
  }
  if(q&&isCommand(q))h+=`<button class="askrow\" data-ask="${esc(q)}"><span class="av2">${AP('')}</span><span><small>Enviar al asistente</small><b>${esc(q)}</b></span><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg></button>`;
  const total=units(items);
  if(items.length){
    h+=`<div class="shead"><span>${q?`${items.length} ${plural(items.length,'resultado','resultados')}`:sFilter==='all'?'Inventario':''}${a&&a.fixes&&a.fixes.length?` · busqué «${esc(a.fixes.join(' '))}»`:''}</span><span class="num">${total} ${plural(total,'unidad','unidades')}</span></div>`;
    h+=`<div class="slist">${items.slice(0,80).map(sRow).join('')}</div>`;
    if(items.length>80)h+=`<p class="hint" style="text-align:center">Escribe para afinar la búsqueda (${items.length-80} más).</p>`;
  }else if(q&&isCommand(q)){h+=`<p class="hint" style="text-align:center;margin-top:14px">Toca la flecha o Enter para enviarlo al asistente.</p>`}else{
    const near=a?nearby(a):[];
    h+=`<div class="sempty"><b>No hay coincidencias${q?` para «${esc(q)}»`:''}</b><span>${sFilter!=='all'?'Prueba quitando el filtro o ':''}Prueba con la marca, el modelo o un presupuesto (“bajo 40 lucas”).</span>${sFilter!=='all'?'<button class="btn" data-filter="all">Quitar filtro</button>':''}</div>`;
    if(near.length)h+=`<div class="shead"><span>Lo más parecido</span></div><div class="slist">${near.map(sRow).join('')}</div>`;
    if(q&&!isCommand(q))h+=`<button class="askrow" data-ask="${esc(q)}"><span class="av2">${AP('')}</span><span><small>Preguntarle al asistente</small><b>${esc(q)}</b></span><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg></button>`;
  }
  $('#search').innerHTML=h;
  renderCartBar();
}
function setMode(m,opts={}){
  mode=m;document.body.classList.toggle('mode-chat',m==='chat');document.body.classList.toggle('mode-search',m==='search');
  $('#search').hidden=m!=='search';$('#chat').hidden=m!=='chat';
  const inp=$('#msg');
  if(m==='chat'){inp.value='';inp.placeholder='Pregunta o anota una venta';inp.enterKeyHint='send';$('#modeBtn').setAttribute('aria-label','Volver al buscador');$('#modeBtn').innerHTML='<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>';renderChat(false);requestAnimationFrame(()=>window.scrollTo({top:document.body.scrollHeight}))}
  else{inp.value=sQuery;inp.placeholder='Busca modelo o precio';inp.enterKeyHint='search';$('#modeBtn').setAttribute('aria-label','Abrir asistente');$('#modeBtn').innerHTML=AP('');document.body.classList.remove('home');renderSearch();window.scrollTo({top:0})}
  syncComposer();
  if(opts.focus)setTimeout(()=>inp.focus(),50);
}
function askAssistant(q){sQuery='';setMode('chat');if(q){send(q)}}
/* --- carro tipo caja --- */
function addToCart(id,silent){
  const i=byId(id);if(!i||free(i)<=0){toast('No quedan unidades libres');return false}
  const l=posCart.lines.find(x=>x.id===id);
  if(l){if(l.qty>=free(i)){toast(`Solo hay ${free(i)} libre${free(i)>1?'s':''}`);return false}l.qty++}
  else posCart.lines.push({id,qty:1,price:i.price});
  try{navigator.vibrate&&navigator.vibrate(12)}catch(e){}
  if(!silent)toast(`Agregado · ${posCart.lines.reduce((x,l)=>x+l.qty,0)} en el carro`);
  saveCache();renderCartBar();if(mode==='search')renderSearch();return true;
}
function renderCartBar(){
  posCart.lines=posCart.lines.filter(l=>byId(l.id));
  const n=posCart.lines.reduce((x,l)=>x+l.qty,0),tot=posCart.lines.reduce((x,l)=>x+(l.price||0)*l.qty,0);
  const b=$('#cartBar');b.hidden=!n||mode!=='search';document.body.classList.toggle('has-cart',!!n&&mode==='search');
  $('#cartN').textContent=n;$('#cartTxt').textContent=n===1?shortName(byId(posCart.lines[0].id)):`${n} productos`;$('#cartTot').textContent=clp.format(tot);
}
function openCheckout(){
  if(!posCart.lines.length&&!(coMsg&&coMsg.cart.state==='done'))return;
  if(posCart.lines.length)coMsg={id:'pos',from:'bot',cart:{lines:posCart.lines,method:posCart.method,state:'open'}};
  renderCheckout();openSheet('coSheet');$('#coBody').scrollTop=0;
}
function renderCheckout(){
  if(!coMsg){closeSheet();return}
  const done=coMsg.cart.state==='done';
  $('#coBody').innerHTML=(done?`<p class="cotxt">${fmt(coMsg.text||'')}</p>`:'')+cartHTML(coMsg)+(done?upsellHTML(coMsg)+`<button class="btn primary" style="width:100%;margin-top:12px" data-act="closeSheet">Listo</button>`:'');
}

/* ================= ficha ================= */
let openId=null,showMin=false;
function openItem(id){pushRecent(id);openId=id;showMin=false;ctx.last=id;renderItem();openSheet('itemSheet');$('#itemBody').scrollTop=0}
function renderItem(){
  const i=byId(openId);if(!i){closeSheet();return}const min=i.min||i.price;
  $('#itemLbl').textContent=i.type+' · '+i.cond;
  const alts=S.items.filter(x=>x.id!==i.id&&avail(x)&&x.type===i.type&&Math.abs(x.price-i.price)<=i.price*.35).sort((a,b)=>Math.abs(a.price-i.price)-Math.abs(b.price-i.price)).slice(0,3);
  $('#itemBody').innerHTML=`<div class="hero${i.photo?'':' noimg'}">${i.photo?`<img src="${esc(i.photo)}" alt="${esc(i.name)}">`:sil(i.type)}</div>
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
  if(holdFormFor===i.id){$('#itemFoot').innerHTML=`<div class="holdf"><input id="holdWho" autocomplete="off" placeholder="¿Para quién? Ej: Diego, vuelve 18:00" enterkeyhint="done"><div class="btnrow"><button class="btn" data-holdno="1" style="flex:0 1 110px">Cancelar</button><button class="btn primary" data-holdok="${i.id}">Apartar</button></div></div>`;setTimeout(()=>$('#holdWho')&&$('#holdWho').focus(),80);return}
  if(live(i)){if(i.held>0&&free(i)>0)f.push(`<button class="btn" data-release="${i.id}" style="flex:0 1 110px">Liberar</button>`);f.push(i.held>0&&free(i)<=0?`<button class="btn" data-release="${i.id}" style="flex:0 1 120px">Liberar</button>`:`<button class="btn" data-hold="${i.id}" style="flex:0 1 120px">Apartar</button>`);f.push(`<button class="btn primary" data-sell="${i.id}">Vender</button>`)}
  if(!S.seller)f.push(`<button class="btn" data-edit="${i.id}" style="flex:0 0 auto">Editar</button>`);
  $('#itemFoot').innerHTML=`<div class="btnrow">${f.join('')}</div>`;
}

