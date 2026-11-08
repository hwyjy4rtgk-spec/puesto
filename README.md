# Puesto

App web para vender cámaras de segunda mano en ferias, pensada para usarse con una mano y al sol. El vendedor no necesita conocer el producto: busca escribiendo o tocando marca → modelo, ve precio y stock al instante, y cobra desde un carro. El stock se comparte en vivo entre el dueño y los vendedores.

- **App:** https://hwyjy4rtgk-spec.github.io/puesto/
- **Frontend:** HTML/CSS/JS estático en `public/`, sin build. Se publica en GitHub Pages (rama `gh-pages`) cada vez que cambia `main`, **solo si pasan las pruebas**.
- **Base de datos y login:** Supabase, proyecto `puesto` (`apilqdurybxthqmozyrh`, São Paulo).

## Uso

1. **Dueño:** la primera cuenta que se crea queda como dueño.
2. Inventario: menú ☰ → **Inventario**. Ahí se busca, se cambia el precio tocándolo, se suman o restan unidades, y se ven los productos **sin precio** y **agotados**. "Pegar lista" acepta columnas copiadas de Excel/Sheets (modelo; precio; mínimo; estado).
3. Menú → **Ajustes** → **Compartir** manda el link y el código del puesto al vendedor.
4. **Vendedor:** abre el link, crea su cuenta y escribe el código. Puede buscar, vender, apartar y ver las ventas; no edita precios ni inventario.
5. En el celular: "Agregar a pantalla de inicio".

## Varias ferias a la vez

- Hay una **bodega** y las **ferias abiertas**; cada una tiene su propio stock. El total de un producto es la suma de todos los lugares.
- Tocando el nombre de arriba se elige dónde está vendiendo ese celular. Cada vendedor ve solo las ferias a las que el dueño lo asignó.
- **Mover cámaras:** desde el selector de feria o desde Menú → Ferias. Se eligen origen, destino y cuántas unidades; también funciona sin señal y se envía después. En la ficha de una cámara aparece "Dónde está" con botones *Traer 1* / *Llevar 1*, y al buscar algo que está en otra feria sale con el botón *Traer*.
- Solo se mueven unidades libres (las apartadas no). Cada traslado queda registrado en `moves`.
- **Cerrar una feria** devuelve lo que quedó a la bodega (los apartados se liberan). Las ventas quedan guardadas con su feria.

## Cómo encuentra el vendedor una cámara sin escribir

Portada → **Por marca** (con unidades disponibles) → grilla de modelos con el número grande del modelo (lo que está impreso en la cámara: "FE-230", "D-230", "S5 IS"), precio y stock → **+** al carro. También quedan los **Vistos recién** para volver a una cámara que el cliente estaba mirando.

## Cómo funciona

- **Ventas atómicas:** `sell_item` bloquea la fila. Si dos celulares venden la misma cámara a la vez, solo una venta pasa. El precio mínimo se valida en la base.
- **Sin señal:** ventas, anulaciones y apartados quedan en una cola local y se envían solos al volver la conexión. Cada venta lleva un id generado en el celular, así que un reintento nunca la duplica.
- **Apartados por unidad:** `hold_item` / `release_item`; una cámara apartada no se puede vender por otro vendedor.
- **Tiempo real:** cambios de stock y ventas llegan a todos los celulares por Supabase Realtime.
- **Permisos (RLS):** solo los miembros ven datos; solo el dueño edita inventario, eventos y vendedores. Un vendedor anula solo sus ventas y solo durante 30 minutos.
- **Código de invitación:** máximo 5 intentos malos cada 15 minutos (por usuario en `join_store` y por IP en la función `signup`). Los códigos nuevos tienen 8 caracteres sin letras que se confunden.

## Archivos

```
public/
  index.html          pantallas y hojas
  styles.css
  config.js           URL y llave publicable de Supabase (seguras en el navegador)
  sw.js               copia local para abrir sin señal (network-first)
  js/                 se cargan en este orden y comparten alcance global:
    core.js           configuración, estado, cola sin señal, sincronización
    lenguaje.js       entender lo que escribe el vendedor (sin IA)
    asistente.js      acciones, tarjetas y chat del asistente
    buscador.js       buscador, índice por marca, carro, ficha
    panel.js          panel del dueño, editor, importar
    ferias.js         elegir feria, mover cámaras, abrir/cerrar ferias
    eventos.js        toques y teclado
    arranque.js       login, registro y arranque
  vendor/             cliente de Supabase (sin CDN)
supabase/
  migrations/         esquema (ya aplicado en el proyecto)
  functions/signup/   registro sin correo de confirmación, con límite de intentos
tests/
  e2e.test.js         pruebas de punta a punta en Chromium
  fake-supabase.js    Supabase falso en memoria (no toca la base real)
  seed.json           inventario de prueba
```

## Pruebas

```bash
npm install && npx playwright install chromium
npm test
```

Al publicar una versión nueva, sube el número `?v=` en `index.html` y la constante `V` en `sw.js` para que los celulares la tomen de inmediato.

## Cambiar de proyecto Supabase

Ejecuta las migraciones de `supabase/migrations/` en orden, despliega `supabase/functions/signup` y cambia `public/config.js`.
