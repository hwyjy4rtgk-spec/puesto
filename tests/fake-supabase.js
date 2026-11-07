(function(){
const DB=window.__DB||(window.__DB=JSON.parse(localStorage.getItem('__fakedb')||'null')||{users:[],members:[],items:[],sales:[],settings:{id:1,event_name:'Mi primer evento',event_started:new Date(Date.now()-86400e3).toISOString()},secrets:{invite_code:'ABC123'}});
const persist=()=>localStorage.setItem('__fakedb',JSON.stringify(DB));
let session=JSON.parse(localStorage.getItem('__fakesess')||'null');
const OFF=()=>window.__offline;
const err=m=>({data:null,error:{message:m}});
const uid=()=>session&&session.user.id;
const isMember=()=>DB.members.some(m=>m.user_id===uid());
const isOwner=()=>DB.members.some(m=>m.user_id===uid()&&m.role==='owner');
const listeners=[];
function emit(table,eventType,n,o){listeners.forEach(l=>{if(l.table===table)setTimeout(()=>l.fn({eventType,new:n,old:o||{}}),5)})}
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
    DB.members.push({user_id:u.id,role,name:b.name,created_at:new Date().toISOString()});persist();return J({ok:true,role});
  }
  return realFetch(url,opt);
};
function q(table){
  let filters=[],op='select',payload=null,single=false,maybe=false,order=null;
  const b={select(){return b},insert(p){op='insert';payload=p;return b},update(p){op='update';payload=p;return b},delete(){op='delete';return b},
    eq(k,v){filters.push(r=>r[k]===v);return b},gte(k,v){filters.push(r=>r[k]>=v);return b},order(k){order=k;return b},single(){single=true;return b},maybeSingle(){maybe=true;single=true;return b},
    then(res,rej){return Promise.resolve(run()).then(res,rej)}};
  function rowsOf(){if(table==='settings')return [DB.settings];if(table==='secrets')return isOwner()?[{...DB.secrets,id:1}]:[];return DB[table]}
  function run(){
    if(OFF())return err('Failed to fetch');if(!session)return err('JWT');
    const canRead=table==='secrets'?isOwner():isMember();
    if(op==='select'){let r=canRead?rowsOf().filter(x=>filters.every(f=>f(x))):[];if(order)r=[...r].sort((a,b)=>String(a[order]).localeCompare(String(b[order])));
      if(single){if(!r.length)return maybe?{data:null,error:null}:err('no rows');return {data:JSON.parse(JSON.stringify(r[0])),error:null}}return {data:JSON.parse(JSON.stringify(r)),error:null}}
    if(!isOwner())return err('new row violates row-level security policy');
    if(op==='insert'){const arr=Array.isArray(payload)?payload:[payload];const out=arr.map(p=>({id:crypto.randomUUID(),type:'Réflex',cond:'Muy buena',qty:1,tested:[],pitch:'',notes:'',photo_url:'',status:'disp',hold_for:'',...p}));
      DB[table].push(...out);persist();out.forEach(r=>emit(table,'INSERT',r));return {data:single?out[0]:out,error:null}}
    if(op==='update'){const r=rowsOf().filter(x=>filters.every(f=>f(x)));r.forEach(x=>{Object.assign(x,payload);emit(table,'UPDATE',{...x})});persist();return {data:single?{...r[0]}:r,error:null}}
    if(op==='delete'){const r=DB[table].filter(x=>filters.every(f=>f(x)));DB[table]=DB[table].filter(x=>!r.includes(x));persist();r.forEach(x=>emit(table,'DELETE',null,x));return {data:r,error:null}}
  }
  return b;
}
const rpcs={
  claim_owner(a){const m=DB.members.find(x=>x.user_id===uid());if(m)return m.role;if(DB.members.some(x=>x.role==='owner'))return 'none';DB.members.push({user_id:uid(),role:'owner',name:a.p_name,created_at:new Date().toISOString()});return 'owner'},
  join_store(a){const m=DB.members.find(x=>x.user_id===uid());if(m)return m.role;if(a.p_code!==DB.secrets.invite_code)return 'err:bad_code';DB.members.push({user_id:uid(),role:'seller',name:a.p_name,created_at:new Date().toISOString()});return 'seller'},
  rotate_invite_code(){DB.secrets.invite_code='K7MW4RQ2';return 'K7MW4RQ2'},
  sell_item(a){if(!isMember())throw 'forbidden';const ex=DB.sales.find(s=>s.id===a.p_sale_id);if(ex)return ex;const it=DB.items.find(i=>i.id===a.p_item_id);if(!it)throw 'not_found';if(it.qty<=0)throw 'sold_out';if(!(a.p_price>0))throw 'bad_price';if(a.p_price<it.min_price)throw 'below_min';
    it.held=it.held||0;const names=(it.hold_for||'').split(' · ').filter(Boolean);const use=it.held>0&&(a.p_from_hold||it.qty-it.held<=0);
    it.qty--;if(use){it.held--;names.shift()}it.hold_for=it.held?names.join(' · '):'';it.status=it.held?'apart':'disp';
    const s={id:a.p_sale_id,item_id:it.id,name:it.name,list_price:it.price,price:a.p_price,method:a.p_method,event_name:DB.settings.event_name,event_started:DB.settings.event_started,voided:false,seller_id:uid(),sold_at:a.p_sold_at};DB.sales.push(s);emit('items','UPDATE',{...it});emit('sales','INSERT',{...s});return s},
  void_sale(a){const s=DB.sales.find(x=>x.id===a.p_sale_id);if(!s||s.voided)return null;s.voided=true;const it=DB.items.find(i=>i.id===s.item_id);if(it){it.qty++;emit('items','UPDATE',{...it})}emit('sales','UPDATE',{...s});return null},
  hold_item(a){const it=DB.items.find(i=>i.id===a.p_item_id);it.held=it.held||0;if(!it||it.qty-it.held<=0)throw 'sold_out';it.held++;it.status='apart';it.hold_for=[it.hold_for,a.p_who||'sin nombre'].filter(Boolean).join(' · ');emit('items','UPDATE',{...it});return null},
  release_item(a){const it=DB.items.find(i=>i.id===a.p_item_id);it.held=it.held||0;if(it.held>0){const n=(it.hold_for||'').split(' · ').filter(Boolean);let k=n.indexOf(a.p_who);n.splice(k>=0?k:0,1);it.held--;it.hold_for=it.held?n.join(' · '):''}it.status=it.held?'apart':'disp';emit('items','UPDATE',{...it});return null},
  start_event(a){DB.settings.event_name=a.p_name||'Evento';DB.settings.event_started=new Date().toISOString();emit('settings','UPDATE',{...DB.settings});return null}
};
window.supabase={createClient(){return {
  from:q,
  rpc(n,a){return new Promise(res=>setTimeout(()=>{if(OFF())return res(err('Failed to fetch'));try{const d=rpcs[n](a||{});persist();res({data:d,error:null})}catch(e){res(err(String(e)))}},10))},
  auth:{async getSession(){return {data:{session}}},
    async signInWithPassword({email,password}){const u=DB.users.find(x=>x.email===email&&x.password===password);if(!u)return err('Invalid login credentials');session={user:u};localStorage.setItem('__fakesess',JSON.stringify(session));return {data:{session},error:null}},
    async signOut(){session=null;localStorage.removeItem('__fakesess')},onAuthStateChange(){}},
  channel(){const ch={on(_,f,fn){listeners.push({table:f.table,fn});return ch},subscribe(cb){setTimeout(()=>cb&&cb('SUBSCRIBED'),5);return ch}};return ch},
  removeChannel(){},
  storage:{from(){return {upload:async()=>({error:null}),getPublicUrl:p=>({data:{publicUrl:'https://x/'+p}})}}}
}}};
})();
