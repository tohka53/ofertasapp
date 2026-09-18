-- =============================================================================
-- ComparAhorro (ofertasapp)
-- Esquema de base de datos, seguridad a nivel de fila y mantenimiento automático
--
-- Proyecto Supabase : ofertasgt (bvuwwdpwvfkhyowhflta) · us-east-1
-- Autor             : Miguel Eduardo Cabrera Girón
-- Fecha             : 2026-09-18
-- Versión           : 1.0.0
--
-- Contenido : perfiles de usuario, grupos familiares, listas de compras
--             compartidas, artículos de lista, invitaciones por correo,
--             políticas RLS y purga automática de listas con más de tres
--             meses de antigüedad respecto al periodo de la lista.
--
-- Ejecución : Supabase Dashboard → SQL Editor → New query → pegar y Run.
--             El script es idempotente: se puede volver a ejecutar completo.
-- =============================================================================

set search_path = public;

create or replace function public.fecha_purga(p_year integer, p_month integer)
returns date
language sql
immutable
as $fn$
  select (make_date(p_year, p_month, 1) + interval '4 months')::date;
$fn$;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text not null default '',
  lang text not null default 'es' check (lang in ('es', 'en')),
  country_code text,
  state_code text,
  store_ids text[] not null default '{}'::text[],
  location jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists profiles_email_lower_idx on public.profiles (lower(email));

create table if not exists public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 60),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists families_owner_idx on public.families (owner_id);

create table if not exists public.family_members (
  family_id uuid not null references public.families (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'member' check (role in ('admin', 'member')),
  joined_at timestamptz not null default now(),
  primary key (family_id, user_id)
);

create index if not exists family_members_user_idx on public.family_members (user_id);

create table if not exists public.shopping_lists (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 60),
  month integer not null check (month between 1 and 12),
  year integer not null check (year between 2024 and 2100),
  country_code text not null check (char_length(country_code) between 2 and 3),
  currency text not null check (char_length(currency) = 3),
  currency_symbol text not null default '',
  owner_id uuid not null references public.profiles (id) on delete cascade,
  family_id uuid references public.families (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  purge_at date generated always as (public.fecha_purga(year, month)) stored
);

create index if not exists shopping_lists_owner_idx on public.shopping_lists (owner_id);
create index if not exists shopping_lists_family_idx on public.shopping_lists (family_id);
create index if not exists shopping_lists_purge_idx on public.shopping_lists (purge_at);

create table if not exists public.list_members (
  list_id uuid not null references public.shopping_lists (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'editor' check (role in ('admin', 'editor')),
  added_at timestamptz not null default now(),
  primary key (list_id, user_id)
);

create index if not exists list_members_user_idx on public.list_members (user_id);

create table if not exists public.list_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.shopping_lists (id) on delete cascade,
  product_query text not null check (char_length(btrim(product_query)) between 1 and 160),
  desired_presentation text,
  quantity integer not null default 1 check (quantity between 1 and 999),
  purchased boolean not null default false,
  offer jsonb,
  added_by uuid references public.profiles (id) on delete set null,
  added_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists list_items_list_idx on public.list_items (list_id);

create table if not exists public.invitations (
  id uuid primary key default gen_random_uuid(),
  token uuid not null unique default gen_random_uuid(),
  email text not null check (position('@' in email) > 1),
  list_id uuid references public.shopping_lists (id) on delete cascade,
  family_id uuid references public.families (id) on delete cascade,
  role text not null default 'editor' check (role in ('admin', 'editor', 'member')),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'revoked')),
  invited_by uuid not null references public.profiles (id) on delete cascade,
  accepted_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  expires_at timestamptz not null default now() + interval '30 days',
  constraint invitations_un_destino check (num_nonnulls(list_id, family_id) = 1)
);

create unique index if not exists invitations_pendiente_idx
  on public.invitations (coalesce(list_id, family_id), lower(email))
  where status = 'pending';

create index if not exists invitations_email_idx on public.invitations (lower(email)) where status = 'pending';
create index if not exists invitations_invited_by_idx on public.invitations (invited_by);

create table if not exists public.maintenance_log (
  id bigint generated always as identity primary key,
  task text not null,
  detail jsonb not null default '{}'::jsonb,
  ran_at timestamptz not null default now()
);

create or replace function public.es_miembro_familia(p_family uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $fn$
  select auth.uid() is not null
     and exists (select 1 from family_members m where m.family_id = p_family and m.user_id = auth.uid());
$fn$;

create or replace function public.es_admin_familia(p_family uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $fn$
  select auth.uid() is not null
     and exists (
       select 1 from family_members m
        where m.family_id = p_family and m.user_id = auth.uid() and m.role = 'admin'
     );
$fn$;

create or replace function public.puede_ver_lista(p_list uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $fn$
  select auth.uid() is not null
     and exists (
       select 1
         from shopping_lists l
         left join list_members m on m.list_id = l.id and m.user_id = auth.uid()
        where l.id = p_list
          and (
            m.user_id is not null
            or l.owner_id = auth.uid()
            or (l.family_id is not null and exists (
                  select 1 from family_members fm
                   where fm.family_id = l.family_id and fm.user_id = auth.uid()
               ))
          )
     );
$fn$;

create or replace function public.es_admin_lista(p_list uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $fn$
  select auth.uid() is not null
     and exists (
       select 1
         from shopping_lists l
         left join list_members m on m.list_id = l.id and m.user_id = auth.uid() and m.role = 'admin'
        where l.id = p_list and (l.owner_id = auth.uid() or m.user_id is not null)
     );
$fn$;

create or replace function public.comparte_contexto(p_other uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $fn$
  select auth.uid() is not null
     and (
       p_other = auth.uid()
       or exists (
            select 1 from list_members a
              join list_members b on b.list_id = a.list_id
             where a.user_id = auth.uid() and b.user_id = p_other
          )
       or exists (
            select 1 from family_members a
              join family_members b on b.family_id = a.family_id
             where a.user_id = auth.uid() and b.user_id = p_other
          )
       or exists (
            select 1 from invitations i
             where i.invited_by = p_other
               and i.status = 'pending'
               and lower(i.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
          )
     );
$fn$;

create or replace function public.correo_actual()
returns text
language sql
stable
as $fn$
  select lower(coalesce(auth.jwt() ->> 'email', ''));
$fn$;

create or replace function public.tocar_actualizado()
returns trigger
language plpgsql
as $fn$
begin
  new.updated_at := now();
  return new;
end;
$fn$;

create or replace function public.tocar_lista_por_item()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  update shopping_lists set updated_at = now() where id = coalesce(new.list_id, old.list_id);
  return coalesce(new, old);
end;
$fn$;

create or replace function public.alta_miembro_propietario_lista()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  insert into list_members (list_id, user_id, role)
  values (new.id, new.owner_id, 'admin')
  on conflict (list_id, user_id) do update set role = 'admin';
  return new;
end;
$fn$;

create or replace function public.alta_miembro_propietario_familia()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  insert into family_members (family_id, user_id, role)
  values (new.id, new.owner_id, 'admin')
  on conflict (family_id, user_id) do update set role = 'admin';
  return new;
end;
$fn$;

create or replace function public.manejar_usuario_nuevo()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(new.email, '@', 1))
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = case when public.profiles.full_name = '' then excluded.full_name else public.profiles.full_name end;
  return new;
end;
$fn$;

create or replace function public.sincronizar_correo_usuario()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if new.email is distinct from old.email then
    update public.profiles set email = new.email, updated_at = now() where id = new.id;
  end if;
  return new;
end;
$fn$;

drop trigger if exists profiles_actualizado on public.profiles;
create trigger profiles_actualizado before update on public.profiles
for each row execute function public.tocar_actualizado();

drop trigger if exists families_actualizado on public.families;
create trigger families_actualizado before update on public.families
for each row execute function public.tocar_actualizado();

drop trigger if exists shopping_lists_actualizado on public.shopping_lists;
create trigger shopping_lists_actualizado before update on public.shopping_lists
for each row execute function public.tocar_actualizado();

drop trigger if exists list_items_actualizado on public.list_items;
create trigger list_items_actualizado before update on public.list_items
for each row execute function public.tocar_actualizado();

drop trigger if exists list_items_tocan_lista on public.list_items;
create trigger list_items_tocan_lista after insert or update or delete on public.list_items
for each row execute function public.tocar_lista_por_item();

drop trigger if exists shopping_lists_propietario on public.shopping_lists;
create trigger shopping_lists_propietario after insert on public.shopping_lists
for each row execute function public.alta_miembro_propietario_lista();

drop trigger if exists families_propietario on public.families;
create trigger families_propietario after insert on public.families
for each row execute function public.alta_miembro_propietario_familia();

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.manejar_usuario_nuevo();

drop trigger if exists on_auth_user_email_updated on auth.users;
create trigger on_auth_user_email_updated after update of email on auth.users
for each row execute function public.sincronizar_correo_usuario();

insert into public.profiles (id, email, full_name)
select u.id, u.email, coalesce(nullif(btrim(u.raw_user_meta_data ->> 'full_name'), ''), split_part(u.email, '@', 1))
  from auth.users u
 where u.email is not null
on conflict (id) do nothing;

alter table public.profiles enable row level security;
alter table public.families enable row level security;
alter table public.family_members enable row level security;
alter table public.shopping_lists enable row level security;
alter table public.list_members enable row level security;
alter table public.list_items enable row level security;
alter table public.invitations enable row level security;
alter table public.maintenance_log enable row level security;

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
for select to authenticated
using (id = auth.uid() or public.comparte_contexto(id));

drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles
for insert to authenticated
with check (id = auth.uid());

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
for update to authenticated
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists families_select on public.families;
create policy families_select on public.families
for select to authenticated
using (public.es_miembro_familia(id));

drop policy if exists families_insert on public.families;
create policy families_insert on public.families
for insert to authenticated
with check (owner_id = auth.uid());

drop policy if exists families_update on public.families;
create policy families_update on public.families
for update to authenticated
using (public.es_admin_familia(id))
with check (public.es_admin_familia(id));

drop policy if exists families_delete on public.families;
create policy families_delete on public.families
for delete to authenticated
using (owner_id = auth.uid());

drop policy if exists family_members_select on public.family_members;
create policy family_members_select on public.family_members
for select to authenticated
using (public.es_miembro_familia(family_id));

drop policy if exists family_members_insert on public.family_members;
create policy family_members_insert on public.family_members
for insert to authenticated
with check (public.es_admin_familia(family_id));

drop policy if exists family_members_update on public.family_members;
create policy family_members_update on public.family_members
for update to authenticated
using (public.es_admin_familia(family_id))
with check (public.es_admin_familia(family_id));

drop policy if exists family_members_delete on public.family_members;
create policy family_members_delete on public.family_members
for delete to authenticated
using (public.es_admin_familia(family_id) or user_id = auth.uid());

drop policy if exists shopping_lists_select on public.shopping_lists;
create policy shopping_lists_select on public.shopping_lists
for select to authenticated
using (purge_at > current_date and public.puede_ver_lista(id));

drop policy if exists shopping_lists_insert on public.shopping_lists;
create policy shopping_lists_insert on public.shopping_lists
for insert to authenticated
with check (
  owner_id = auth.uid()
  and (family_id is null or public.es_miembro_familia(family_id))
);

drop policy if exists shopping_lists_update on public.shopping_lists;
create policy shopping_lists_update on public.shopping_lists
for update to authenticated
using (public.es_admin_lista(id))
with check (
  public.es_admin_lista(id)
  and (family_id is null or public.es_miembro_familia(family_id))
);

drop policy if exists shopping_lists_delete on public.shopping_lists;
create policy shopping_lists_delete on public.shopping_lists
for delete to authenticated
using (public.es_admin_lista(id));

drop policy if exists list_members_select on public.list_members;
create policy list_members_select on public.list_members
for select to authenticated
using (public.puede_ver_lista(list_id));

drop policy if exists list_members_insert on public.list_members;
create policy list_members_insert on public.list_members
for insert to authenticated
with check (public.es_admin_lista(list_id));

drop policy if exists list_members_update on public.list_members;
create policy list_members_update on public.list_members
for update to authenticated
using (public.es_admin_lista(list_id))
with check (public.es_admin_lista(list_id));

drop policy if exists list_members_delete on public.list_members;
create policy list_members_delete on public.list_members
for delete to authenticated
using (public.es_admin_lista(list_id) or user_id = auth.uid());

drop policy if exists list_items_select on public.list_items;
create policy list_items_select on public.list_items
for select to authenticated
using (public.puede_ver_lista(list_id));

drop policy if exists list_items_insert on public.list_items;
create policy list_items_insert on public.list_items
for insert to authenticated
with check (public.puede_ver_lista(list_id) and (added_by is null or added_by = auth.uid()));

drop policy if exists list_items_update on public.list_items;
create policy list_items_update on public.list_items
for update to authenticated
using (public.puede_ver_lista(list_id))
with check (public.puede_ver_lista(list_id));

drop policy if exists list_items_delete on public.list_items;
create policy list_items_delete on public.list_items
for delete to authenticated
using (public.puede_ver_lista(list_id));

drop policy if exists invitations_select on public.invitations;
create policy invitations_select on public.invitations
for select to authenticated
using (invited_by = auth.uid() or lower(email) = public.correo_actual());

drop policy if exists invitations_insert on public.invitations;
create policy invitations_insert on public.invitations
for insert to authenticated
with check (
  invited_by = auth.uid()
  and (
    (list_id is not null and public.es_admin_lista(list_id))
    or (family_id is not null and public.es_admin_familia(family_id))
  )
);

drop policy if exists invitations_update on public.invitations;
create policy invitations_update on public.invitations
for update to authenticated
using (invited_by = auth.uid())
with check (invited_by = auth.uid());

drop policy if exists invitations_delete on public.invitations;
create policy invitations_delete on public.invitations
for delete to authenticated
using (invited_by = auth.uid());

create or replace function public.crear_invitacion(
  p_list uuid,
  p_family uuid,
  p_email text,
  p_role text
)
returns public.invitations
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_email text := lower(btrim(p_email));
  v_role text;
  v_inv public.invitations;
begin
  if auth.uid() is null then
    raise exception 'sin_sesion' using errcode = '42501';
  end if;

  if num_nonnulls(p_list, p_family) <> 1 then
    raise exception 'destino_invalido' using errcode = '22023';
  end if;

  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'correo_invalido' using errcode = '22023';
  end if;

  if v_email = public.correo_actual() then
    raise exception 'correo_propio' using errcode = '22023';
  end if;

  if p_list is not null then
    if not public.es_admin_lista(p_list) then
      raise exception 'no_autorizado' using errcode = '42501';
    end if;
    v_role := case when p_role = 'admin' then 'admin' else 'editor' end;
    if exists (
      select 1 from list_members m join profiles p on p.id = m.user_id
       where m.list_id = p_list and lower(p.email) = v_email
    ) then
      raise exception 'ya_es_miembro' using errcode = '22023';
    end if;
  else
    if not public.es_admin_familia(p_family) then
      raise exception 'no_autorizado' using errcode = '42501';
    end if;
    v_role := case when p_role = 'admin' then 'admin' else 'member' end;
    if exists (
      select 1 from family_members m join profiles p on p.id = m.user_id
       where m.family_id = p_family and lower(p.email) = v_email
    ) then
      raise exception 'ya_es_miembro' using errcode = '22023';
    end if;
  end if;

  update invitations
     set status = 'revoked', responded_at = now()
   where status = 'pending'
     and expires_at <= now()
     and lower(email) = v_email
     and coalesce(list_id, family_id) = coalesce(p_list, p_family);

  insert into invitations (email, list_id, family_id, role, invited_by)
  values (v_email, p_list, p_family, v_role, auth.uid())
  on conflict do nothing
  returning * into v_inv;

  if v_inv.id is null then
    select * into v_inv
      from invitations
     where status = 'pending'
       and lower(email) = v_email
       and coalesce(list_id, family_id) = coalesce(p_list, p_family)
     limit 1;
  end if;

  return v_inv;
end;
$fn$;

create or replace function public.mis_invitaciones()
returns table (
  id uuid,
  token uuid,
  contexto text,
  contexto_id uuid,
  contexto_nombre text,
  rol text,
  invitado_por text,
  creada_en timestamptz,
  vence_en timestamptz
)
language sql
security definer
stable
set search_path = public
as $fn$
  select i.id,
         i.token,
         case when i.list_id is not null then 'lista' else 'familia' end,
         coalesce(i.list_id, i.family_id),
         coalesce(l.name, f.name, ''),
         i.role,
         coalesce(nullif(btrim(p.full_name), ''), p.email, ''),
         i.created_at,
         i.expires_at
    from invitations i
    left join shopping_lists l on l.id = i.list_id
    left join families f on f.id = i.family_id
    left join profiles p on p.id = i.invited_by
   where i.status = 'pending'
     and i.expires_at > now()
     and lower(i.email) = public.correo_actual()
   order by i.created_at desc;
$fn$;

create or replace function public.ver_invitacion(p_token uuid)
returns table (
  token uuid,
  contexto text,
  contexto_nombre text,
  rol text,
  invitado_por text,
  correo text,
  estado text,
  vence_en timestamptz,
  es_para_mi boolean
)
language sql
security definer
stable
set search_path = public
as $fn$
  select i.token,
         case when i.list_id is not null then 'lista' else 'familia' end,
         coalesce(l.name, f.name, ''),
         i.role,
         coalesce(nullif(btrim(p.full_name), ''), p.email, ''),
         i.email,
         case when i.status = 'pending' and i.expires_at <= now() then 'expired' else i.status end,
         i.expires_at,
         lower(i.email) = public.correo_actual()
    from invitations i
    left join shopping_lists l on l.id = i.list_id
    left join families f on f.id = i.family_id
    left join profiles p on p.id = i.invited_by
   where i.token = p_token;
$fn$;

create or replace function public.aceptar_invitacion(p_token uuid)
returns public.invitations
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_inv public.invitations;
begin
  if auth.uid() is null then
    raise exception 'sin_sesion' using errcode = '42501';
  end if;

  select * into v_inv from invitations where token = p_token for update;

  if v_inv.id is null then
    raise exception 'invitacion_no_encontrada' using errcode = 'P0002';
  end if;

  if lower(v_inv.email) <> public.correo_actual() then
    raise exception 'invitacion_de_otro_correo' using errcode = '42501';
  end if;

  if v_inv.status <> 'pending' then
    raise exception 'invitacion_no_vigente' using errcode = '22023';
  end if;

  if v_inv.expires_at <= now() then
    update invitations set status = 'revoked', responded_at = now() where id = v_inv.id;
    raise exception 'invitacion_vencida' using errcode = '22023';
  end if;

  if v_inv.list_id is not null then
    insert into list_members (list_id, user_id, role)
    values (v_inv.list_id, auth.uid(), case when v_inv.role = 'admin' then 'admin' else 'editor' end)
    on conflict (list_id, user_id) do nothing;
  else
    insert into family_members (family_id, user_id, role)
    values (v_inv.family_id, auth.uid(), case when v_inv.role = 'admin' then 'admin' else 'member' end)
    on conflict (family_id, user_id) do nothing;
  end if;

  update invitations
     set status = 'accepted', accepted_by = auth.uid(), responded_at = now()
   where id = v_inv.id
  returning * into v_inv;

  return v_inv;
end;
$fn$;

create or replace function public.rechazar_invitacion(p_token uuid)
returns public.invitations
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_inv public.invitations;
begin
  if auth.uid() is null then
    raise exception 'sin_sesion' using errcode = '42501';
  end if;

  update invitations
     set status = 'rejected', responded_at = now()
   where token = p_token
     and status = 'pending'
     and lower(email) = public.correo_actual()
  returning * into v_inv;

  if v_inv.id is null then
    raise exception 'invitacion_no_encontrada' using errcode = 'P0002';
  end if;

  return v_inv;
end;
$fn$;

create or replace function public.miembros_de_lista(p_list uuid)
returns table (
  user_id uuid,
  email text,
  nombre text,
  rol text,
  es_propietario boolean,
  desde timestamptz
)
language sql
security definer
stable
set search_path = public
as $fn$
  select m.user_id,
         p.email,
         coalesce(nullif(btrim(p.full_name), ''), split_part(p.email, '@', 1)),
         m.role,
         l.owner_id = m.user_id,
         m.added_at
    from list_members m
    join shopping_lists l on l.id = m.list_id
    join profiles p on p.id = m.user_id
   where m.list_id = p_list
     and public.puede_ver_lista(p_list)
   order by (l.owner_id = m.user_id) desc, m.added_at;
$fn$;

create or replace function public.miembros_de_familia(p_family uuid)
returns table (
  user_id uuid,
  email text,
  nombre text,
  rol text,
  es_propietario boolean,
  desde timestamptz
)
language sql
security definer
stable
set search_path = public
as $fn$
  select m.user_id,
         p.email,
         coalesce(nullif(btrim(p.full_name), ''), split_part(p.email, '@', 1)),
         m.role,
         f.owner_id = m.user_id,
         m.joined_at
    from family_members m
    join families f on f.id = m.family_id
    join profiles p on p.id = m.user_id
   where m.family_id = p_family
     and public.es_miembro_familia(p_family)
   order by (f.owner_id = m.user_id) desc, m.joined_at;
$fn$;

create or replace function public.purgar_listas_vencidas()
returns integer
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_listas integer := 0;
  v_invitaciones integer := 0;
begin
  with borradas as (
    delete from shopping_lists where purge_at <= current_date returning 1
  )
  select count(*) into v_listas from borradas;

  with vencidas as (
    update invitations
       set status = 'revoked', responded_at = now()
     where status = 'pending' and expires_at <= now()
    returning 1
  )
  select count(*) into v_invitaciones from vencidas;

  delete from invitations
   where status <> 'pending'
     and coalesce(responded_at, created_at) < now() - interval '90 days';

  insert into maintenance_log (task, detail)
  values (
    'purgar_listas_vencidas',
    jsonb_build_object('listas_borradas', v_listas, 'invitaciones_vencidas', v_invitaciones)
  );

  return v_listas;
end;
$fn$;

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on table
  public.profiles,
  public.families,
  public.family_members,
  public.shopping_lists,
  public.list_members,
  public.list_items,
  public.invitations
to authenticated;

revoke all on table public.maintenance_log from anon, authenticated;

grant execute on function
  public.crear_invitacion(uuid, uuid, text, text),
  public.aceptar_invitacion(uuid),
  public.rechazar_invitacion(uuid),
  public.mis_invitaciones(),
  public.ver_invitacion(uuid),
  public.miembros_de_lista(uuid),
  public.miembros_de_familia(uuid),
  public.es_miembro_familia(uuid),
  public.es_admin_familia(uuid),
  public.puede_ver_lista(uuid),
  public.es_admin_lista(uuid),
  public.comparte_contexto(uuid),
  public.correo_actual(),
  public.fecha_purga(integer, integer)
to authenticated;

revoke execute on function public.purgar_listas_vencidas() from public, anon, authenticated;

alter table public.shopping_lists replica identity full;
alter table public.list_items replica identity full;
alter table public.list_members replica identity full;
alter table public.invitations replica identity full;

do $blk$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'shopping_lists'
    ) then
      alter publication supabase_realtime add table public.shopping_lists;
    end if;
    if not exists (
      select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'list_items'
    ) then
      alter publication supabase_realtime add table public.list_items;
    end if;
    if not exists (
      select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'list_members'
    ) then
      alter publication supabase_realtime add table public.list_members;
    end if;
    if not exists (
      select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'invitations'
    ) then
      alter publication supabase_realtime add table public.invitations;
    end if;
  end if;
end;
$blk$;

do $blk$
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    begin
      execute 'create extension pg_cron';
    exception when others then
      begin
        execute 'create extension pg_cron with schema pg_catalog';
      exception when others then
        raise notice 'pg_cron no se pudo habilitar (%). Activalo en Database > Extensions y volve a ejecutar este bloque.', sqlerrm;
      end;
    end;
  end if;
end;
$blk$;

do $blk$
begin
  if to_regprocedure('cron.schedule(text,text,text)') is not null then
    if exists (select 1 from cron.job where jobname = 'purgar-listas-vencidas') then
      perform cron.unschedule('purgar-listas-vencidas');
    end if;
    perform cron.schedule('purgar-listas-vencidas', '0 7 * * *', 'select public.purgar_listas_vencidas();');
  else
    raise notice 'pg_cron no disponible: la purga automatica no quedo programada.';
  end if;
end;
$blk$;

select public.purgar_listas_vencidas() as listas_borradas_ahora;
