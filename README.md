# Puesto

App web para vender cámaras de segunda mano en ferias. Funciona como un chat: el vendedor pregunta ("¿tienes Canon?", "algo bajo 100 lucas") y anota ventas o apartados escribiendo. El stock se comparte en vivo entre el dueño y los vendedores.

- **Frontend:** HTML/CSS/JS estático en `public/`, servido por Cloudflare Workers (static assets).
- **Base de datos, login y fotos:** Supabase, proyecto `puesto` (`apilqdurybxthqmozyrh`, São Paulo). Ya está creado y con el esquema aplicado.

## 1. Ajustar Supabase (2 minutos, una vez)

En el panel de Supabase → proyecto **puesto** → **Authentication**:

1. **Sign In / Providers → Email:** desactiva **Confirm email**. Así el vendedor entra apenas crea su cuenta, sin depender de que le llegue un correo. Si prefieres mantener la confirmación, haz el paso 2.
2. **URL Configuration:** en **Site URL** pon la dirección final de la app (la que te da Cloudflare en el paso siguiente, por ejemplo `https://puesto.TU-SUBDOMINIO.workers.dev`) y agrégala también en **Redirect URLs**.

## 2. Publicar en Cloudflare

Necesitas Node 18 o superior.

```bash
npm install
npx wrangler login      # abre el navegador para autorizar tu cuenta de Cloudflare
npm run deploy          # publica la carpeta public/
```

Wrangler muestra la URL publicada (`https://puesto.<tu-subdominio>.workers.dev`). Para usar un dominio propio: Cloudflare → Workers & Pages → puesto → Settings → Domains & Routes → Add → Custom domain.

Para probar en tu computador antes de publicar: `npm run dev` y abre http://localhost:8787.

## 3. Primer uso

1. **Tú (dueño):** abre la URL, toca "¿Primera vez? Crea tu cuenta". **La primera cuenta que se crea queda como dueño.** Créala tú antes de compartir el link.
2. Carga tus cámaras: botón **+** → Inventario → **Pegar lista** (copiar columnas desde Excel o Sheets: modelo; precio; mínimo; estado), o escribe en el chat "agrega Nikon F3 350 lucas mínimo 320".
3. Menú → **Ajustes** → copia el **código del puesto** y envíaselo al vendedor junto con el link.
4. **Vendedor:** abre el link, crea su cuenta y escribe el código. Desde ahí solo puede buscar, vender, apartar y ver las ventas. No puede editar precios ni el inventario.
5. En el celular, "Agregar a pantalla de inicio" para que se abra como una app.

## Cómo funciona

- **Ventas atómicas:** `sell_item` bloquea la fila de la cámara. Si dos celulares venden la misma cámara al mismo tiempo, solo una venta pasa y la otra recibe "ya estaba vendida". El precio mínimo se valida en la base, no solo en la pantalla.
- **Sin señal:** las ventas, anulaciones y apartados quedan en una cola en el celular y se envían solos al volver la conexión (cada 15 s, al recuperar red o al volver a la app). Cada venta tiene un id generado en el celular, así que un reintento nunca la duplica. Si al sincronizar la cámara ya se había vendido en otro celular, el chat avisa.
- **Tiempo real:** cambios de stock, ventas y eventos llegan a todos los celulares por Supabase Realtime.
- **Permisos (RLS):** solo los miembros ven datos. Solo el dueño edita el inventario, cambia el evento, ve el código de invitación y quita vendedores. Un vendedor puede anular solo sus propias ventas y solo durante 30 minutos.
- **Eventos:** "Nuevo evento" deja el contador en cero en todos los celulares. Las ventas anteriores se conservan y salen en "Descargar ventas" (CSV con todos los eventos).
- **Fotos:** opcionales. Se suben al bucket `fotos` (lectura pública con nombres aleatorios). Sin foto se usa la ilustración del tipo de cámara.

## Archivos

```
public/
  index.html        pantalla de login, chat y hojas
  app.js            lógica: chat, sincronización, cola sin señal
  styles.css
  config.js         URL y llave publicable de Supabase (seguras en el navegador)
  sw.js             cache para abrir la app sin señal
  vendor/           cliente de Supabase (incluido, no depende de un CDN)
supabase/migrations/0001_init.sql   esquema completo (ya aplicado)
wrangler.jsonc      configuración de Cloudflare
```

## Cambiar de proyecto Supabase

Ejecuta `supabase/migrations/0001_init.sql` en el SQL Editor del proyecto nuevo y cambia `public/config.js`.
