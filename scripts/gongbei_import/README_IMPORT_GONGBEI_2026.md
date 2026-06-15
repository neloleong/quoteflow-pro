# 拱北海關 2026 綜合資料庫匯入包

資料來源：
- 2026年拱北海关技术中心收费标准.pdf
- 认可的检测能力范围(中文)-501扩项2026.3.2+变更2026.3.5.pdf

檔案：
- gongbei_2026_price_rows.csv：2026 收費標準原始抽取資料，共 4325 行。
- gongbei_2026_accreditation_rows.csv：CNAS/ISO 17025 認可範圍抽取資料，共 3620 行。
- gongbei_2026_combined_test_items.csv：已按檢測項目名稱初步合併，可匯入 test_items，共 4325 行。
- import-gongbei-2026-test-items.mjs：Supabase 匯入腳本。

合併結果：
- 收費項目：4325
- 認可範圍項目/方法：3620
- 成功按名稱匹配認可資料：989

匯入：
```bash
npm install @supabase/supabase-js
set NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
set SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
set COMPANY_ID=11111111-1111-1111-1111-111111111111
node scripts/gongbei_import/import-gongbei-2026-test-items.mjs
```

安全設定：
- 預設 customer_price_mop = 0。
- 預設 show_in_quotation = false。
- 即資料會先進入資料庫，但不會直接出現在 Quotation。

如想自動把客戶價設為成本價：
```bash
set CUSTOMER_PRICE_MODE=copy
node scripts/gongbei_import/import-gongbei-2026-test-items.mjs
```

如想按成本加成：
```bash
set CUSTOMER_PRICE_MODE=markup
set CUSTOMER_PRICE_MARKUP=1.3
node scripts/gongbei_import/import-gongbei-2026-test-items.mjs
```
