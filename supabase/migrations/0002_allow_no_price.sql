-- Precio 0 = "sin precio": el vendedor ve "Consultar precio" y escribe el monto al vender.
alter table public.items drop constraint if exists items_price_check;
alter table public.items drop constraint if exists items_min_price_check;
alter table public.items add constraint items_price_check check (price >= 0);
alter table public.items add constraint items_min_price_check check (min_price >= 0);
-- sell_item ahora rechaza ventas con precio <= 0 ('bad_price'); ver migración aplicada en el proyecto.
