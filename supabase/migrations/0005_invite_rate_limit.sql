-- Aplicada vía MCP como "invite_rate_limit".
-- auth_attempts (RLS sin políticas: solo funciones definer / service role),
-- join_store devuelve 'err:bad_code' | 'err:too_many' (5 fallos / 15 min por usuario) en vez de lanzar error,
-- rotate_invite_code genera 8 caracteres sin 0/O/1/I/L. El código vigente de 6 sigue válido hasta rotarlo.
create table if not exists public.auth_attempts(id bigserial primary key, kind text not null, key text not null, ok boolean not null default false, at timestamptz not null default now());
create index if not exists auth_attempts_k on public.auth_attempts(kind,key,at desc);
alter table public.auth_attempts enable row level security;
revoke all on public.auth_attempts from anon, authenticated;
create or replace function public.join_store(p_code text, p_name text default '')
returns text language plpgsql security definer set search_path to '' as $$
declare v_role text; v_key text := auth.uid()::text; v_fails int;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  select role into v_role from public.members where user_id = auth.uid();
  if v_role is not null then return v_role; end if;
  delete from public.auth_attempts where at < now() - interval '1 day';
  select count(*) into v_fails from public.auth_attempts
   where kind='join' and key=v_key and not ok and at > now() - interval '15 minutes';
  if v_fails >= 5 then return 'err:too_many'; end if;
  if not exists(select 1 from public.secrets where invite_code = upper(trim(p_code))) then
    insert into public.auth_attempts(kind,key,ok) values ('join',v_key,false);
    return 'err:bad_code';
  end if;
  insert into public.members(user_id, role, name) values (auth.uid(), 'seller', coalesce(p_name,''));
  return 'seller';
end $$;
create or replace function public.rotate_invite_code()
returns text language plpgsql security definer set search_path to '' as $$
declare a text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; b bytea := extensions.gen_random_bytes(8); v text := ''; i int;
begin
  if not public.is_owner() then raise exception 'forbidden'; end if;
  for i in 0..7 loop v := v || substr(a, 1 + (get_byte(b,i) % length(a)), 1); end loop;
  update public.secrets set invite_code = v where id = 1;
  return v;
end $$;
revoke all on function public.join_store(text,text) from public, anon;
grant execute on function public.join_store(text,text) to authenticated;
revoke all on function public.rotate_invite_code() from public, anon;
grant execute on function public.rotate_invite_code() to authenticated;
