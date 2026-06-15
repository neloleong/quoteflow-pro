-- QuoteFlow Pro Main Flow Patch
-- Purpose: align Supabase tables with the current Quotation -> Invoice frontend flow.
-- Safe to run more than once. It only creates missing tables / columns / indexes.

create extension if not exists "uuid-ossp";

-- =========================================================
-- 1. Saved food sample names per customer
-- =========================================================

create table if not exists customer_food_samples (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references companies(id) on delete cascade,
  customer_id uuid not null references customers(id) on delete cascade,

  sample_name text not null,
  sample_name_normalized text not null,

  usage_count integer not null default 0,
  last_used_at timestamptz,

  is_active boolean not null default true,
  deleted_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique(company_id, customer_id, sample_name_normalized)
);

-- =========================================================
-- 2. Missing soft-delete / sample snapshot columns
-- =========================================================

alter table quotations
  add column if not exists deleted_at timestamptz;

alter table quotation_items
  add column if not exists sample_no integer,
  add column if not exists sample_name text,
  add column if not exists test_category_name text,
  add column if not exists deleted_at timestamptz;

-- =========================================================
-- 3. Invoice tables
-- =========================================================

create table if not exists invoices (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references companies(id) on delete cascade,
  quotation_id uuid references quotations(id) on delete set null,
  customer_id uuid references customers(id) on delete set null,

  invoice_no text not null,
  invoice_date date not null default current_date,

  customer_name text,
  project_name text,
  project_description text,

  subtotal numeric(12,2) not null default 0,
  discount_amount numeric(12,2) not null default 0,
  total_amount numeric(12,2) not null default 0,
  currency text not null default 'MOP',

  status text not null default 'draft',
  deleted_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique(company_id, invoice_no)
);

create table if not exists invoice_items (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references companies(id) on delete cascade,
  invoice_id uuid not null references invoices(id) on delete cascade,

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

-- =========================================================
-- 4. Document counter table safeguard
-- =========================================================

create table if not exists document_counters (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references companies(id) on delete cascade,

  document_type text not null,
  prefix text not null,
  current_year integer not null,
  current_month integer,
  current_number integer not null default 0,
  reset_period text not null default 'monthly',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique(company_id, document_type, current_year, current_month)
);

-- =========================================================
-- 5. Indexes
-- =========================================================

create index if not exists idx_customer_food_samples_company_customer
on customer_food_samples(company_id, customer_id);

create index if not exists idx_customer_food_samples_deleted_at
on customer_food_samples(deleted_at);

create index if not exists idx_quotations_deleted_at
on quotations(deleted_at);

create index if not exists idx_quotation_items_deleted_at
on quotation_items(deleted_at);

create index if not exists idx_invoices_company_id
on invoices(company_id);

create index if not exists idx_invoices_quotation_id
on invoices(quotation_id);

create index if not exists idx_invoices_deleted_at
on invoices(deleted_at);

create index if not exists idx_invoice_items_company_id
on invoice_items(company_id);

create index if not exists idx_invoice_items_invoice_id
on invoice_items(invoice_id);

create index if not exists idx_invoice_items_deleted_at
on invoice_items(deleted_at);
