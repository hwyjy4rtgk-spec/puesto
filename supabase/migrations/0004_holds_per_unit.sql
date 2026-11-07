-- Apartados por unidad (aplicada en el proyecto). Ver migración 'holds_per_unit' en Supabase.
-- items.held = unidades apartadas; hold_item/release_item/sell_item trabajan de a una unidad.
alter table public.items add column if not exists held int not null default 0;
