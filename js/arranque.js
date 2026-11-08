/* Puesto · Login, registro, unión con código y arranque */
'use strict';
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
const SIGNUP_ERR={need_code:'Este puesto ya tiene dueño. Escribe el código que te dio para unirte como vendedor.',bad_code:'Ese código no es válido. Pídele al dueño el código actual.',exists:'Ese correo ya tiene cuenta. Toca “Ya tengo cuenta” y entra.',bad_email:'Escribe un correo válido.',weak_password:'La contraseña debe tener al menos 6 caracteres.',no_name:'Escribe tu nombre.',too_many:'Demasiados intentos. Espera 15 minutos y vuelve a probar.'};
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
  if(code.length<6){$('#joinErr').textContent='El código tiene 6 u 8 caracteres.';return}
  const {data,error}=await sb.rpc('join_store',{p_code:code,p_name:me.name});
  if(error){$('#joinErr').textContent=/bad_code/.test(error.message)?'Ese código no es válido. Pídele al dueño el código actual.':isNet(error)?'Sin conexión.':error.message;return}
  if(typeof data==='string'&&data.startsWith('err:')){$('#joinErr').textContent=data==='err:too_many'?'Demasiados intentos. Espera 15 minutos y vuelve a probar.':'Ese código no es válido. Pídele al dueño el código actual.';return}
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
  derive();setMode(mode);
  if(!offline){try{await loadAll();derive();setOnline(true)}catch(e){if(isNet(e))setOnline(false);else toast('No se pudo cargar: '+e.message)}}
  const mine=base.members.find(m=>m.user_id===me.id);if(mine){me.role=mine.role;if(!me.name)me.name=mine.name}
  saveCache();subscribe();flush();if(mode==='search')renderSearch();else renderChat(false);
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
  if(cached&&me.role){$('#gate').hidden=true;$('#app').hidden=false;derive();setMode('search')}
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
