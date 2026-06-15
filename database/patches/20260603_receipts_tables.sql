-- =========================================================
-- QuoteFlow Pro Receipts Patch
-- Purpose:
-- 1. Add receipts table
-- 2. Add receipt_items table
-- 3. Allow Receipt to copy and display Invoice item content
-- 4. Development-stage permission / RLS fix
-- Safe to run more than once.
-- =========================================================

create extension if not exists "uuid-ossp";

-- =========================================================
-- 1. Receipts table
-- =========================================================

create table if not exists public.receipts (
  id uuid primary key default uuid_generate_v4(),

  company_id uuid not null references public.companies(id) on delete cascade,
  invoice_id uuid references public.invoices(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,

  receipt_no text not null,
  receipt_date date not null default current_date,

  customer_name text,
  invoice_no text,
  project_name text,
  project_description text,

  amount_received numeric(12,2) not null default 0,
  currency text not null default 'MOP',

  payment_method text not null default '',
  payment_reference text not null default '',
  received_by text not null default '',
  remarks text not null default '',

  status text not null default 'draft',

  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique(company_id, receipt_no)
);

alter table public.receipts
  add column if not exists company_id uuid references public.companies(id) on delete cascade,
  add column if not exists invoice_id uuid references public.invoices(id) on delete set null,
  add column if not exists customer_id uuid references public.customers(id) on delete set null,
  add column if not exists receipt_no text,
  add column if not exists receipt_date date not null default current_date,
  add column if not exists customer_name text,
  add column if not exists invoice_no text,
  add column if not exists project_name text,
  add column if not exists project_description text,
  add column if not exists amount_received numeric(12,2) not null default 0,
  add column if not exists currency text not null default 'MOP',
  add column if not exists payment_method text not null default '',
  add column if not exists payment_reference text not null default '',
  add column if not exists received_by text not null default '',
  add column if not exists remarks text not null default '',
  add column if not exists status text not null default 'draft',
  add column if not exists deleted_at timestamptz,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

-- =========================================================
-- 2. Receipt items table
-- This table stores a snapshot copied from invoice_items.
-- =========================================================

create table if not exists public.receipt_items (
  id uuid primary key default uuid_generate_v4(),

  company_id uuid not null references public.companies(id) on delete cascade,
  receipt_id uuid not null references public.receipts(id) on delete cascade,
  invoice_item_id uuid references public.invoice_items(id) on delete set null,

  item_no integer not null default 1,
  item_name text not null,
  description text,

  unit_price numeric(12,2) not null default 0,
  quantity numeric(12,2) not null default 1,
  total_amount numeric(12,2) not null default 0,

  sort_order integer not null default 0,

  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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
-- 3. Development-stage permissions
-- =========================================================

grant usage on schema public to anon;
grant usage on schema public to authenticated;

grant select, insert, update, delete on public.receipts to anon;
grant select, insert, update, delete on public.receipts to authenticated;

grant select, insert, update, delete on public.receipt_items to anon;
grant select, insert, update, delete on public.receipt_items to authenticated;

-- Remove old confusing policies
drop policy if exists "Allow select receipts" on public.receipts;
drop policy if exists "Allow insert receipts" on public.receipts;
drop policy if exists "Allow update receipts" on public.receipts;
drop policy if exists "Allow delete receipts" on public.receipts;

drop policy if exists "Enable read access for receipts" on public.receipts;
drop policy if exists "Enable insert access for receipts" on public.receipts;
drop policy if exists "Enable update access for receipts" on public.receipts;
drop policy if exists "Enable delete access for receipts" on public.receipts;

drop policy if exists receipts_dev_allow_all on public.receipts;

drop policy if exists "Allow select receipt_items" on public.receipt_items;
drop policy if exists "Allow insert receipt_items" on public.receipt_items;
drop policy if exists "Allow update receipt_items" on public.receipt_items;
drop policy if exists "Allow delete receipt_items" on public.receipt_items;

drop policy if exists "Enable read access for receipt_items" on public.receipt_items;
drop policy if exists "Enable insert access for receipt_items" on public.receipt_items;
drop policy if exists "Enable update access for receipt_items" on public.receipt_items;
drop policy if exists "Enable delete access for receipt_items" on public.receipt_items;

drop policy if exists receipt_items_dev_allow_all on public.receipt_items;

-- Create permissive dev policies in case RLS is enabled again later.
alter table public.receipts enable row level security;

create policy receipts_dev_allow_all
on public.receipts
for all
to anon, authenticated
using (true)
with check (true);

alter table public.receipt_items enable row level security;

create policy receipt_items_dev_allow_all
on public.receipt_items
for all
to anon, authenticated
using (true)
with check (true);

-- Current development stage: disable RLS.
alter table public.receipts disable row level security;
alter table public.receipts no force row level security;

alter table public.receipt_items disable row level security;
alter table public.receipt_items no force row level security;

-- =========================================================
-- 4. Indexes
-- =========================================================

create unique index if not exists idx_receipts_one_active_receipt_per_invoice
on public.receipts(invoice_id)
where deleted_at is null and invoice_id is not null;

create index if not exists idx_receipts_company_id
on public.receipts(company_id);

create index if not exists idx_receipts_invoice_id
on public.receipts(invoice_id);

create index if not exists idx_receipts_customer_id
on public.receipts(customer_id);

create index if not exists idx_receipts_deleted_at
on public.receipts(deleted_at);

create index if not exists idx_receipts_status
on public.receipts(status);

create index if not exists idx_receipts_created_at
on public.receipts(created_at);

create index if not exists idx_receipt_items_company_id
on public.receipt_items(company_id);

create index if not exists idx_receipt_items_receipt_id
on public.receipt_items(receipt_id);

create index if not exists idx_receipt_items_invoice_item_id
on public.receipt_items(invoice_item_id);

create index if not exists idx_receipt_items_deleted_at
on public.receipt_items(deleted_at);

-- =========================================================
-- 5. Final RLS status check
-- =========================================================

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