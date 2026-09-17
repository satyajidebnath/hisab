-- BAHIKHATA PROFILE / LOGIN FIX
-- Run this whole file once in Supabase SQL Editor.
-- It is safe to run repeatedly.

begin;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade
);

alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists full_name text;
alter table public.profiles add column if not exists role text;
alter table public.profiles add column if not exists active boolean;
alter table public.profiles add column if not exists created_at timestamptz;
alter table public.profiles add column if not exists updated_at timestamptz;

update public.profiles
set role=coalesce(role,'staff'), active=coalesce(active,true),
    created_at=coalesce(created_at,now()), updated_at=coalesce(updated_at,now());

alter table public.profiles alter column role set default 'staff';
alter table public.profiles alter column role set not null;
alter table public.profiles alter column active set default true;
alter table public.profiles alter column active set not null;
alter table public.profiles alter column created_at set default now();
alter table public.profiles alter column created_at set not null;
alter table public.profiles alter column updated_at set default now();
alter table public.profiles alter column updated_at set not null;

create index if not exists profiles_role_idx on public.profiles(role);

-- Keep the Auth -> profile trigger working for newly created users.
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path=public
as $$
begin
  insert into public.profiles(id,email,full_name,role,active)
  values(new.id,new.email,coalesce(new.raw_user_meta_data->>'full_name',''),'staff',true)
  on conflict(id) do update set email=excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users for each row execute procedure public.handle_new_user();

-- Backfill any Auth users created before the trigger was installed.
insert into public.profiles(id,email,full_name,role,active)
select u.id,u.email,coalesce(u.raw_user_meta_data->>'full_name',''),'staff',true
from auth.users u
where not exists(select 1 from public.profiles p where p.id=u.id);

commit;

select column_name,data_type,is_nullable,column_default
from information_schema.columns
where table_schema='public' and table_name='profiles'
order by ordinal_position;


-- RLS RECURSION FIX -------------------------------------------------------
-- A profiles policy must never call a function that reads profiles, because
-- PostgreSQL will evaluate that policy again and report infinite recursion.

drop policy if exists "profiles admin read" on public.profiles;
drop policy if exists "profiles own update" on public.profiles;
drop policy if exists "profiles admin update" on public.profiles;
drop policy if exists "profiles read" on public.profiles;

drop policy if exists "profiles own read" on public.profiles;
create policy "profiles own read"
on public.profiles for select
to authenticated
using (id = auth.uid());

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin' and p.active = true
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

create or replace function public.list_profiles()
returns setof public.profiles
language sql
stable
security definer
set search_path = public
as $$
  select p.* from public.profiles p
  where public.is_admin()
  order by p.created_at asc;
$$;

revoke all on function public.list_profiles() from public;
grant execute on function public.list_profiles() to authenticated;
