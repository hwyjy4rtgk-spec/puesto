// Pruebas de punta a punta: abren la app real (public/) en Chromium con un Supabase falso
// (tests/fake-supabase.js) que guarda todo en localStorage. No tocan la base real.
// Uso: npm test        (requiere: npm i && npx playwright install chromium)
'use strict';
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');

const PUB = path.join(__dirname, '..', 'public');
const FAKE = path.join(__dirname, 'fake-supabase.js');
const SEED = fs.readFileSync(path.join(__dirname, 'seed.json'), 'utf8');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };

const srv = http.createServer((q, r) => {
  let p = decodeURIComponent(q.url.split('?')[0]);
  if (!p.startsWith('/puesto/')) { r.writeHead(404); return r.end(); }
  p = p.slice('/puesto'.length); if (p === '/') p = '/index.html';
  const f = p === '/vendor/supabase.js' ? FAKE : path.join(PUB, p);
  if (!f.startsWith(PUB) && f !== FAKE || !fs.existsSync(f)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(r);
});

let fails = 0, passes = 0;
const check = (name, ok, got) => { if (ok) { passes++; console.log('  ✓ ' + name); } else { fails++; console.log('  ✗ ' + name + (got !== undefined ? '  → ' + JSON.stringify(got) : '')); } };
const wait = ms => new Promise(r => setTimeout(r, ms));

async function newPage(b, url, seed) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await ctx.route(/fonts\.(googleapis|gstatic)/, r => r.abort());
  const p = await ctx.newPage(); p.errs = [];
  p.on('pageerror', e => p.errs.push(e.message));
  await p.goto(url);
  if (seed) {
    await p.evaluate(s => { localStorage.clear(); localStorage.setItem('__fakedb', s); localStorage.setItem('__fakesess', JSON.stringify({ user: JSON.parse(s).users[0] })); }, seed);
    await p.reload(); await p.waitForTimeout(700);
  }
  p.db = async () => JSON.parse(await p.evaluate(() => localStorage.getItem('__fakedb')));
  p.ask = async t => {
    if (!(await p.evaluate(() => document.body.classList.contains('mode-chat')))) await p.evaluate(() => document.querySelector('[data-act="toChat"]').click());
    await p.fill('#msg', t); await p.press('#msg', 'Enter'); await p.waitForTimeout(450);
    return p.evaluate(() => { const m = [...document.querySelectorAll('#chat .msg.bot')].pop(); return m ? m.innerText.replace(/\s+/g, ' ') : ''; });
  };
  return p;
}

async function accountsAndOffline(b, url) {
  console.log('Cuentas, código de invitación y ventas sin señal');
  const p = await newPage(b, url);
  await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(300);
  await p.click('[data-act=toggleAuth]'); await p.fill('#aName', 'Dueña'); await p.fill('#aEmail', 'dueno@x.cl'); await p.fill('#aPass', 'secreto1'); await p.click('#authBtn'); await p.waitForTimeout(500);
  check('la primera cuenta entra como dueño', !(await p.isHidden('#app')));
  await p.click('button.round[data-act="openMenu"]'); await p.waitForTimeout(200); await p.click('#menuBody [data-act=openImport]'); await p.waitForTimeout(250);
  await p.fill('#impTxt', 'Olympus mju II; 350.000; 330.000; Muy buena\nPentax K1000 + 50mm; 210000; 190000; Excelente\nPolaroid 600; 75.000');
  await p.waitForTimeout(100); await p.click('#impBtn'); await p.waitForTimeout(400);
  check('pegar lista crea 3 productos', (await p.db()).items.length === 3, (await p.db()).items.length);
  await p.click('button.round[data-act="openMenu"]'); await p.waitForTimeout(150); await p.click('[data-mtab=ajustes]'); await p.waitForTimeout(300);
  check('el dueño ve el código de invitación', (await p.textContent('#codeTxt')).trim() === 'ABC123');

  const s = await newPage(b, url);
  await s.evaluate(d => localStorage.setItem('__fakedb', d), JSON.stringify(await p.db())); await s.reload(); await s.waitForTimeout(300);
  await s.click('[data-act=toggleAuth]'); await s.fill('#aName', 'Diego'); await s.fill('#aEmail', 'vende@x.cl'); await s.fill('#aPass', 'secreto2'); await s.click('#authBtn'); await s.waitForTimeout(300);
  check('sin código pide el código', /código/.test(await s.textContent('#authErr')));
  await s.fill('#aCode', 'abc999'); await s.click('#authBtn'); await s.waitForTimeout(300);
  check('código malo se rechaza', /no es válido/.test(await s.textContent('#authErr')));
  await s.fill('#aCode', 'abc123'); await s.click('#authBtn');
  const joined = await s.waitForFunction(() => !document.querySelector('#app').hidden, null, { timeout: 4000 }).then(() => true, () => false);
  check('con el código entra como vendedor', joined && (await s.db()).members.some(m => m.name === 'Diego' && m.role === 'seller'));
  await s.ask('vendí la pentax en 150 lucas tarjeta');
  check('avisa cuando el precio está bajo el mínimo', !!(await s.$('.checkout small.bad')));
  await s.fill('.checkout .clp', '190000'); await s.waitForTimeout(100); await s.click('.checkout [data-cpay]'); await s.waitForTimeout(500);
  await s.evaluate(() => { window.__offline = true; window.dispatchEvent(new Event('offline')); });
  await s.ask('vendí la olympus en 350 efectivo'); await s.click('.checkout [data-cpay]'); await s.waitForTimeout(400);
  check('sin señal la venta queda por enviar', /por enviar/.test(await s.textContent('#hStats')));
  const tabs = await s.evaluate(() => { document.querySelector('button.round[data-act="openMenu"]').click(); return [...document.querySelectorAll('#menuSeg button')].map(x => x.textContent); });
  check('el vendedor no ve el inventario', !tabs.includes('Inventario'), tabs);
  await s.evaluate(() => document.getElementById('scrim').click());
  await s.evaluate(() => { window.__offline = false; window.dispatchEvent(new Event('online')); }); await s.waitForTimeout(900);
  const db = await s.db();
  check('al volver la señal se envían las 2 ventas', db.sales.length === 2, db.sales.length);
  check('el stock se descuenta', db.items.filter(i => i.qty === 0).length === 2);
  check('sin errores de JavaScript', !p.errs.length && !s.errs.length, [...p.errs, ...s.errs]);
}

async function searchAndPanel(b, url) {
  console.log('Buscador, índice por marca, carro y panel del dueño');
  const p = await newPage(b, url, SEED);
  check('la portada muestra marcas', (await p.$$('.btile[data-brand]')).length > 5);
  await p.tap('.btile[data-brand="Olympus"]'); await p.waitForTimeout(250);
  const tiles = await p.$$eval('.mtile', a => a.map(x => x.innerText.replace(/\s+/g, ' ')));
  check('al tocar la marca salen sus modelos', tiles.length >= 3 && tiles.some(t => /FE-230/.test(t)), tiles);
  await p.tap('.mtile .madd'); await p.waitForTimeout(200);
  check('el + agrega al carro', /Cobrar/.test(await p.textContent('#cartBar')));
  await p.tap('.bback'); await p.waitForTimeout(200);
  await p.fill('#msg', 'fe230'); await p.waitForTimeout(300);
  check('escribir busca al instante (y tolera "fe230")', /FE-230/.test(await p.textContent('#search')));
  check('sin desborde horizontal', !(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)));

  await p.fill('#msg', ''); await p.tap('button.round[data-act="openMenu"]'); await p.waitForTimeout(300);
  const before = (await p.db()).items.find(i => /FE-230/.test(i.name));
  await p.fill('#invQ', 'fe230'); await p.waitForTimeout(150);
  await p.tap('.ipr'); await p.fill('#ipe', '33000'); await p.press('#ipe', 'Enter'); await p.waitForTimeout(350);
  await p.tap('[data-inc]'); await p.waitForTimeout(350);
  const after = (await p.db()).items.find(i => i.id === before.id);
  check('cambiar precio desde el inventario', after.price === 33000, after.price);
  check('sumar unidad desde el inventario', after.qty === before.qty + 1, [before.qty, after.qty]);
  await p.tap('[data-dec]'); await p.waitForTimeout(300);
  check('restar unidad desde el inventario', (await p.db()).items.find(i => i.id === before.id).qty === before.qty);
  check('sin errores de JavaScript', !p.errs.length, p.errs);
}

async function fairs(b, url) {
  console.log('Varias ferias: abrir, mover, vender en cada una y cerrar');
  const p = await newPage(b, url, SEED);
  const db0 = await p.db();
  const units0 = db0.items.reduce((a, i) => a + i.qty, 0);
  check('migración: todo el stock queda en la feria abierta', db0.stock.reduce((a, s) => a + s.qty, 0) === units0 && db0.places.length === 2);
  // abrir segunda feria
  await p.tap('button.round[data-act="openMenu"]'); await p.waitForTimeout(250);
  await p.tap('[data-mtab="ferias"]'); await p.waitForTimeout(200);
  await p.tap('[data-act="newFair"]'); await p.fill('#nfName', 'Mercado Domingo'); await p.tap('[data-act="doNewFair"]'); await p.waitForTimeout(500);
  check('al abrir la feria se ofrece llevar cámaras', await p.isVisible('#moveSheet.on'));
  // elegir 2 unidades de una cámara con stock >= 2 y 1 de otra
  const multi = (await p.db()).items.find(i => i.qty >= 2 && !i.held);
  await p.fill('#mvQ', multi.name.split(' ').slice(0, 2).join(' ')); await p.waitForTimeout(150);
  await p.tap(`[data-mvinc="${multi.id}"]`); await p.tap(`[data-mvinc="${multi.id}"]`);
  await p.tap('#mvGo'); await p.waitForTimeout(500);
  let db = await p.db(); const mk = db.places.find(x => x.name === 'Mercado Domingo');
  const at = (d, it, pl) => (d.stock.find(s => s.item_id === it && s.place_id === pl) || { qty: 0 }).qty;
  check('mover 2 unidades a la feria nueva', at(db, multi.id, mk.id) === 2, at(db, multi.id, mk.id));
  check('el total no cambia al mover', db.items.reduce((a, i) => a + i.qty, 0) === units0);
  // cambiar a la feria nueva y vender ahí
  await p.tap('header .title'); await p.waitForTimeout(250);
  check('el título abre el selector de feria', await p.isVisible('#placeSheet.on'));
  await p.tap(`#placeSheet [data-here="${mk.id}"]`); await p.waitForTimeout(300);
  check('la cabecera muestra la feria elegida', /Mercado Domingo/.test(await p.textContent('#hName')));
  const listed = await p.$$eval('#search .srow [data-open]', a => a.length);
  check('en la feria nueva solo se ve lo que se llevó', listed === 1, listed);
  await p.tap(`[data-add="${multi.id}"]`); await p.waitForTimeout(150); await p.tap('#cartBar'); await p.waitForTimeout(300);
  const needPrice = await p.$('.checkout .clp'); if (needPrice) await p.fill('.checkout .clp', String(Math.max(multi.price, 1000)));
  await p.tap('.checkout [data-cpay]'); await p.waitForTimeout(500); await p.tap('#coSheet .btn.primary[data-act="closeSheet"]'); await p.waitForTimeout(300);
  db = await p.db();
  check('vender en la feria nueva descuenta de esa feria', at(db, multi.id, mk.id) === 1 && db.sales.some(s => s.place_id === mk.id));
  // traer desde la otra feria con un toque, sin señal
  const fe = db.places.find(x => x.kind === 'feria' && x.id !== mk.id);
  const other = db.items.find(i => i.id !== multi.id && at(db, i.id, fe.id) > 0 && !i.held && /Olympus/.test(i.name));
  await p.evaluate(() => { window.__offline = true; window.dispatchEvent(new Event('offline')); });
  await p.fill('#msg', other.name.split(' ').slice(1, 3).join(' ')); await p.waitForTimeout(250);
  check('buscar algo que está en otra feria lo muestra con "Traer"', !!(await p.$(`[data-bring="${other.id}:${fe.id}"]`)));
  await p.tap(`[data-bring="${other.id}:${fe.id}"]`); await p.waitForTimeout(250);
  check('sin señal, lo traído ya se ve aquí', !!(await p.$(`#search [data-add="${other.id}"]`)));
  await p.evaluate(() => { window.__offline = false; window.dispatchEvent(new Event('online')); }); await p.waitForTimeout(900);
  db = await p.db();
  check('al volver la señal, el traslado queda en la base', at(db, other.id, mk.id) === 1);
  // cerrar la feria nueva
  await p.fill('#msg', ''); await p.tap('button.round[data-act="openMenu"]'); await p.waitForTimeout(250); await p.tap('[data-mtab="ferias"]'); await p.waitForTimeout(150);
  await p.tap(`[data-fopen="${mk.id}"]`); await p.waitForTimeout(150); await p.tap(`[data-act="askCloseFair"][data-pid="${mk.id}"]`); await p.waitForTimeout(150);
  await p.tap(`[data-fclose="${mk.id}"]`); await p.waitForTimeout(700);
  db = await p.db(); const bo = db.places.find(x => x.kind === 'bodega');
  check('cerrar la feria devuelve lo que quedó a la bodega', at(db, multi.id, bo.id) === 1 && at(db, other.id, bo.id) === 1 && !db.stock.some(s => s.place_id === mk.id));
  check('el total cuadra: inicial menos 1 vendida', db.items.reduce((a, i) => a + i.qty, 0) === units0 - 1);
  check('sin desborde horizontal', !(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)));
  check('sin errores de JavaScript', !p.errs.length, p.errs);
}

// Frases que el vendedor escribe de verdad y lo que la respuesta debe contener.
const PHRASES = [
  ['cuantas digitales quedan', /Quedan \d+ digitales/],
  ['análogas bajo 40 lucas', /análogas hasta \$40\.000/],
  ['cuanto cuesta la ginfax', /\$/],
  ['vendí la fe-230 en efectivo', /medio de pago/],
  ['tienes olympus?', /Olympus/],
  ['cuantas cámaras tengo', /cámaras/],
];
async function language(b, url) {
  console.log('Asistente: frases típicas');
  const p = await newPage(b, url, SEED);
  for (const [q, re] of PHRASES) { const r = await p.ask(q); check(`"${q}"`, re.test(r), r.slice(0, 140)); }
  check('sin errores de JavaScript', !p.errs.length, p.errs);
}

(async () => {
  await new Promise(r => srv.listen(0, r));
  const url = `http://localhost:${srv.address().port}/puesto/`;
  const b = await chromium.launch();
  try { await accountsAndOffline(b, url); await searchAndPanel(b, url); await fairs(b, url); await language(b, url); }
  catch (e) { fails++; console.log('  ✗ error inesperado: ' + e.message.split('\n')[0]); }
  await b.close(); srv.close();
  console.log(`\n${passes} bien, ${fails} mal`);
  process.exit(fails ? 1 : 0);
})();
