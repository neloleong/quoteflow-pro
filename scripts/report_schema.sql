alter table public.reports
add column if not exists source_quotation_id uuid null references public.quotations(id) on delete set null;

alter table public.reports
add column if not exists source_quotation_no text null;

alter table public.report_items
add column if not exists source_quotation_item_id uuid null;

alter table public.report_items
add column if not exists source_test_item_id uuid null;

alter table public.reports disable row level security;

alter table public.report_items disable row level security;

grant usage on schema public to anon;
grant usage on schema public to authenticated;

grant select, insert, update, delete on public.reports to anon;
grant select, insert, update, delete on public.reports to authenticated;

grant select, insert, update, delete on public.report_items to anon;
grant select, insert, update, delete on public.report_items to authenticated;