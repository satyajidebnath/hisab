-- Optional schema upgrade for the newer metadata columns.
-- The application no longer requires these columns to save data.
-- Run this only if you want updated_at / updated_by metadata in the table.

alter table public.bahikhata_state
  add column if not exists updated_at timestamptz not null default now();

alter table public.bahikhata_state
  add column if not exists updated_by uuid references auth.users(id);
