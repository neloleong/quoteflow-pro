-- QuoteFlow Pro Seed Data
-- Initial EMIT company, customer, vendor, test items and CNAS certificate

-- =========================================================
-- 1. EMIT Company
-- =========================================================

insert into companies (
  id,
  company_name,
  display_name,
  address,
  phone,
  fax,
  email,
  website,
  business_registration_no,
  default_currency
)
values (
  '11111111-1111-1111-1111-111111111111',
  'Enviroforce Monitoring, Inspection And Testing Co. Ltd.',
  'EMIT',
  null,
  '+853 2875 1742',
  '+853 2852 0536',
  'am01@emit.com.mo',
  null,
  null,
  'MOP'
)
on conflict (id) do nothing;

-- =========================================================
-- 2. Sample Customer
-- =========================================================

insert into customers (
  id,
  company_id,
  customer_name,
  contact_person,
  customer_type,
  remarks
)
values (
  '22222222-2222-2222-2222-222222222222',
  '11111111-1111-1111-1111-111111111111',
  '資豐食品廠',
  'ChiKei L',
  'company',
  'Sample customer from EMIT quotation.'
)
on conflict (id) do nothing;

-- =========================================================
-- 3. Vendor / External Laboratory
-- =========================================================

insert into vendors (
  id,
  company_id,
  vendor_name,
  accreditation,
  remarks
)
values (
  '33333333-3333-3333-3333-333333333333',
  '11111111-1111-1111-1111-111111111111',
  '拱北海关技术中心',
  'CNAS L0008 / ISO/IEC 17025',
  'External accredited laboratory reference.'
)
on conflict (id) do nothing;

-- =========================================================
-- 4. Test Categories
-- =========================================================

insert into test_categories (
  id,
  company_id,
  category_name,
  description,
  sort_order
)
values
(
  '44444444-4444-4444-4444-444444444441',
  '11111111-1111-1111-1111-111111111111',
  '食品微生物 / 病毒測試項目',
  'Food microbiology and virus testing items.',
  1
),
(
  '44444444-4444-4444-4444-444444444442',
  '11111111-1111-1111-1111-111111111111',
  '食品添加劑 / 化學測試項目',
  'Food additives and chemical testing items.',
  2
),
(
  '44444444-4444-4444-4444-444444444443',
  '11111111-1111-1111-1111-111111111111',
  '食品重金屬',
  'Food heavy metal testing items.',
  3
)
on conflict (id) do nothing;

-- =========================================================
-- 5. Initial Test Items
-- Lab Price = RMB
-- Customer Price = MOP
-- =========================================================

insert into test_items (
  company_id,
  category_id,
  vendor_id,
  item_code,
  item_name_zh,
  item_name_en,
  major_category,
  testing_object,
  test_standard,
  lab_price_rmb,
  customer_price_mop,
  currency_lab,
  currency_customer,
  turnaround_text,
  accreditation_required,
  is_accredited,
  show_in_quotation,
  is_active,
  remarks
)
values
(
  '11111111-1111-1111-1111-111111111111',
  '44444444-4444-4444-4444-444444444441',
  '33333333-3333-3333-3333-333333333333',
  'MICRO-001',
  '菌落總數',
  'Total Plate Count',
  '食品',
  '食品',
  'SN/T 0168-2015',
  0,
  200,
  'RMB',
  'MOP',
  '約 7 個工作天',
  true,
  true,
  true,
  true,
  null
),
(
  '11111111-1111-1111-1111-111111111111',
  '44444444-4444-4444-4444-444444444441',
  '33333333-3333-3333-3333-333333333333',
  'MICRO-002',
  '大腸埃希氏菌',
  'Escherichia coli',
  '食品',
  '食品',
  'GB 4789.38-2025 / SN/T 0169-2010',
  0,
  230,
  'RMB',
  'MOP',
  '約 7 個工作天',
  true,
  true,
  true,
  true,
  null
),
(
  '11111111-1111-1111-1111-111111111111',
  '44444444-4444-4444-4444-444444444441',
  '33333333-3333-3333-3333-333333333333',
  'MICRO-003',
  '沙門氏菌',
  'Salmonella',
  '食品',
  '食品',
  'GB 4789.4-2024 / GB/T 22429-2008',
  0,
  270,
  'RMB',
  'MOP',
  '約 7 個工作天',
  true,
  true,
  true,
  true,
  null
),
(
  '11111111-1111-1111-1111-111111111111',
  '44444444-4444-4444-4444-444444444441',
  '33333333-3333-3333-3333-333333333333',
  'MICRO-004',
  '金黃色葡萄球菌（計數）',
  'Staphylococcus aureus Count',
  '食品',
  '食品',
  'GB 4789.10-2016',
  0,
  270,
  'RMB',
  'MOP',
  '約 7 個工作天',
  true,
  true,
  true,
  true,
  '不測葡萄球菌腸毒素'
),
(
  '11111111-1111-1111-1111-111111111111',
  '44444444-4444-4444-4444-444444444442',
  '33333333-3333-3333-3333-333333333333',
  'CHEM-001',
  '防腐劑（苯甲酸及其鈉鹽，以苯甲酸計）',
  'Benzoic Acid and Its Salts',
  '食品',
  '食品',
  'GB 5009.28-2016',
  0,
  350,
  'RMB',
  'MOP',
  '約 7 個工作天',
  true,
  true,
  true,
  true,
  '只測第一法'
),
(
  '11111111-1111-1111-1111-111111111111',
  '44444444-4444-4444-4444-444444444442',
  '33333333-3333-3333-3333-333333333333',
  'CHEM-002',
  '山梨酸及其鉀鹽（以山梨酸計）',
  'Sorbic Acid and Its Salts',
  '食品',
  '食品',
  'GB 5009.28-2016',
  0,
  360,
  'RMB',
  'MOP',
  '約 7 個工作天',
  true,
  true,
  true,
  true,
  '只測第一法'
),
(
  '11111111-1111-1111-1111-111111111111',
  '44444444-4444-4444-4444-444444444442',
  '33333333-3333-3333-3333-333333333333',
  'CHEM-003',
  '鄰苯二甲酸酯類（18種）',
  'Phthalates - 18 Types',
  '食品',
  '食品',
  'GB 5009.271-2016',
  0,
  3000,
  'RMB',
  'MOP',
  '約 7 個工作天',
  true,
  true,
  true,
  true,
  '只測第二法'
),
(
  '11111111-1111-1111-1111-111111111111',
  '44444444-4444-4444-4444-444444444443',
  '33333333-3333-3333-3333-333333333333',
  'HM-001',
  '總砷',
  'Total Arsenic',
  '食品',
  '食品',
  'GB 5009.11-2024 / GB 5009.268-2025',
  0,
  350,
  'RMB',
  'MOP',
  '約 7 個工作天',
  true,
  true,
  true,
  true,
  null
),
(
  '11111111-1111-1111-1111-111111111111',
  '44444444-4444-4444-4444-444444444443',
  '33333333-3333-3333-3333-333333333333',
  'HM-002',
  '鎘',
  'Cadmium',
  '食品',
  '食品',
  'GB 5009.15-2023 / GB 5009.268-2025',
  0,
  350,
  'RMB',
  'MOP',
  '約 7 個工作天',
  true,
  true,
  true,
  true,
  null
),
(
  '11111111-1111-1111-1111-111111111111',
  '44444444-4444-4444-4444-444444444443',
  '33333333-3333-3333-3333-333333333333',
  'HM-003',
  '總汞',
  'Total Mercury',
  '食品',
  '食品',
  'GB 5009.17-2021 / GB 5009.268-2025',
  0,
  350,
  'RMB',
  'MOP',
  '約 7 個工作天',
  true,
  true,
  true,
  true,
  null
),
(
  '11111111-1111-1111-1111-111111111111',
  '44444444-4444-4444-4444-444444444443',
  '33333333-3333-3333-3333-333333333333',
  'HM-004',
  '鉛',
  'Lead',
  '食品',
  '食品',
  'GB 5009.12-2023 / GB 5009.268-2025',
  0,
  350,
  'RMB',
  'MOP',
  '約 7 個工作天',
  true,
  true,
  true,
  true,
  null
)
on conflict (company_id, item_code) do nothing;

-- =========================================================
-- 6. CNAS Accreditation Body
-- =========================================================

insert into accreditation_bodies (
  id,
  body_code,
  body_name,
  country_or_region,
  remarks
)
values (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'CNAS',
  '中国合格评定国家认可委员会',
  'China',
  'China National Accreditation Service for Conformity Assessment.'
)
on conflict (body_code) do nothing;

-- =========================================================
-- 7. CNAS L0008 Lab Accreditation
-- =========================================================

insert into lab_accreditations (
  id,
  company_id,
  accreditation_body_id,
  certificate_no,
  lab_name,
  lab_address,
  accreditation_basis,
  effective_date,
  expiry_date,
  source_file_name,
  source_file_version,
  total_pages,
  remarks
)
values (
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  '11111111-1111-1111-1111-111111111111',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'CNAS L0008',
  '拱北海关技术中心',
  '广东省珠海市香洲区银桦路 501 号',
  'ISO/IEC 17025:2017 以及 CNAS 特定认可要求',
  '2026-03-05',
  '2028-10-22',
  '认可的检测能力范围(中文)-501扩项2026.3.2+变更2026.3.5.pdf',
  '501扩项2026.3.2+变更2026.3.5',
  449,
  'Uploaded PDF contains Appendix 3: accredited testing capability scope.'
)
on conflict (company_id, certificate_no) do nothing;

-- =========================================================
-- 8. Sample Accredited Capabilities
-- 先放與目前 Quotation 最相關的能力資料
-- =========================================================

insert into accredited_capabilities (
  company_id,
  lab_accreditation_id,
  source_page,
  source_row_no,
  major_category,
  testing_object,
  parameter_sequence,
  parameter_name,
  test_standard_method,
  limitation_note,
  effective_date,
  original_text
)
values
(
  '11111111-1111-1111-1111-111111111111',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  1,
  1,
  '食品',
  '食品',
  '1',
  '菌落總數',
  '進出口食品中菌落總數計數方法 SN/T 0168-2015',
  null,
  '2024-12-16',
  '食品 / 菌落總數 / SN/T 0168-2015'
),
(
  '11111111-1111-1111-1111-111111111111',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  2,
  5,
  '食品',
  '食品',
  '5',
  '大腸埃希氏菌',
  '食品安全國家標準 食品微生物學檢驗 大腸埃希氏菌計數 GB 4789.38-2025',
  null,
  '2026-03-02',
  '食品 / 大腸埃希氏菌 / GB 4789.38-2025'
),
(
  '11111111-1111-1111-1111-111111111111',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  2,
  6,
  '食品',
  '食品',
  '6',
  '沙門氏菌',
  '食品安全國家標準 食品微生物學檢驗 沙門氏菌檢驗 GB 4789.4-2024',
  null,
  '2024-12-16',
  '食品 / 沙門氏菌 / GB 4789.4-2024'
),
(
  '11111111-1111-1111-1111-111111111111',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  2,
  8,
  '食品',
  '食品',
  '8',
  '金黃色葡萄球菌',
  '食品安全國家標準 食品微生物學檢驗 金黃色葡萄球菌檢驗 GB 4789.10-2016',
  '不測葡萄球菌腸毒素',
  '2024-12-16',
  '食品 / 金黃色葡萄球菌 / GB 4789.10-2016'
),
(
  '11111111-1111-1111-1111-111111111111',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  10,
  81,
  '食品',
  '食品',
  '81',
  '苯甲酸',
  '食品安全國家標準 食品中苯甲酸、山梨酸和糖精鈉的測定 GB 5009.28-2016',
  '只測第一法',
  '2024-12-16',
  '食品 / 苯甲酸 / GB 5009.28-2016'
),
(
  '11111111-1111-1111-1111-111111111111',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  10,
  82,
  '食品',
  '食品',
  '82',
  '山梨酸',
  '食品安全國家標準 食品中苯甲酸、山梨酸和糖精鈉的測定 GB 5009.28-2016',
  '只測第一法',
  '2024-12-16',
  '食品 / 山梨酸 / GB 5009.28-2016'
),
(
  '11111111-1111-1111-1111-111111111111',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  15,
  153,
  '食品',
  '食品',
  '153',
  '鄰苯二甲酸二甲酯',
  '食品安全國家標準 食品中鄰苯二甲酸酯的測定 GB 5009.271-2016',
  '只測第二法',
  '2024-12-16',
  '食品 / 鄰苯二甲酸二甲酯 / GB 5009.271-2016'
),
(
  '11111111-1111-1111-1111-111111111111',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  18,
  182,
  '食品',
  '食品',
  '182',
  '鉛',
  '食品安全國家標準 食品中鉛的測定 GB 5009.12-2023',
  null,
  '2024-12-16',
  '食品 / 鉛 / GB 5009.12-2023'
),
(
  '11111111-1111-1111-1111-111111111111',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  18,
  183,
  '食品',
  '食品',
  '183',
  '總砷',
  '食品安全國家標準 食品中總砷及無機砷的測定 GB 5009.11-2024',
  null,
  '2024-12-16',
  '食品 / 總砷 / GB 5009.11-2024'
),
(
  '11111111-1111-1111-1111-111111111111',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  18,
  185,
  '食品',
  '食品',
  '185',
  '總汞',
  '食品安全國家標準 食品中總汞及有機汞的測定 GB 5009.17-2021',
  '不做第一篇第二法',
  '2024-12-16',
  '食品 / 總汞 / GB 5009.17-2021'
),
(
  '11111111-1111-1111-1111-111111111111',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  18,
  187,
  '食品',
  '食品',
  '187',
  '鎘',
  '食品安全國家標準 食品中多元素的測定 GB 5009.268-2025',
  '只做第一篇第一法',
  '2025-09-30',
  '食品 / 鎘 / GB 5009.268-2025'
);

-- =========================================================
-- 9. Document Counter
-- =========================================================

insert into document_counters (
  company_id,
  document_type,
  prefix,
  current_year,
  current_month,
  current_number,
  reset_period
)
values (
  '11111111-1111-1111-1111-111111111111',
  'quotation',
  'EMIT-QF',
  2026,
  6,
  1,
  'monthly'
)
on conflict (company_id, document_type, current_year, current_month) do nothing;