-- HISAB KHATA — multi-tenant Supabase Auth + admin/staff permissions
-- No extension is required for signup/invites. This script uses built-in PostgreSQL functions only.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  role text not null default 'staff' check (role in ('admin','staff')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists full_name text;
alter table public.profiles add column if not exists role text;
alter table public.profiles add column if not exists active boolean;
alter table public.profiles add column if not exists created_at timestamptz;
alter table public.profiles add column if not exists updated_at timestamptz;
update public.profiles set role=coalesce(role,'staff'),active=coalesce(active,true),created_at=coalesce(created_at,now()),updated_at=coalesce(updated_at,now());
alter table public.profiles alter column role set default 'staff';
alter table public.profiles alter column role set not null;
alter table public.profiles alter column active set default true;
alter table public.profiles alter column active set not null;
alter table public.profiles alter column created_at set default now();
alter table public.profiles alter column created_at set not null;
alter table public.profiles alter column updated_at set default now();
alter table public.profiles alter column updated_at set not null;

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references auth.users(id) on delete cascade,
  name text not null default 'Hisab Khata',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  permissions jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(workspace_id,user_id)
);
create index if not exists workspace_members_user_idx on public.workspace_members(user_id);

create table if not exists public.bahikhata_states (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  data jsonb not null default '{"parties":[],"groups":[],"audit":[],"notifyDays":null}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);
alter table public.bahikhata_states add column if not exists updated_by uuid references auth.users(id);

-- Legacy table retained for migration compatibility; the app no longer uses it.
create table if not exists public.bahikhata_state (
  id text primary key,
  data jsonb not null default '{"parties":[]}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

create or replace function public.current_workspace_id()
returns uuid language sql stable security definer set search_path=public as $$
  select wm.workspace_id from public.workspace_members wm
  where wm.user_id=auth.uid() and wm.active=true limit 1;
$$;
revoke all on function public.current_workspace_id() from public;
grant execute on function public.current_workspace_id() to authenticated;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin' and p.active=true);
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

create or replace function public.has_permission(permission_name text)
returns boolean language sql stable security definer set search_path=public as $$
  select public.is_admin() or exists(
    select 1 from public.workspace_members wm
    where wm.user_id=auth.uid() and wm.active=true
      and coalesce((wm.permissions ->> permission_name)::boolean,false)=true
  );
$$;
revoke all on function public.has_permission(text) from public;
grant execute on function public.has_permission(text) to authenticated;

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.bahikhata_states enable row level security;

drop policy if exists "profiles own read" on public.profiles;
create policy "profiles own read" on public.profiles for select to authenticated using(id=auth.uid());

drop policy if exists "workspace own read" on public.workspaces;
create policy "workspace own read" on public.workspaces for select to authenticated using(owner_id=auth.uid() or exists(select 1 from public.workspace_members wm where wm.workspace_id=id and wm.user_id=auth.uid() and wm.active=true));

drop policy if exists "workspace members own read" on public.workspace_members;
create policy "workspace members own read" on public.workspace_members for select to authenticated using(user_id=auth.uid() or (public.is_admin() and workspace_id=public.current_workspace_id()));

drop policy if exists "workspace state read" on public.bahikhata_states;
drop policy if exists "workspace state insert" on public.bahikhata_states;
drop policy if exists "workspace state update" on public.bahikhata_states;
create policy "workspace state read" on public.bahikhata_states for select to authenticated using(workspace_id=public.current_workspace_id());
create policy "workspace state insert" on public.bahikhata_states for insert to authenticated with check(workspace_id=public.current_workspace_id() and public.has_permission('write_data'));
create policy "workspace state update" on public.bahikhata_states for update to authenticated using(workspace_id=public.current_workspace_id() and public.has_permission('write_data')) with check(workspace_id=public.current_workspace_id());

create or replace function public.deactivate_staff(target_user uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare ws uuid;
begin
  if not public.is_admin() then raise exception 'Administrator access required'; end if;
  ws:=public.current_workspace_id();
  if target_user=auth.uid() then raise exception 'You cannot disable your own access'; end if;
  if not exists(select 1 from public.workspace_members where workspace_id=ws and user_id=target_user) then raise exception 'User is not in your workspace'; end if;
  update public.workspace_members set active=false,updated_at=now() where workspace_id=ws and user_id=target_user;
  update public.profiles set active=false,updated_at=now() where id=target_user;
  return jsonb_build_object('ok',true);
end; $$;
revoke all on function public.deactivate_staff(uuid) from public;
grant execute on function public.deactivate_staff(uuid) to authenticated;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path=public as $$
declare ws uuid; acct text; admin_count integer;
begin
  acct:=coalesce(new.raw_user_meta_data->>'account_type','admin');
  if acct='staff' then
    -- Staff users are created only by the admin-users Edge Function. Let Auth
    -- create the user first; the function then upserts profile/member rows with
    -- the caller admin's workspace and selected permissions.
    return new;
  end if;
  select count(*) into admin_count from public.profiles where role='admin';
  if admin_count > 0 then raise exception 'The administrator account already exists. Staff accounts must be created by the administrator.'; end if;
  insert into public.profiles(id,email,full_name,role,active) values(new.id,new.email,coalesce(new.raw_user_meta_data->>'full_name',''),'admin',true) on conflict(id) do update set email=excluded.email,full_name=coalesce(nullif(excluded.full_name,''),public.profiles.full_name),role='admin',active=true,updated_at=now();
  insert into public.workspaces(owner_id,name) values(new.id,'Hisab Khata') on conflict(owner_id) do nothing returning id into ws;
  if ws is null then select id into ws from public.workspaces where owner_id=new.id; end if;
  insert into public.workspace_members(workspace_id,user_id,permissions,active) values(ws,new.id,'{}'::jsonb,true) on conflict(workspace_id,user_id) do update set active=true;
  insert into public.bahikhata_states(workspace_id,data,updated_by) values(ws,'{"parties":[],"groups":[],"audit":[],"notifyDays":null}'::jsonb,new.id) on conflict(workspace_id) do nothing;
  return new;
end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

-- Upgrade safety: this setup never creates a second administrator.
-- Existing administrators get their own private workspace. Existing shared data is
-- copied to the first administrator only so it is not exposed across tenants.
do $$ declare a uuid; ws uuid; legacy jsonb;
begin
  select id into a from public.profiles where role='admin' and active=true order by created_at asc limit 1;
  if a is not null then
    insert into public.workspaces(owner_id,name) values(a,'Hisab Khata') on conflict(owner_id) do nothing returning id into ws;
    if ws is null then select id into ws from public.workspaces where owner_id=a; end if;
    insert into public.workspace_members(workspace_id,user_id,permissions,active) values(ws,a,'{}'::jsonb,true) on conflict(workspace_id,user_id) do nothing;
    select data into legacy from public.bahikhata_state where id='main';
    insert into public.bahikhata_states(workspace_id,data,updated_by) values(ws,coalesce(legacy,'{"parties":[],"groups":[],"audit":[],"notifyDays":null}'::jsonb),a) on conflict(workspace_id) do nothing;
  end if;
end $$;

-- Staff account support: admin-created users are assigned to the caller's workspace
-- by the admin-users Edge Function.
create or replace function public.list_workspace_members()
returns table(user_id uuid,email text,full_name text,role text,active boolean,permissions jsonb,created_at timestamptz)
language sql stable security definer set search_path=public as $$
 select p.id,p.email,p.full_name,p.role,wm.active,wm.permissions,p.created_at
 from public.workspace_members wm join public.profiles p on p.id=wm.user_id
 where public.is_admin() and wm.workspace_id=public.current_workspace_id() order by p.created_at asc;
$$;
revoke all on function public.list_workspace_members() from public;
grant execute on function public.list_workspace_members() to authenticated;

create or replace function public.get_my_access()
returns jsonb language sql stable security definer set search_path=public as $$
 select jsonb_build_object('workspace_id',wm.workspace_id,'permissions',wm.permissions,'role',p.role,'active',p.active,'full_name',p.full_name,'email',p.email)
 from public.profiles p left join public.workspace_members wm on wm.user_id=p.id and wm.active=true
 where p.id=auth.uid() limit 1;
$$;
revoke all on function public.get_my_access() from public;
grant execute on function public.get_my_access() to authenticated;

create or replace function public.get_workspace_state()
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare result jsonb;
begin
  if not public.is_admin() and not public.has_permission('view_data') then raise exception 'Permission denied: view_data'; end if;
  select data into result from public.bahikhata_states where workspace_id=public.current_workspace_id();
  return coalesce(result,'{"parties":[],"groups":[],"audit":[],"notifyDays":null}'::jsonb);
end; $$;
revoke all on function public.get_workspace_state() from public;
grant execute on function public.get_workspace_state() to authenticated;

create or replace function public.save_workspace_state(new_data jsonb, required_permission text default 'write_data')
returns jsonb language plpgsql security definer set search_path=public as $$
declare ws uuid; result jsonb;
begin
  ws:=public.current_workspace_id();
  if ws is null then raise exception 'No workspace is assigned to this account'; end if;
  if not public.is_admin() and not public.has_permission(required_permission) then raise exception 'Permission denied: %',required_permission; end if;
  update public.bahikhata_states set data=new_data,updated_at=now(),updated_by=auth.uid() where workspace_id=ws returning data into result;
  if result is null then insert into public.bahikhata_states(workspace_id,data,updated_by) values(ws,new_data,auth.uid()) returning data into result; end if;
  return result;
end; $$;
revoke all on function public.save_workspace_state(jsonb,text) from public;
grant execute on function public.save_workspace_state(jsonb,text) to authenticated;

create or replace function public.set_staff_permissions(target_user uuid,new_permissions jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare ws uuid; result jsonb;
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  ws:=public.current_workspace_id();
  if not exists(select 1 from public.workspace_members where workspace_id=ws and user_id=target_user) then raise exception 'User is not in your workspace'; end if;
  update public.workspace_members set permissions=coalesce(new_permissions,'{}'::jsonb),updated_at=now() where workspace_id=ws and user_id=target_user returning permissions into result;
  return result;
end; $$;
revoke all on function public.set_staff_permissions(uuid,jsonb) from public;
grant execute on function public.set_staff_permissions(uuid,jsonb) to authenticated;

-- Private bill attachments. Each object is stored under its owner's user id.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('bill-attachments','bill-attachments',false,20971520,array['image/jpeg','image/png','image/webp','image/heic','image/heif','application/pdf']) on conflict(id) do update set public=false,file_size_limit=20971520;
drop policy if exists "bahikhata attachment upload" on storage.objects;
drop policy if exists "bahikhata attachment read" on storage.objects;
drop policy if exists "bahikhata attachment update" on storage.objects;
drop policy if exists "bahikhata attachment delete" on storage.objects;
create policy "bahikhata attachment upload" on storage.objects for insert to authenticated with check(bucket_id='bill-attachments' and (storage.foldername(name))[1]=public.current_workspace_id()::text and public.has_permission('upload_bills'));
create policy "bahikhata attachment read" on storage.objects for select to authenticated using(bucket_id='bill-attachments' and ( (storage.foldername(name))[1]=public.current_workspace_id()::text or exists(select 1 from public.workspace_members wm where wm.workspace_id=public.current_workspace_id() and wm.user_id=(storage.foldername(name))[1]::uuid and wm.active=true) ));
create policy "bahikhata attachment update" on storage.objects for update to authenticated using(bucket_id='bill-attachments' and ((storage.foldername(name))[1]=public.current_workspace_id()::text or (storage.foldername(name))[1]=auth.uid()::text)) with check(bucket_id='bill-attachments' and ((storage.foldername(name))[1]=public.current_workspace_id()::text or (storage.foldername(name))[1]=auth.uid()::text));
create policy "bahikhata attachment delete" on storage.objects for delete to authenticated using(bucket_id='bill-attachments' and ((storage.foldername(name))[1]=public.current_workspace_id()::text or (storage.foldername(name))[1]=auth.uid()::text));

-- Lock down the old shared table so it cannot be queried by authenticated users.
alter table public.bahikhata_state enable row level security;
drop policy if exists "bahikhata state authenticated read" on public.bahikhata_state;
drop policy if exists "bahikhata state authenticated insert" on public.bahikhata_state;
drop policy if exists "bahikhata state authenticated update" on public.bahikhata_state;
revoke all on public.bahikhata_state from authenticated;

alter table public.bahikhata_states replica identity full;
do $$ begin alter publication supabase_realtime add table public.bahikhata_states; exception when duplicate_object then null; end $$;

drop function if exists public.admin_signup_available();
drop function if exists public.bootstrap_admin(text);
drop function if exists public.create_staff_invite(text,text);
