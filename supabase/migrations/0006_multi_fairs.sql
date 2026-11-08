-- Varias ferias a la vez, cada una con su stock.
-- places: una bodega + ferias (abiertas o cerradas). stock: unidades por producto y lugar.
-- items.qty / items.held pasan a ser TOTALES calculados desde stock (trigger), así nada que lea
-- items se rompe. Todo el stock actual queda en la feria abierta hoy; no se pierde ninguna unidad.

-- ========== tablas ==========
create table public.places(
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 80),
  kind text not null default 'feria' check (kind in ('bodega','feria')),
  open boolean not null default true,
  started_at timestamptz not null default now(),
  closed_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index places_one_bodega on public.places(kind) where kind = 'bodega';

create table public.stock(
  item_id uuid not null references public.items(id) on delete cascade,
  place_id uuid not null references public.places(id) on delete restrict,
  qty int not null default 0 check (qty >= 0),
  held int not null default 0 check (held >= 0),
  hold_for text not null default '',
  updated_at timestamptz not null default now(),
  primary key (item_id, place_id),
  check (held <= qty)
);
create index stock_place on public.stock(place_id);

create table public.place_members(
  place_id uuid not null references public.places(id) on delete cascade,
  user_id uuid not null references public.members(user_id) on delete cascade,
  primary key (place_id, user_id)
);
create index place_members_user on public.place_members(user_id);

create table public.moves(
  id uuid primary key,
  item_id uuid references public.items(id) on delete set null,
  name text not null default '',
  from_place uuid references public.places(id),
  to_place uuid references public.places(id),
  qty int not null check (qty > 0),
  user_id uuid references auth.users(id) on delete set null,
  at timestamptz not null default now()
);

alter table public.sales add column place_id uuid references public.places(id);
create index sales_place on public.sales(place_id);
-- Solo para crear productos: en qué lugar queda el stock inicial (si falta, bodega).
alter table public.items add column add_to uuid;

-- ========== ayudantes ==========
create function public.bodega_id() returns uuid language sql stable security definer set search_path to '' as $$
  select id from public.places where kind = 'bodega' limit 1
$$;
-- ¿Puede el usuario actual operar en ese lugar? Dueño: cualquiera abierto. Vendedor: sus ferias abiertas.
create function public.can_use(p uuid) returns boolean language sql stable security definer set search_path to '' as $$
  select exists(select 1 from public.places pl where pl.id = p and pl.open and (public.is_owner()
    or (pl.kind = 'feria' and exists(select 1 from public.place_members m where m.place_id = p and m.user_id = (select auth.uid())))))
$$;
-- ¿Estuvo el usuario en ese lugar? (para ventas sin señal que llegan después de cerrar la feria)
create function public.was_in(p uuid) returns boolean language sql stable security definer set search_path to '' as $$
  select public.is_owner() or exists(select 1 from public.place_members m where m.place_id = p and m.user_id = (select auth.uid()))
$$;
-- Para apps antiguas que no mandan el lugar: elige uno donde el usuario puede operar.
create function public.pick_place(p_item uuid, p_need text) returns uuid language sql stable security definer set search_path to '' as $$
  select s.place_id from public.stock s join public.places pl on pl.id = s.place_id
  where s.item_id = p_item and public.can_use(s.place_id)
    and case p_need when 'held' then s.held > 0 when 'free' then s.qty - s.held > 0 else s.qty > 0 end
  order by (pl.kind = 'feria') desc, pl.started_at limit 1
$$;

-- items.qty/held/hold_for = suma de stock
create function public.sync_item_totals() returns trigger language plpgsql security definer set search_path to '' as $$
declare iid uuid := coalesce(new.item_id, old.item_id);
begin
  update public.items i set qty = coalesce(t.q, 0), held = coalesce(t.h, 0), hold_for = coalesce(t.f, ''),
    status = case when coalesce(t.h, 0) > 0 then 'apart' else 'disp' end
  from (select sum(qty)::int q, sum(held)::int h, string_agg(nullif(hold_for, ''), ' · ') f from public.stock where item_id = iid) t
  where i.id = iid;
  return null;
end $$;
create trigger stock_sync after insert or update or delete on public.stock for each row execute function public.sync_item_totals();

-- Producto nuevo: su cantidad inicial queda en add_to (si es un lugar abierto) o en la bodega.
create function public.item_initial_stock() returns trigger language plpgsql security definer set search_path to '' as $$
declare p uuid;
begin
  if new.qty > 0 then
    select id into p from public.places where id = new.add_to and open;
    insert into public.stock(item_id, place_id, qty) values (new.id, coalesce(p, public.bodega_id()), new.qty);
  end if;
  return null;
end $$;
create trigger items_initial_stock after insert on public.items for each row execute function public.item_initial_stock();

-- Vendedor nuevo: si hay una sola feria abierta, queda en ella.
create function public.seller_default_place() returns trigger language plpgsql security definer set search_path to '' as $$
declare f uuid[];
begin
  if new.role = 'seller' then
    select array_agg(id) into f from public.places where kind = 'feria' and open;
    if array_length(f, 1) = 1 then insert into public.place_members values (f[1], new.user_id) on conflict do nothing; end if;
  end if;
  return null;
end $$;
create trigger members_default_place after insert on public.members for each row execute function public.seller_default_place();

-- ========== ventas, apartados y movimientos ==========
drop function public.sell_item(uuid, uuid, integer, text, timestamptz, boolean);
create function public.sell_item(p_sale_id uuid, p_item_id uuid, p_price integer, p_method text,
  p_sold_at timestamptz default now(), p_from_hold boolean default false, p_place_id uuid default null)
returns public.sales language plpgsql security definer set search_path to '' as $$
declare it public.items; st public.stock; pl public.places; s public.sales; use_hold boolean; names text[]; v_place uuid; v_stock uuid;
begin
  if not public.is_member() then raise exception 'forbidden'; end if;
  select * into s from public.sales where id = p_sale_id;
  if found then return s; end if;
  select * into it from public.items where id = p_item_id;
  if not found then raise exception 'not_found'; end if;
  v_place := coalesce(p_place_id, public.pick_place(p_item_id, 'qty'));
  if v_place is null then raise exception 'sold_out'; end if;
  select * into pl from public.places where id = v_place;
  if not found then raise exception 'not_found'; end if;
  if pl.open then
    if not public.can_use(v_place) then raise exception 'forbidden'; end if;
    v_stock := v_place;
  else
    -- venta hecha sin señal en una feria que ya se cerró: su stock volvió a la bodega
    if not public.was_in(v_place) then raise exception 'forbidden'; end if;
    v_stock := public.bodega_id();
  end if;
  select * into st from public.stock where item_id = p_item_id and place_id = v_stock for update;
  if not found or st.qty <= 0 then raise exception 'sold_out'; end if;
  if coalesce(p_price, 0) <= 0 then raise exception 'bad_price'; end if;
  if p_price < it.min_price then raise exception 'below_min'; end if;
  if p_method not in ('Efectivo','Tarjeta','Transferencia') then raise exception 'bad_method'; end if;
  use_hold := st.held > 0 and (p_from_hold or st.qty - st.held <= 0);
  names := string_to_array(nullif(st.hold_for, ''), ' · ');
  if use_hold and names is not null then names := names[2:]; end if;
  update public.stock set qty = qty - 1,
    held = case when use_hold then held - 1 else held end,
    hold_for = case when use_hold then coalesce(array_to_string(names, ' · '), '') else hold_for end,
    updated_at = now()
  where item_id = p_item_id and place_id = v_stock;
  insert into public.sales(id, item_id, name, list_price, price, method, event_name, event_started, seller_id, sold_at, place_id)
  values (p_sale_id, it.id, it.name, it.price, p_price, p_method, pl.name, pl.started_at, auth.uid(),
    least(coalesce(p_sold_at, now()), now()), v_place)
  returning * into s;
  return s;
end $$;

create or replace function public.void_sale(p_sale_id uuid) returns void
language plpgsql security definer set search_path to '' as $$
declare s public.sales; v uuid;
begin
  if not public.is_member() then raise exception 'forbidden'; end if;
  select * into s from public.sales where id = p_sale_id for update;
  if not found or s.voided then return; end if;
  if not public.is_owner() and (s.seller_id is distinct from auth.uid() or s.sold_at < now() - interval '30 minutes') then
    raise exception 'forbidden';
  end if;
  update public.sales set voided = true where id = s.id;
  if s.item_id is not null and exists(select 1 from public.items where id = s.item_id) then
    select id into v from public.places where id = s.place_id and open;
    insert into public.stock(item_id, place_id, qty) values (s.item_id, coalesce(v, public.bodega_id()), 1)
    on conflict (item_id, place_id) do update set qty = public.stock.qty + 1, updated_at = now();
  end if;
end $$;

drop function public.hold_item(uuid, text);
create function public.hold_item(p_item_id uuid, p_who text, p_place_id uuid default null) returns void
language plpgsql security definer set search_path to '' as $$
declare st public.stock; v uuid; w text := nullif(left(trim(coalesce(p_who, '')), 60), '');
begin
  if not public.is_member() then raise exception 'forbidden'; end if;
  v := coalesce(p_place_id, public.pick_place(p_item_id, 'free'));
  if v is null then raise exception 'sold_out'; end if;
  if not public.can_use(v) then
    if exists(select 1 from public.places where id = v and not open) then raise exception 'place_closed'; end if;
    raise exception 'forbidden';
  end if;
  select * into st from public.stock where item_id = p_item_id and place_id = v for update;
  if not found or st.qty - st.held <= 0 then raise exception 'sold_out'; end if;
  update public.stock set held = held + 1, updated_at = now(),
    hold_for = left(concat_ws(' · ', nullif(hold_for, ''), coalesce(w, 'sin nombre')), 240)
  where item_id = p_item_id and place_id = v;
end $$;

drop function public.release_item(uuid, text);
create function public.release_item(p_item_id uuid, p_who text default null, p_place_id uuid default null) returns void
language plpgsql security definer set search_path to '' as $$
declare st public.stock; v uuid; names text[]; k int;
begin
  if not public.is_member() then raise exception 'forbidden'; end if;
  v := coalesce(p_place_id,
    (select place_id from public.stock where item_id = p_item_id and held > 0 and public.can_use(place_id)
      and p_who is not null and position(p_who in hold_for) > 0 limit 1),
    public.pick_place(p_item_id, 'held'));
  if v is null then return; end if;
  if not public.was_in(v) then raise exception 'forbidden'; end if;
  select * into st from public.stock where item_id = p_item_id and place_id = v for update;
  if not found or st.held <= 0 then return; end if;
  names := string_to_array(nullif(st.hold_for, ''), ' · ');
  k := coalesce(array_position(names, p_who), 1);
  if names is not null and array_length(names, 1) >= k then names := names[1:k-1] || names[k+1:]; end if;
  update public.stock set held = held - 1, updated_at = now(),
    hold_for = case when held - 1 > 0 then coalesce(array_to_string(names, ' · '), '') else '' end
  where item_id = p_item_id and place_id = v;
end $$;

-- Pasar unidades libres de un lugar a otro. Idempotente por p_move_id (sirve para la cola sin señal).
create function public.move_stock(p_move_id uuid, p_item_id uuid, p_from uuid, p_to uuid, p_qty int default 1)
returns public.moves language plpgsql security definer set search_path to '' as $$
declare m public.moves; st public.stock; it public.items;
begin
  if not public.is_member() then raise exception 'forbidden'; end if;
  select * into m from public.moves where id = p_move_id;
  if found then return m; end if;
  if coalesce(p_qty, 0) < 1 or p_from = p_to then raise exception 'bad_qty'; end if;
  if not public.can_use(p_from) or not public.can_use(p_to) then raise exception 'forbidden'; end if;
  select * into it from public.items where id = p_item_id;
  if not found then raise exception 'not_found'; end if;
  perform 1 from public.stock where item_id = p_item_id and place_id in (p_from, p_to) order by place_id for update;
  select * into st from public.stock where item_id = p_item_id and place_id = p_from;
  if not found or st.qty - st.held < p_qty then raise exception 'not_enough'; end if;
  update public.stock set qty = qty - p_qty, updated_at = now() where item_id = p_item_id and place_id = p_from;
  delete from public.stock where item_id = p_item_id and place_id = p_from and qty = 0;
  insert into public.stock(item_id, place_id, qty) values (p_item_id, p_to, p_qty)
  on conflict (item_id, place_id) do update set qty = public.stock.qty + excluded.qty, updated_at = now();
  insert into public.moves(id, item_id, name, from_place, to_place, qty, user_id)
  values (p_move_id, p_item_id, it.name, p_from, p_to, p_qty, auth.uid()) returning * into m;
  return m;
end $$;

-- Dueño: fijar cuántas unidades hay de un producto en un lugar (llegaron más, se rompió una, etc.)
create function public.set_stock(p_item_id uuid, p_place_id uuid, p_qty int) returns void
language plpgsql security definer set search_path to '' as $$
declare st public.stock;
begin
  if not public.is_owner() then raise exception 'forbidden'; end if;
  if coalesce(p_qty, -1) < 0 then raise exception 'bad_qty'; end if;
  if not exists(select 1 from public.places where id = p_place_id and open) then raise exception 'place_closed'; end if;
  if not exists(select 1 from public.items where id = p_item_id) then raise exception 'not_found'; end if;
  select * into st from public.stock where item_id = p_item_id and place_id = p_place_id for update;
  if found and p_qty < st.held then raise exception 'held_units'; end if;
  if p_qty = 0 then delete from public.stock where item_id = p_item_id and place_id = p_place_id;
  else
    insert into public.stock(item_id, place_id, qty) values (p_item_id, p_place_id, p_qty)
    on conflict (item_id, place_id) do update set qty = excluded.qty, updated_at = now();
  end if;
end $$;

create function public.open_fair(p_name text, p_users uuid[] default '{}') returns public.places
language plpgsql security definer set search_path to '' as $$
declare pl public.places;
begin
  if not public.is_owner() then raise exception 'forbidden'; end if;
  insert into public.places(name, kind) values (left(coalesce(nullif(trim(p_name), ''), 'Feria ' || to_char(now(), 'DD-MM')), 80), 'feria')
  returning * into pl;
  insert into public.place_members(place_id, user_id)
    select pl.id, m.user_id from public.members m where m.user_id = any(coalesce(p_users, '{}')) and m.role = 'seller';
  return pl;
end $$;

-- Cerrar feria: lo que quedó (incluidos apartados, que se liberan) vuelve a la bodega. Las ventas quedan.
create function public.close_fair(p_place_id uuid) returns int
language plpgsql security definer set search_path to '' as $$
declare b uuid := public.bodega_id(); n int;
begin
  if not public.is_owner() then raise exception 'forbidden'; end if;
  if not exists(select 1 from public.places where id = p_place_id and kind = 'feria' and open) then raise exception 'not_found'; end if;
  update public.places set open = false, closed_at = now() where id = p_place_id;
  select coalesce(sum(qty), 0) into n from public.stock where place_id = p_place_id;
  insert into public.stock(item_id, place_id, qty)
    select item_id, b, qty from public.stock where place_id = p_place_id and qty > 0
  on conflict (item_id, place_id) do update set qty = public.stock.qty + excluded.qty, updated_at = now();
  delete from public.stock where place_id = p_place_id;
  return n;
end $$;

-- ========== permisos ==========
alter table public.places enable row level security;
alter table public.stock enable row level security;
alter table public.place_members enable row level security;
alter table public.moves enable row level security;
create policy places_read on public.places for select to authenticated using ((select public.is_member()));
create policy places_owner_update on public.places for update to authenticated using ((select public.is_owner())) with check ((select public.is_owner()));
create policy stock_read on public.stock for select to authenticated using ((select public.is_member()));
create policy pm_read on public.place_members for select to authenticated using ((select public.is_member()));
create policy pm_owner_insert on public.place_members for insert to authenticated
  with check ((select public.is_owner()) and exists(select 1 from public.places p where p.id = place_id and p.kind = 'feria'));
create policy pm_owner_delete on public.place_members for delete to authenticated using ((select public.is_owner()));
create policy moves_read on public.moves for select to authenticated using ((select public.is_member()));

revoke all on public.places, public.stock, public.place_members, public.moves from anon;
revoke insert, update, delete on public.stock, public.moves from authenticated;
revoke insert, delete on public.places from authenticated;
revoke update on public.places from authenticated;
grant update(name) on public.places to authenticated;
revoke update on public.place_members from authenticated;
-- La cantidad de un producto ya no se edita directo: va por set_stock / move_stock.
revoke update on public.items from authenticated, anon;
grant update(name, type, cond, price, min_price, tested, pitch, notes, photo_url, compatible) on public.items to authenticated;

do $$ declare f text; begin
  foreach f in array array['bodega_id()','can_use(uuid)','was_in(uuid)','pick_place(uuid,text)',
    'sell_item(uuid,uuid,integer,text,timestamptz,boolean,uuid)','void_sale(uuid)','hold_item(uuid,text,uuid)',
    'release_item(uuid,text,uuid)','move_stock(uuid,uuid,uuid,uuid,int)','set_stock(uuid,uuid,int)',
    'open_fair(text,uuid[])','close_fair(uuid)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
  foreach f in array array['sync_item_totals()','item_initial_stock()','seller_default_place()'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
  end loop;
end $$;

alter publication supabase_realtime add table public.places, public.stock, public.place_members;

-- ========== datos: todo lo de hoy queda en la feria abierta ==========
insert into public.places(name, kind, open, started_at) values ('Bodega', 'bodega', true, now());
insert into public.places(name, kind, open, started_at)
  select event_name, 'feria', true, event_started from public.settings where id = 1;
insert into public.stock(item_id, place_id, qty, held, hold_for)
  select i.id, (select id from public.places where kind = 'feria' limit 1), i.qty, least(i.held, i.qty),
    case when i.held > 0 then i.hold_for else '' end
  from public.items i where i.qty > 0;
update public.sales set place_id = (select id from public.places where kind = 'feria' limit 1) where place_id is null;
insert into public.place_members(place_id, user_id)
  select (select id from public.places where kind = 'feria' limit 1), user_id from public.members where role = 'seller';
