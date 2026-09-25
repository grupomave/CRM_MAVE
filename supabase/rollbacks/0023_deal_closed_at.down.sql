-- Reverte 0023_deal_closed_at.sql. Dashboard e Relatórios voltam a usar
-- updated_at (o código faz fallback automaticamente).

drop trigger if exists deals_set_closed_at on deals;
drop function if exists public.set_deal_closed_at();
drop index if exists deals_closed_at_idx;
alter table deals drop column if exists closed_at;
