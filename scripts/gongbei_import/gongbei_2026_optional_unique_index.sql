-- Run only if the import script projects missing unique/exclusion constraint for upsert.
-- It does not delete or change existing rows.
create unique index if not exists test_items_company_item_code_uidx
  on public.test_items(company_id, item_code)
  where deleted_at is null;
