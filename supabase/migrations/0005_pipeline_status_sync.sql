-- Sincroniza deals.status com o estágio: quando o negócio é arrastado para
-- o estágio "Fechado Ganho"/"Fechado Perdido" (nomes do seed em
-- 0006_seed.sql), o status muda junto — senão os relatórios e o filtro
-- "negócios em aberto" ficariam dessincronizados do quadro Kanban.
--
-- Acoplamento por nome de estágio é uma simplificação da v1: se o nome do
-- estágio for alterado em Configurações, atualize os literais abaixo.

create function public.sync_deal_status_with_stage()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  stage_name text;
begin
  select name into stage_name from pipeline_stages where id = new.stage_id;

  new.status := case
    when stage_name = 'Fechado Ganho' then 'won'
    when stage_name = 'Fechado Perdido' then 'lost'
    else 'open'
  end;

  return new;
end;
$$;

create trigger deals_sync_status_before_write
  before insert or update of stage_id on deals
  for each row execute procedure public.sync_deal_status_with_stage();
