-- Motivos da perda cadastráveis.
--
-- Antes: enum fixo `lost_reason` (0012). Agora: tabela `lost_reasons`, gerida
-- pelo admin em Configurações > Motivos da perda.
--
-- - deals.lost_reason (enum)            -> deals.lost_reason_id (FK, ON DELETE RESTRICT:
--   motivo em uso não pode ser excluído; use "desativar").
-- - deal_status_history.reason (enum)   -> reason_id (FK, SET NULL) + reason_name
--   (nome gravado no momento, sobrevive a renomear/excluir o motivo).
-- - O enum antigo e as colunas antigas ficam sem uso (remoção adiada, ver fim do arquivo).
--
-- Reversão: supabase/rollbacks/0026_lost_reasons.down.sql

create table lost_reasons (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) > 0),
  is_active boolean not null default true,
  order_index integer not null default 0,
  created_at timestamptz not null default now()
);

create unique index lost_reasons_name_key on lost_reasons (lower(btrim(name)));

alter table lost_reasons enable row level security;

create policy "lost_reasons_select_all" on lost_reasons for select
  using (true);
create policy "lost_reasons_admin_insert" on lost_reasons for insert
  with check ((select public.is_admin()));
create policy "lost_reasons_admin_update" on lost_reasons for update
  using ((select public.is_admin()))
  with check ((select public.is_admin()));
create policy "lost_reasons_admin_delete" on lost_reasons for delete
  using ((select public.is_admin()));

-- Motivos que já existiam no enum (mesma ordem e rótulos da UI)
insert into lost_reasons (name, order_index) values
  ('Sem retorno', 0),
  ('Preço', 1),
  ('Fechou com concorrente', 2),
  ('Não possui interesse', 3),
  ('Contratação adiada', 4),
  ('Fora do perfil', 5),
  ('Dados incorretos', 6),
  ('Outro motivo', 7);

-- deals ---------------------------------------------------------------------

alter table deals
  add column lost_reason_id uuid references lost_reasons (id) on delete restrict;
create index deals_lost_reason_id_idx on deals (lost_reason_id);

update deals d
set lost_reason_id = r.id
from lost_reasons r
where d.lost_reason is not null
  and r.name = case d.lost_reason::text
    when 'sem_retorno' then 'Sem retorno'
    when 'preco' then 'Preço'
    when 'concorrente' then 'Fechou com concorrente'
    when 'sem_interesse' then 'Não possui interesse'
    when 'contratacao_adiada' then 'Contratação adiada'
    when 'fora_perfil' then 'Fora do perfil'
    when 'dados_incorretos' then 'Dados incorretos'
    else 'Outro motivo'
  end;

-- deal_status_history -------------------------------------------------------

alter table deal_status_history
  add column reason_id uuid references lost_reasons (id) on delete set null,
  add column reason_name text;
create index deal_status_history_reason_id_idx on deal_status_history (reason_id);

update deal_status_history h
set reason_id = r.id, reason_name = r.name
from lost_reasons r
where h.reason is not null
  and r.name = case h.reason::text
    when 'sem_retorno' then 'Sem retorno'
    when 'preco' then 'Preço'
    when 'concorrente' then 'Fechou com concorrente'
    when 'sem_interesse' then 'Não possui interesse'
    when 'contratacao_adiada' then 'Contratação adiada'
    when 'fora_perfil' then 'Fora do perfil'
    when 'dados_incorretos' then 'Dados incorretos'
    else 'Outro motivo'
  end;

-- As colunas antigas (deals.lost_reason, deal_status_history.reason) e o enum
-- `lost_reason` ficam SEM USO. O DROP COLUMN deu timeout no projeto de produção;
-- remover em uma migration futura, em janela de baixo uso:
--   alter table deals drop column lost_reason;
--   alter table deal_status_history drop column reason;
--   drop type lost_reason;
