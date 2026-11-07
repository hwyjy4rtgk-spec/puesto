-- Accesorios y otros productos del negocio (rollos, baterías, cargadores, memorias, fundas, lentes...).
alter table public.items add column if not exists compatible text not null default '';
alter table public.items add column if not exists category text generated always as (
  case when type in ('Réflex','Compacta','Telemétrica','Formato medio','Instantánea','Digital') then 'Cámara' else 'Accesorio' end
) stored;
create index if not exists items_category_idx on public.items(category);
