-- Data de fechamento própria do negócio (ganho/perdido).
--
-- Dashboard e Relatórios datavam ganhos/perdas por deals.updated_at. O
-- importador do Pipedrive gravou ali a data real de fechamento
-- (scripts/import-pipedrive.ts), mas qualquer edição posterior no negócio
-- (valor, etapa, troca de responsável em massa...) sobrescreve updated_at e
-- joga o negócio antigo para o período atual, inflando os indicadores.
--
-- 1) Nova coluna closed_at, preenchida agora a partir do histórico de status
--    (quando existe) ou do updated_at atual — que, para os importados, ainda
--    é a data do Pipedrive.
-- 2) Gatilho: ao virar ganho/perdido grava now(); ao reabrir, limpa.
--
-- Reversão: supabase/rollbacks/0023_deal_closed_at.down.sql

alter table deals add column if not exists closed_at timestamptz;

update deals d
set closed_at = coalesce(
  (
    select max(h.changed_at)
    from deal_status_history h
    where h.deal_id = d.id and h.to_status = d.status
  ),
  d.updated_at
)
where d.status in ('won', 'lost') and d.closed_at is null;

create or replace function public.set_deal_closed_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.status in ('won', 'lost') and new.closed_at is null then
      new.closed_at := now();
    end if;
  elsif new.status is distinct from old.status then
    new.closed_at := case when new.status in ('won', 'lost') then now() else null end;
  end if;
  return new;
end;
$$;

drop trigger if exists deals_set_closed_at on deals;
create trigger deals_set_closed_at
  before insert or update of status on deals
  for each row execute function public.set_deal_closed_at();

create index if not exists deals_closed_at_idx on deals (closed_at) where closed_at is not null;
