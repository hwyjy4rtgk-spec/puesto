-- Ya aplicada en el proyecto Supabase "puesto" (apilqdurybxthqmozyrh).
-- Se guarda aquí como referencia y para recrear la base en otro proyecto.
create extension if not exists pgcrypto with schema extensions;

create table public.members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','seller')),
  name text not null default '',
  created_at timestamptz not null default now()
);
create table public.settings (
  id int primary key default 1 check (id = 1),
  event_name text not null default 'Mi primer evento',
  event_started timestamptz not null default now()
);
insert into public.settings default values;
create table public.secrets (
  id int primary key default 1 check (id = 1),
  invite_code text not null
);
insert into public.secrets (invite_code) values (upper(substr(md5(gen_random_uuid()::text),1,6)));
create table public.items (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  type text not null default 'Réflex',
  cond text not null default 'Muy buena',
  price int not null check (price > 0),
  min_price int not null check (min_price > 0),
  qty int not null default 1 check (qty >= 0),
  tested text[] not null default '{}',
  pitch text not null default '',
  notes text not null default '',
  photo_url text not null default '',
  status text not null default 'disp' check (status in ('disp','apart')),
  hold_for text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint min_le_price check (min_price <= price)
);
create table public.sales (
  id uuid primary key,
  item_id uuid references public.items(id) on delete set null,
  name text not null,
  list_price int not null,
  price int not null,
  method text not null check (method in ('Efectivo','Tarjeta','Transferencia')),
  event_name text not null,
  event_started timestamptz not null,
  voided boolean not null default false,
  seller_id uuid references auth.users(id) on delete set null,
  sold_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index sales_event_idx on public.sales (event_started, sold_at);
create index sales_item_idx on public.sales (item_id);
create index sales_seller_idx on public.sales (seller_id);

create or replace function public.is_member() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.members where user_id = (select auth.uid()));
$$;
create or replace function public.is_owner() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.members where user_id = (select auth.uid()) and role = 'owner');
$$;
create or replace function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end $$;
create trigger items_touch before update on public.items for each row execute function public.touch_updated_at();

alter table public.members enable row level security;
alter table public.settings enable row level security;
alter table public.secrets enable row level security;
alter table public.items enable row level security;
alter table public.sales enable row level security;

create policy members_read on public.members for select to authenticated using ((select public.is_member()));
create policy members_owner_delete on public.members for delete to authenticated using ((select public.is_owner()) and user_id <> (select auth.uid()));
create policy settings_read on public.settings for select to authenticated using ((select public.is_member()));
create policy settings_owner_update on public.settings for update to authenticated using ((select public.is_owner())) with check ((select public.is_owner()));
create policy secrets_owner_read on public.secrets for select to authenticated using ((select public.is_owner()));
create policy items_read on public.items for select to authenticated using ((select public.is_member()));
create policy items_owner_insert on public.items for insert to authenticated with check ((select public.is_owner()));
create policy items_owner_update on public.items for update to authenticated using ((select public.is_owner())) with check ((select public.is_owner()));
create policy items_owner_delete on public.items for delete to authenticated using ((select public.is_owner()));
create policy sales_read on public.sales for select to authenticated using ((select public.is_member()));

create or replace function public.claim_owner(p_name text default '') returns text
language plpgsql security definer set search_path = '' as $$
declare v_role text;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  select role into v_role from public.members where user_id = auth.uid();
  if v_role is not null then return v_role; end if;
  perform pg_advisory_xact_lock(424242);
  if exists(select 1 from public.members where role = 'owner') then return 'none'; end if;
  insert into public.members(user_id, role, name) values (auth.uid(), 'owner', coalesce(p_name,''));
  return 'owner';
end $$;
create or replace function public.join_store(p_code text, p_name text default '') returns text
language plpgsql security definer set search_path = '' as $$
declare v_role text;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  select role into v_role from public.members where user_id = auth.uid();
  if v_role is not null then return v_role; end if;
  if not exists(select 1 from public.secrets where invite_code = upper(trim(p_code))) then raise exception 'bad_code'; end if;
  insert into public.members(user_id, role, name) values (auth.uid(), 'seller', coalesce(p_name,''));
  return 'seller';
end $$;
create or replace function public.rotate_invite_code() returns text
language plpgsql security definer set search_path = '' as $$
declare v text := upper(substr(md5(gen_random_uuid()::text),1,6));
begin
  if not public.is_owner() then raise exception 'forbidden'; end if;
  update public.secrets set invite_code = v where id = 1;
  return v;
end $$;
create or replace function public.sell_item(p_sale_id uuid, p_item_id uuid, p_price int, p_method text, p_sold_at timestamptz default now())
returns public.sales language plpgsql security definer set search_path = '' as $$
declare it public.items; st public.settings; s public.sales;
begin
  if not public.is_member() then raise exception 'forbidden'; end if;
  select * into s from public.sales where id = p_sale_id;
  if found then return s; end if;
  select * into it from public.items where id = p_item_id for update;
  if not found then raise exception 'not_found'; end if;
  if it.qty <= 0 then raise exception 'sold_out'; end if;
  if p_price < it.min_price then raise exception 'below_min'; end if;
  if p_method not in ('Efectivo','Tarjeta','Transferencia') then raise exception 'bad_method'; end if;
  select * into st from public.settings where id = 1;
  update public.items set qty = qty - 1, status = 'disp', hold_for = '' where id = it.id;
  insert into public.sales(id, item_id, name, list_price, price, method, event_name, event_started, seller_id, sold_at)
  values (p_sale_id, it.id, it.name, it.price, p_price, p_method, st.event_name, st.event_started, auth.uid(), least(coalesce(p_sold_at, now()), now()))
  returning * into s;
  return s;
end $$;
create or replace function public.void_sale(p_sale_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare s public.sales;
begin
  if not public.is_member() then raise exception 'forbidden'; end if;
  select * into s from public.sales where id = p_sale_id for update;
  if not found or s.voided then return; end if;
  if not public.is_owner() and (s.seller_id is distinct from auth.uid() or s.sold_at < now() - interval '30 minutes') then raise exception 'forbidden'; end if;
  update public.sales set voided = true where id = s.id;
  if s.item_id is not null then update public.items set qty = qty + 1 where id = s.item_id; end if;
end $$;
create or replace function public.hold_item(p_item_id uuid, p_who text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_member() then raise exception 'forbidden'; end if;
  update public.items set status = 'apart', hold_for = left(coalesce(p_who,''),120) where id = p_item_id and qty > 0;
  if not found then raise exception 'sold_out'; end if;
end $$;
create or replace function public.release_item(p_item_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_member() then raise exception 'forbidden'; end if;
  update public.items set status = 'disp', hold_for = '' where id = p_item_id;
end $$;
create or replace function public.start_event(p_name text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_owner() then raise exception 'forbidden'; end if;
  update public.settings set event_name = coalesce(nullif(trim(p_name),''),'Evento ' || to_char(now(),'DD-MM-YYYY')), event_started = now() where id = 1;
end $$;

revoke execute on all functions in schema public from public, anon;
grant execute on function public.is_member(), public.is_owner(), public.claim_owner(text), public.join_store(text,text),
  public.rotate_invite_code(), public.sell_item(uuid,uuid,int,text,timestamptz), public.void_sale(uuid),
  public.hold_item(uuid,text), public.release_item(uuid), public.start_event(text) to authenticated;

alter publication supabase_realtime add table public.items, public.sales, public.settings, public.members;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos','fotos', true, 2097152, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
create policy fotos_owner_insert on storage.objects for insert to authenticated with check (bucket_id = 'fotos' and (select public.is_owner()));
create policy fotos_owner_delete on storage.objects for delete to authenticated using (bucket_id = 'fotos' and (select public.is_owner()));
