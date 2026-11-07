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
  await p.click('header .title'); await p.waitForTimeout(200); await p.click('#menuBody [data-act=openImport]'); await p.waitForTimeout(250);
  await p.fill('#impTxt', 'Olympus mju II; 350.000; 330.000; Muy buena\nPentax K1000 + 50mm; 210000; 190000; Excelente\nPolaroid 600; 75.000');
  await p.waitForTimeout(100); await p.click('#impBtn'); await p.waitForTimeout(400);
  check('pegar lista crea 3 productos', (await p.db()).items.length === 3, (await p.db()).items.length);
  await p.click('header .title'); await p.waitForTimeout(150); await p.click('[data-mtab=ajustes]'); await p.waitForTimeout(300);
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
  const tabs = await s.evaluate(() => { document.querySelector('header .title').click(); return [...document.querySelectorAll('#menuSeg button')].map(x => x.textContent); });
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
  try { await accountsAndOffline(b, url); await searchAndPanel(b, url); await language(b, url); }
  catch (e) { fails++; console.log('  ✗ error inesperado: ' + e.message.split('\n')[0]); }
  await b.close(); srv.close();
  console.log(`\n${passes} bien, ${fails} mal`);
  process.exit(fails ? 1 : 0);
})();
