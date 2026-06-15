-- QuoteFlow Pro Database Schema
-- Phase 1: SaaS Company + Customer + Vendor + Test Items + Quotation + Accreditation
-- Database: Supabase PostgreSQL

create extension if not exists "uuid-ossp";

-- =========================================================
-- 1. Companies / SaaS Tenants
-- =========================================================

create table if not exists companies (
  id uuid primary key default uuid_generate_v4(),

  company_name text not null,
  display_name text,
  logo_url text,

  address text,
  phone text,
  fax text,
  email text,
  website text,
  business_registration_no text,

  default_currency text not null default 'MOP',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================================================
-- 2. Customers / Clients
-- 報價單 TO / ATTN 的客戶
-- =========================================================

create table if not exists customers (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references companies(id) on delete cascade,

  customer_name text not null,
  contact_person text,

  phone text,
  fax text,
  email text,
  address text,
  business_registration_no text,

  customer_type text not null default 'company',
  remarks text,

  is_active boolean not null default true,
  deleted_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================================================
-- 3. Vendors / Suppliers / Subcontracted Laboratories
-- 廠商 / 外判實驗室 / 供應商
-- =========================================================

create table if not exists vendors (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references companies(id) on delete cascade,

  vendor_name text not null,
  contact_person text,

  phone text,
  fax text,
  email text,
  address text,

  accreditation text,
  remarks text,

  is_active boolean not null default true,
  deleted_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================================================
-- 4. Test Categories
-- 檢測分類
-- =========================================================

create table if not exists test_categories (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references companies(id) on delete cascade,

  category_name text not null,
  description text,

  sort_order integer not null default 0,
  is_active boolean not null default true,
  deleted_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================================================
-- 5. Test Items
-- 檢測項目資料庫
-- 支援實驗室價錢 RMB + 客戶報價 MOP
-- =========================================================

create table if not exists test_items (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references companies(id) on delete cascade,

  category_id uuid references test_categories(id) on delete set null,
  vendor_id uuid references vendors(id) on delete set null,

  item_code text,
  item_name_zh text not null,
  item_name_en text,

  major_category text,
  testing_object text,

  test_method text,
  test_standard text,

  lab_price_rmb numeric(12,2) not null default 0,
  customer_price_mop numeric(12,2) not null default 0,

  currency_lab text not null default 'RMB',
  currency_customer text not null default 'MOP',

  turnaround_days integer,
  turnaround_text text,

  accreditation_required boolean not null default false,
  is_accredited boolean not null default false,

  show_in_quotation boolean not null default true,
  is_active boolean not null default true,
  deleted_at timestamptz,

  remarks text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique(company_id, item_code)
);

-- =========================================================
-- 6. Accreditation Bodies
-- 認可機構，例如 CNAS
-- =========================================================

create table if not exists accreditation_bodies (
  id uuid primary key default uuid_generate_v4(),

  body_code text not null unique,
  body_name text not null,
  country_or_region text,

  remarks text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================================================
-- 7. Laboratory Accreditations
-- 實驗室認可證書，例如 CNAS L0008
-- =========================================================

create table if not exists lab_accreditations (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references companies(id) on delete cascade,

  accreditation_body_id uuid references accreditation_bodies(id) on delete set null,

  certificate_no text not null,
  lab_name text not null,
  lab_address text,

  accreditation_basis text,
  effective_date date,
  expiry_date date,

  source_file_name text,
  source_file_version text,
  total_pages integer,

  remarks text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique(company_id, certificate_no)
);

-- =========================================================
-- 8. Accredited Capabilities
-- CNAS / ISO 17025 認可檢測能力資料
-- =========================================================

create table if not exists accredited_capabilities (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references companies(id) on delete cascade,
  lab_accreditation_id uuid not null references lab_accreditations(id) on delete cascade,

  source_page integer,
  source_row_no integer,

  major_category text,
  testing_object text,

  parameter_sequence text,
  parameter_name text not null,

  test_standard_method text not null,
  limitation_note text,
  effective_date date,

  original_text text,

  is_active boolean not null default true,
  deleted_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================================================
-- 9. Test Item Capability Links
-- 將可報價檢測項目連接到 CNAS 認可能力
-- =========================================================

create table if not exists test_item_capability_links (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references companies(id) on delete cascade,

  test_item_id uuid not null references test_items(id) on delete cascade,
  accredited_capability_id uuid not null references accredited_capabilities(id) on delete cascade,

  is_primary boolean not null default false,
  remarks text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique(test_item_id, accredited_capability_id)
);

-- =========================================================
-- 10. Quotations Main Table
-- 報價單主表
-- =========================================================

create table if not exists quotations (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references companies(id) on delete cascade,
  customer_id uuid references customers(id) on delete set null,

  quotation_no text not null,

  quotation_date date not null default current_date,
  valid_until date,

  no_of_pages integer not null default 3,

  to_customer_name text,
  attention_to text,

  from_company_name text,
  from_tel text,
  from_fax text,
  from_email text,

  project_name text,
  project_description text,

  subtotal numeric(12,2) not null default 0,
  discount_amount numeric(12,2) not null default 0,
  total_amount numeric(12,2) not null default 0,
  currency text not null default 'MOP',

  notes text,

  status text not null default 'draft',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique(company_id, quotation_no)
);

-- =========================================================
-- 11. Quotation Items
-- 報價單項目明細
-- 這裡存 snapshot，避免日後改價影響舊報價
-- =========================================================

create table if not exists quotation_items (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references companies(id) on delete cascade,
  quotation_id uuid not null references quotations(id) on delete cascade,
  test_item_id uuid references test_items(id) on delete set null,

  item_no integer,
  description text not null,

  quantity numeric(12,2) not null default 1,
  unit text not null default 'item',

  lab_price_rmb_snapshot numeric(12,2) not null default 0,
  customer_unit_price_mop_snapshot numeric(12,2) not null default 0,
  customer_total_price_mop_snapshot numeric(12,2) not null default 0,

  sort_order integer not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================================================
-- 12. Quotation Fixed Terms and Conditions
-- 報價單第 2–3 頁固定條款
-- =========================================================

create table if not exists quotation_terms (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references companies(id) on delete cascade,

  title text not null default 'Terms & Conditions',
  content text not null,

  version text,
  is_default boolean not null default false,
  is_active boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================================================
-- 13. Document Counters
-- 文件編號，例如 EMIT-QF260601-001
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
-- 14. Indexes
-- =========================================================

create index if not exists idx_customers_company_id
on customers(company_id);

create index if not exists idx_vendors_company_id
on vendors(company_id);

create index if not exists idx_test_categories_company_id
on test_categories(company_id);

create index if not exists idx_test_items_company_id
on test_items(company_id);

create index if not exists idx_test_items_item_name_zh
on test_items(item_name_zh);

create index if not exists idx_test_items_testing_object
on test_items(testing_object);

create index if not exists idx_test_items_major_category
on test_items(major_category);

create index if not exists idx_test_items_show_in_quotation
on test_items(show_in_quotation);

create index if not exists idx_test_items_deleted_at
on test_items(deleted_at);

create index if not exists idx_lab_accreditations_company_id
on lab_accreditations(company_id);

create index if not exists idx_lab_accreditations_certificate_no
on lab_accreditations(certificate_no);

create index if not exists idx_accredited_capabilities_company_id
on accredited_capabilities(company_id);

create index if not exists idx_accredited_capabilities_lab_id
on accredited_capabilities(lab_accreditation_id);

create index if not exists idx_accredited_capabilities_parameter_name
on accredited_capabilities(parameter_name);

create index if not exists idx_accredited_capabilities_testing_object
on accredited_capabilities(testing_object);

create index if not exists idx_accredited_capabilities_major_category
on accredited_capabilities(major_category);

create index if not exists idx_test_item_capability_links_company_id
on test_item_capability_links(company_id);

create index if not exists idx_test_item_capability_links_test_item_id
on test_item_capability_links(test_item_id);

create index if not exists idx_test_item_capability_links_capability_id
on test_item_capability_links(accredited_capability_id);

create index if not exists idx_quotations_company_id
on quotations(company_id);

create index if not exists idx_quotation_items_company_id
on quotation_items(company_id);

create index if not exists idx_quotation_items_quotation_id
on quotation_items(quotation_id);

create index if not exists idx_quotation_terms_company_id
on quotation_terms(company_id);

create index if not exists idx_document_counters_company_id
on document_counters(company_id);