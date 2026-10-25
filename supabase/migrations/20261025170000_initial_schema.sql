-- Initial schema: profiles, projects, user catalog items, purchase marks, storage buckets.
-- Every table has RLS: a user reads and writes only their own rows.

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  business_name text not null default '',
  vat_number text not null default '',
  address text not null default '',
  phone text not null default '',
  email text not null default '',
  logo_path text,
  price_overrides jsonb not null default '{}'::jsonb,
  box_presets jsonb not null default '[]'::jsonb,
  quote_counter integer not null default 0,
  updated_at timestamptz not null default now()
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  client_name text not null default '',
  address text not null default '',
  settings jsonb not null,
  quote jsonb not null,
  doc jsonb not null,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index projects_owner_idx on public.projects (owner_id, updated_at desc);

create table public.catalog_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  category text not null check (
    category in ('device', 'blanking_cover', 'plate', 'box', 'junction_box', 'conduit', 'cable',
                 'panel_device', 'enclosure')
  ),
  name text not null,
  code text,
  unit_price integer check (unit_price >= 0), -- cents
  unit text not null check (unit in ('pcs', 'm')),
  modules integer check (modules > 0),
  attributes jsonb not null default '{}'::jsonb,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index catalog_items_owner_idx on public.catalog_items (owner_id);

-- Phone ticks live here, apart from the doc, so they never conflict with editor saves.
create table public.purchase_marks (
  project_id uuid not null references public.projects (id) on delete cascade,
  line_key text not null,
  purchased_qty numeric check (purchased_qty >= 0), -- null = not bought
  updated_at timestamptz not null default now(),
  primary key (project_id, line_key)
);

-- updated_at maintenance
create function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();
create trigger catalog_items_touch before update on public.catalog_items
  for each row execute function public.touch_updated_at();
create trigger purchase_marks_touch before update on public.purchase_marks
  for each row execute function public.touch_updated_at();

-- A profile row per new user.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (user_id, email) values (new.id, coalesce(new.email, ''));
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- RLS
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.catalog_items enable row level security;
alter table public.purchase_marks enable row level security;

create policy profiles_select on public.profiles for select to authenticated
  using (user_id = (select auth.uid()));
create policy profiles_update on public.profiles for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy projects_all on public.projects for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

create policy catalog_items_all on public.catalog_items for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

create policy purchase_marks_all on public.purchase_marks for all to authenticated
  using (exists (
    select 1 from public.projects p
    where p.id = project_id and p.owner_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.projects p
    where p.id = project_id and p.owner_id = (select auth.uid())
  ));

-- Optimistic-concurrency save. Returns the new version; raises version_conflict (P0001) when
-- the stored version moved on, forbidden (42501) when the project is not the caller's.
create function public.save_project(
  p_id uuid,
  p_expected_version integer,
  p_doc jsonb,
  p_settings jsonb,
  p_quote jsonb
) returns integer
language plpgsql security invoker set search_path = '' as $$
declare
  v_owner uuid;
  v_version integer;
begin
  select owner_id, version into v_owner, v_version
    from public.projects where id = p_id for update;
  if v_owner is null or v_owner <> auth.uid() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_version <> p_expected_version then
    raise exception 'version_conflict' using errcode = 'P0001';
  end if;
  update public.projects
     set doc = p_doc, settings = p_settings, quote = p_quote,
         version = version + 1, updated_at = now()
   where id = p_id
  returning version into v_version;
  return v_version;
end;
$$;

-- Per-account quote numbering.
create function public.next_quote_number() returns integer
language plpgsql security invoker set search_path = '' as $$
declare
  v_number integer;
begin
  update public.profiles set quote_counter = quote_counter + 1
   where user_id = auth.uid()
  returning quote_counter into v_number;
  if v_number is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return v_number;
end;
$$;

revoke execute on function public.save_project from anon, public;
revoke execute on function public.next_quote_number from anon, public;
grant execute on function public.save_project to authenticated;
grant execute on function public.next_quote_number to authenticated;

-- Private storage: objects live under <user_id>/<project_id>/... (backgrounds) and
-- <user_id>/... (logos).
insert into storage.buckets (id, name, public, file_size_limit)
values
  ('backgrounds', 'backgrounds', false, 20971520),
  ('logos', 'logos', false, 2097152);

create policy storage_own_select on storage.objects for select to authenticated
  using (bucket_id in ('backgrounds', 'logos')
         and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy storage_own_insert on storage.objects for insert to authenticated
  with check (bucket_id in ('backgrounds', 'logos')
              and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy storage_own_update on storage.objects for update to authenticated
  using (bucket_id in ('backgrounds', 'logos')
         and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy storage_own_delete on storage.objects for delete to authenticated
  using (bucket_id in ('backgrounds', 'logos')
         and (storage.foldername(name))[1] = (select auth.uid())::text);
