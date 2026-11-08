/* Puesto · Entender lo que escribe el vendedor (sin IA): búsqueda difusa, intenciones y respuestas */
'use strict';
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
    const f=fixToken(n);if(f!==n&&!/^(videocamara|sumergible|lector|700)$/.test(f))fixes.push(f);n=f;
    if(!brand&&brands.includes(n)){brand=n;continue}
    if(/^(polaroid|instax)$/.test(n)&&!brands.includes(n)&&!S.items.some(i=>hay(i).includes(n))&&!type){type='Instantánea';continue}
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
  const row={name,type:guessType(name),cond,price:pr.price,min_price:min&&min<=pr.price?min:pr.price,qty:1,...addTo()};
  const {data,error}=await sb.from('items').insert(row).select().single();
  if(error){bot({text:isNet(error)?'Necesito señal para agregar productos. Inténtalo de nuevo en un momento.':'No pude agregarlo: '+error.message});after();return}
  addedItem(data);derive();ctx.last=data.id;
  bot({text:`Agregada como ${row.type.toLowerCase()}. Toca la ficha para completar qué decirle al cliente.`,items:[data.id],editHint:data.id});after();
}
const defaultSay=()=>{const av=S.items.filter(avail);const b=Object.entries(av.filter(isCam).reduce((a,i)=>{const k=brandOf(i.name);a[k]=(a[k]||0)+free(i);return a},{})).sort((x,y)=>y[1]-x[1]).slice(0,2).map(x=>`¿Tienes ${x[0]}?`);return ['Bajo 50 lucas',...b,'Accesorios','Resumen del día']};

