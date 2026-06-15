-- =========================================================
-- QuoteFlow Pro Receipt Items Fix
-- Purpose:
-- Fix error:
-- Could not find the table 'public.receipt_items' in the schema cache
--
-- This creates receipt_items table, fixes missing receipt fields,
-- grants permissions, disables RLS for development,
-- and reloads Supabase PostgREST schema cache.
-- Safe to run more than once.
-- =========================================================

create extension if not exists "uuid-ossp";

-- =========================================================
-- 1. Make sure receipts has project_description
-- =========================================================

alter table public.receipts
  add column if not exists project_description text;

-- =========================================================
-- 2. Create receipt_items table
-- =========================================================

create table if not exists public.receipt_items (
  id uuid primary key default uuid_generate_v4(),

  company_id uuid not null references public.companies(id) on delete cascade,
  receipt_id uuid not null references public.receipts(id) on delete cascade,
  invoice_item_id uuid references public.invoice_items(id) on delete set null,

  item_no integer not null default 1,
  item_name text not null default '',
  description text,

  unit_price numeric(12,2) not null default 0,
  quantity numeric(12,2) not null default 1,
  total_amount numeric(12,2) not null default 0,

  sort_order integer not null default 0,

  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================================================
-- 3. Make sure all receipt_items columns exist
-- =========================================================

alter table public.receipt_items
  add column if not exists company_id uuid references public.companies(id) on delete cascade,
  add column if not exists receipt_id uuid references public.receipts(id) on delete cascade,
  add column if not exists invoice_item_id uuid references public.invoice_items(id) on delete set null,
  add column if not exists item_no integer not null default 1,
  add column if not exists item_name text not null default '',
  add column if not exists description text,
  add column if not exists unit_price numeric(12,2) not null default 0,
  add column if not exists quantity numeric(12,2) not null default 1,
  add column if not exists total_amount numeric(12,2) not null default 0,
  add column if not exists sort_order integer not null default 0,
  add column if not exists deleted_at timestamptz,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

-- =========================================================
-- 4. Permissions for frontend development
-- =========================================================

grant usage on schema public to anon;
grant usage on schema public to authenticated;

grant select, insert, update, delete on public.receipt_items to anon;
grant select, insert, update, delete on public.receipt_items to authenticated;

grant select, insert, update, delete on public.receipts to anon;
grant select, insert, update, delete on public.receipts to authenticated;

-- =========================================================
-- 5. RLS development fix
-- =========================================================

drop policy if exists receipt_items_dev_allow_all on public.receipt_items;
drop policy if exists "Allow select receipt_items" on public.receipt_items;
drop policy if exists "Allow insert receipt_items" on public.receipt_items;
drop policy if exists "Allow update receipt_items" on public.receipt_items;
drop policy if exists "Allow delete receipt_items" on public.receipt_items;
drop policy if exists "Enable read access for receipt_items" on public.receipt_items;
drop policy if exists "Enable insert access for receipt_items" on public.receipt_items;
drop policy if exists "Enable update access for receipt_items" on public.receipt_items;
drop policy if exists "Enable delete access for receipt_items" on public.receipt_items;

alter table public.receipt_items enable row level security;

create policy receipt_items_dev_allow_all
on public.receipt_items
for all
to anon, authenticated
using (true)
with check (true);

alter table public.receipt_items disable row level security;
alter table public.receipt_items no force row level security;

-- Also keep receipts unrestricted during development
alter table public.receipts disable row level security;
alter table public.receipts no force row level security;

-- =========================================================
-- 6. Indexes
-- =========================================================

create index if not exists idx_receipt_items_company_id
on public.receipt_items(company_id);

create index if not exists idx_receipt_items_receipt_id
on public.receipt_items(receipt_id);

create index if not exists idx_receipt_items_invoice_item_id
on public.receipt_items(invoice_item_id);

create index if not exists idx_receipt_items_deleted_at
on public.receipt_items(deleted_at);

create unique index if not exists idx_receipt_items_unique_invoice_item_per_receipt
on public.receipt_items(receipt_id, invoice_item_id)
where deleted_at is null and invoice_item_id is not null;

-- =========================================================
-- 7. Reload Supabase schema cache
-- =========================================================

notify pgrst, 'reload schema';

-- =========================================================
-- 8. Check result
-- =========================================================

select
  table_schema,
  table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('receipts', 'receipt_items')
order by table_name;

select
  n.nspname as schema_name,
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as force_rls
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('receipts', 'receipt_items')
order by c.relname;