// Supabase falso para pruebas: imita tablas, RLS básica, RPCs y tiempo real guardando todo en localStorage.
(function(){
const now=()=>new Date().toISOString();
const DB=window.__DB||(window.__DB=JSON.parse(localStorage.getItem('__fakedb')||'null')||{users:[],members:[],items:[],sales:[],settings:{id:1,event_name:'Mi primer evento',event_started:new Date(Date.now()-86400e3).toISOString()},secrets:{invite_code:'ABC123'}});
// Igual que la migración 0006: bodega + la feria abierta, con todo el stock en la feria.
if(!DB.places){
  const b={id:crypto.randomUUID(),name:'Bodega',kind:'bodega',open:true,started_at:now(),closed_at:null};
  const f={id:crypto.randomUUID(),name:DB.settings.event_name,kind:'feria',open:true,started_at:DB.settings.event_started,closed_at:null};
  DB.places=[b,f];
  DB.stock=DB.items.filter(i=>i.qty>0).map(i=>({item_id:i.id,place_id:f.id,qty:i.qty,held:Math.min(i.held||0,i.qty),hold_for:i.held?i.hold_for||'':''}));
  DB.place_members=DB.members.filter(m=>m.role==='seller').map(m=>({place_id:f.id,user_id:m.user_id}));
  DB.moves=[];DB.sales.forEach(s=>s.place_id=s.place_id||f.id);
}
const persist=()=>localStorage.setItem('__fakedb',JSON.stringify(DB));persist();
let session=JSON.parse(localStorage.getItem('__fakesess')||'null');
const OFF=()=>window.__offline;
const err=m=>({data:null,error:{message:m}});
const uid=()=>session&&session.user.id;
const isMember=()=>DB.members.some(m=>m.user_id===uid());
const isOwner=()=>DB.members.some(m=>m.user_id===uid()&&m.role==='owner');
const listeners=[];
function emit(table,eventType,n,o){listeners.forEach(l=>{if(l.table===table)setTimeout(()=>l.fn({eventType,new:n,old:o||{}}),5)})}
const place=id=>DB.places.find(p=>p.id===id);
const bodega=()=>DB.places.find(p=>p.kind==='bodega').id;
const canUse=pid=>{const p=place(pid);return !!p&&p.open&&(isOwner()||(p.kind==='feria'&&DB.place_members.some(m=>m.place_id===pid&&m.user_id===uid())))};
const wasIn=pid=>isOwner()||DB.place_members.some(m=>m.place_id===pid&&m.user_id===uid());
const row=(it,pid)=>DB.stock.find(s=>s.item_id===it&&s.place_id===pid);
function pick(it,need){const r=DB.stock.filter(s=>s.item_id===it&&canUse(s.place_id)&&(need==='held'?s.held>0:need==='free'?s.qty-s.held>0:s.qty>0))
  .sort((a,b)=>(place(b.place_id).kind==='feria')-(place(a.place_id).kind==='feria'));return r[0]?r[0].place_id:null}
function sync(it){const i=DB.items.find(x=>x.id===it);if(!i)return;const r=DB.stock.filter(s=>s.item_id===it);
  i.qty=r.reduce((a,s)=>a+s.qty,0);i.held=r.reduce((a,s)=>a+s.held,0);i.hold_for=r.map(s=>s.hold_for).filter(Boolean).join(' · ');i.status=i.held?'apart':'disp';emit('items','UPDATE',{...i})}
function putStock(it,pid,fn){let r=row(it,pid),ins=false;if(!r){r={item_id:it,place_id:pid,qty:0,held:0,hold_for:''};DB.stock.push(r);ins=true}fn(r);
  if(r.qty<0||r.held>r.qty)throw 'check_violation';
  if(r.qty===0&&r.held===0){DB.stock=DB.stock.filter(x=>x!==r);if(!ins)emit('stock','DELETE',null,{item_id:it,place_id:pid})}else emit('stock',ins?'INSERT':'UPDATE',{...r});sync(it)}
function addMember(user_id,role,name){DB.members.push({user_id,role,name,created_at:now()});
  if(role==='seller'){const f=DB.places.filter(p=>p.kind==='feria'&&p.open);if(f.length===1)DB.place_members.push({place_id:f[0].id,user_id})}}
// edge function signup
const realFetch=window.fetch;
window.fetch=async(url,opt)=>{
  if(String(url).includes('/functions/v1/signup')){
    if(OFF())throw new TypeError('Failed to fetch');
    const b=JSON.parse(opt.body);const J=o=>new Response(JSON.stringify(o));
    const hasOwner=DB.members.some(m=>m.role==='owner');let role='owner';
    if(hasOwner){if(!b.code)return J({error:'need_code'});if(b.code!==DB.secrets.invite_code)return J({error:'bad_code'});role='seller'}
    if(DB.users.some(u=>u.email===b.email))return J({error:'exists'});
    const u={id:crypto.randomUUID(),email:b.email,password:b.password,user_metadata:{name:b.name}};DB.users.push(u);
    addMember(u.id,role,b.name);persist();return J({ok:true,role});
  }
  return realFetch(url,opt);
};
const TABLE={place_members:'place_members'};
function q(table){
  let filters=[],op='select',payload=null,single=false,maybe=false,order=null;
  const b={select(){return b},insert(p){op='insert';payload=p;return b},update(p){op='update';payload=p;return b},delete(){op='delete';return b},
    eq(k,v){filters.push(r=>r[k]===v);return b},in(k,v){filters.push(r=>v.includes(r[k]));return b},gte(k,v){filters.push(r=>r[k]>=v);return b},order(k){order=k;return b},single(){single=true;return b},maybeSingle(){maybe=true;single=true;return b},
    then(res,rej){return Promise.resolve(run()).then(res,rej)}};
  function rowsOf(){if(table==='settings')return [DB.settings];if(table==='secrets')return isOwner()?[{...DB.secrets,id:1}]:[];return DB[TABLE[table]||table]}
  function run(){
    if(OFF())return err('Failed to fetch');if(!session)return err('JWT');
    const canRead=table==='secrets'?isOwner():isMember();
    if(op==='select'){let r=canRead?rowsOf().filter(x=>filters.every(f=>f(x))):[];if(order)r=[...r].sort((a,b)=>String(a[order]).localeCompare(String(b[order])));
      if(single){if(!r.length)return maybe?{data:null,error:null}:err('no rows');return {data:JSON.parse(JSON.stringify(r[0])),error:null}}return {data:JSON.parse(JSON.stringify(r)),error:null}}
    if(!isOwner())return err('new row violates row-level security policy');
    if(table==='stock')return err('permission denied for table stock');
    if(op==='insert'){const arr=Array.isArray(payload)?payload:[payload];
      if(table==='items'){const out=arr.map(p=>({id:crypto.randomUUID(),type:'Réflex',cond:'Muy buena',qty:1,held:0,tested:[],pitch:'',notes:'',photo_url:'',status:'disp',hold_for:'',add_to:null,...p}));
        DB.items.push(...out);out.forEach(r=>{emit('items','INSERT',{...r});if(r.qty>0){const pid=place(r.add_to)&&place(r.add_to).open?r.add_to:bodega();putStock(r.id,pid,s=>{s.qty+=r.qty})}});persist();return {data:single?out[0]:out,error:null}}
      const out=arr.map(p=>({...p}));DB[TABLE[table]||table].push(...out);persist();out.forEach(r=>emit(table,'INSERT',r));return {data:single?out[0]:out,error:null}}
    if(op==='update'){if(table==='items'&&['qty','held','hold_for','status'].some(k=>k in payload))return err('permission denied for column qty');
      const r=rowsOf().filter(x=>filters.every(f=>f(x)));r.forEach(x=>{Object.assign(x,payload);emit(table,'UPDATE',{...x})});persist();return {data:single?{...r[0]}:r,error:null}}
    if(op==='delete'){const key=TABLE[table]||table;const r=DB[key].filter(x=>filters.every(f=>f(x)));DB[key]=DB[key].filter(x=>!r.includes(x));
      if(table==='items')r.forEach(x=>{DB.stock=DB.stock.filter(s=>s.item_id!==x.id)});persist();r.forEach(x=>emit(table,'DELETE',null,x));return {data:r,error:null}}
  }
  return b;
}
const rpcs={
  claim_owner(a){const m=DB.members.find(x=>x.user_id===uid());if(m)return m.role;if(DB.members.some(x=>x.role==='owner'))return 'none';addMember(uid(),'owner',a.p_name);return 'owner'},
  join_store(a){const m=DB.members.find(x=>x.user_id===uid());if(m)return m.role;if(a.p_code!==DB.secrets.invite_code)return 'err:bad_code';addMember(uid(),'seller',a.p_name);return 'seller'},
  rotate_invite_code(){DB.secrets.invite_code='K7MW4RQ2';return 'K7MW4RQ2'},
  sell_item(a){if(!isMember())throw 'forbidden';const ex=DB.sales.find(s=>s.id===a.p_sale_id);if(ex)return ex;const it=DB.items.find(i=>i.id===a.p_item_id);if(!it)throw 'not_found';
    const v=a.p_place_id||pick(it.id,'qty');if(!v)throw 'sold_out';const pl=place(v);let vs=v;
    if(pl.open){if(!canUse(v))throw 'forbidden'}else{if(!wasIn(v))throw 'forbidden';vs=bodega()}
    const st=row(it.id,vs);if(!st||st.qty<=0)throw 'sold_out';if(!(a.p_price>0))throw 'bad_price';if(a.p_price<it.min_price)throw 'below_min';
    putStock(it.id,vs,r=>{const names=(r.hold_for||'').split(' · ').filter(Boolean);const use=r.held>0&&(a.p_from_hold||r.qty-r.held<=0);r.qty--;if(use){r.held--;names.shift();r.hold_for=names.join(' · ')}});
    const s={id:a.p_sale_id,item_id:it.id,name:it.name,list_price:it.price,price:a.p_price,method:a.p_method,event_name:pl.name,event_started:pl.started_at,voided:false,seller_id:uid(),sold_at:a.p_sold_at||now(),place_id:v};DB.sales.push(s);emit('sales','INSERT',{...s});return s},
  void_sale(a){const s=DB.sales.find(x=>x.id===a.p_sale_id);if(!s||s.voided)return null;s.voided=true;emit('sales','UPDATE',{...s});
    if(DB.items.some(i=>i.id===s.item_id)){const p=place(s.place_id);putStock(s.item_id,p&&p.open?s.place_id:bodega(),r=>{r.qty++})}return null},
  hold_item(a){const v=a.p_place_id||pick(a.p_item_id,'free');if(!v)throw 'sold_out';if(!canUse(v))throw place(v)&&!place(v).open?'place_closed':'forbidden';
    const r=row(a.p_item_id,v);if(!r||r.qty-r.held<=0)throw 'sold_out';putStock(a.p_item_id,v,r=>{r.held++;r.hold_for=[r.hold_for,a.p_who||'sin nombre'].filter(Boolean).join(' · ')});return null},
  release_item(a){const v=a.p_place_id||pick(a.p_item_id,'held');if(!v)return null;if(!wasIn(v))throw 'forbidden';const r=row(a.p_item_id,v);if(!r||r.held<=0)return null;
    putStock(a.p_item_id,v,r=>{const n=(r.hold_for||'').split(' · ').filter(Boolean);let k=n.indexOf(a.p_who);n.splice(k>=0?k:0,1);r.held--;r.hold_for=r.held?n.join(' · '):''});return null},
  move_stock(a){if(!isMember())throw 'forbidden';const ex=DB.moves.find(m=>m.id===a.p_move_id);if(ex)return ex;if(!(a.p_qty>=1)||a.p_from===a.p_to)throw 'bad_qty';
    if(!canUse(a.p_from)||!canUse(a.p_to))throw 'forbidden';const r=row(a.p_item_id,a.p_from);if(!r||r.qty-r.held<a.p_qty)throw 'not_enough';
    putStock(a.p_item_id,a.p_from,r=>{r.qty-=a.p_qty});putStock(a.p_item_id,a.p_to,r=>{r.qty+=a.p_qty});
    const m={id:a.p_move_id,item_id:a.p_item_id,from_place:a.p_from,to_place:a.p_to,qty:a.p_qty,user_id:uid(),at:now()};DB.moves.push(m);return m},
  set_stock(a){if(!isOwner())throw 'forbidden';if(!(a.p_qty>=0))throw 'bad_qty';if(!place(a.p_place_id)||!place(a.p_place_id).open)throw 'place_closed';
    const r=row(a.p_item_id,a.p_place_id);if(r&&a.p_qty<r.held)throw 'held_units';putStock(a.p_item_id,a.p_place_id,r=>{r.qty=a.p_qty});return null},
  open_fair(a){if(!isOwner())throw 'forbidden';const p={id:crypto.randomUUID(),name:a.p_name||'Feria',kind:'feria',open:true,started_at:now(),closed_at:null};DB.places.push(p);emit('places','INSERT',{...p});
    (a.p_users||[]).forEach(u=>{if(DB.members.some(m=>m.user_id===u&&m.role==='seller')){const r={place_id:p.id,user_id:u};DB.place_members.push(r);emit('place_members','INSERT',r)}});return p},
  close_fair(a){if(!isOwner())throw 'forbidden';const p=place(a.p_place_id);if(!p||p.kind!=='feria'||!p.open)throw 'not_found';p.open=false;p.closed_at=now();
    const rows=DB.stock.filter(s=>s.place_id===p.id);let n=0;for(const r of rows){n+=r.qty;const q=r.qty;r.qty=0;r.held=0;r.hold_for='';putStock(r.item_id,p.id,()=>{});putStock(r.item_id,bodega(),x=>{x.qty+=q})}
    emit('places','UPDATE',{...p});return n},
  start_event(a){DB.settings.event_name=a.p_name||'Evento';DB.settings.event_started=now();emit('settings','UPDATE',{...DB.settings});return null}
};
window.supabase={createClient(){return {
  from:q,
  rpc(n,a){return new Promise(res=>setTimeout(()=>{if(OFF())return res(err('Failed to fetch'));if(!session)return res(err('JWT'));
    const snap=JSON.stringify(DB);try{const d=rpcs[n](a||{});persist();res({data:d,error:null})}catch(e){Object.assign(DB,JSON.parse(snap));res(err(String(e)))}},10))},
  auth:{async getSession(){return {data:{session}}},
    async signInWithPassword({email,password}){const u=DB.users.find(x=>x.email===email&&x.password===password);if(!u)return err('Invalid login credentials');session={user:u};localStorage.setItem('__fakesess',JSON.stringify(session));return {data:{session},error:null}},
    async signOut(){session=null;localStorage.removeItem('__fakesess')},onAuthStateChange(){}},
  channel(){const ch={on(_,f,fn){listeners.push({table:f.table,fn});return ch},subscribe(cb){setTimeout(()=>cb&&cb('SUBSCRIBED'),5);return ch}};return ch},
  removeChannel(){},
  storage:{from(){return {upload:async()=>({error:null}),getPublicUrl:p=>({data:{publicUrl:'https://x/'+p}})}}}
}}};
})();
