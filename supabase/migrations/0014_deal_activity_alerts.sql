-- Alertas de atividade atrasada / sem próxima atividade / negócio estagnado
-- (docx "Estrutura Pipedrive" seção 5). Os dois primeiros são calculados em
-- tempo real na aplicação a partir de "activities" — não precisam de coluna.
-- O terceiro depende de "deals.last_activity_at", que precisa ser mantido
-- atualizado sempre que ocorrer uma das movimentações relevantes listadas no
-- docx: mudança de etapa, atividade concluída, novo comentário, arquivo
-- anexado, alteração dos dados, registro de ligação/e-mail.

-- Qualquer escrita em "deals" conta como "mudança de etapa" ou "alteração
-- dos dados" — cobre os dois primeiros eventos da lista de uma vez.
create function public.touch_deal_last_activity_on_deal_write()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  new.last_activity_at = now();
  return new;
end;
$$;

create trigger deals_touch_last_activity
  before insert or update on deals
  for each row execute procedure public.touch_deal_last_activity_on_deal_write();

-- Usado pelos triggers de tabelas relacionadas (activities/notes/attachments)
-- para "tocar" o negócio vinculado sem duplicar a lógica de update.
create function public.touch_deal_last_activity(p_deal_id uuid)
returns void
language sql security definer set search_path = public
as $$
  update deals set last_activity_at = now() where id = p_deal_id;
$$;

-- Atividade concluída, ou registro de ligação/e-mail (criação da atividade).
create function public.handle_activity_relevant_change()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.deal_id is not null then
    if tg_op = 'INSERT' and new.type in ('call', 'email') then
      perform public.touch_deal_last_activity(new.deal_id);
    elsif tg_op = 'UPDATE' and new.done = true and old.done = false then
      perform public.touch_deal_last_activity(new.deal_id);
    end if;
  end if;
  return new;
end;
$$;

create trigger activities_touch_deal_activity
  after insert or update of done on activities
  for each row execute procedure public.handle_activity_relevant_change();

-- Novo comentário (nota) no negócio.
create function public.handle_note_touch_deal()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.deal_id is not null then
    perform public.touch_deal_last_activity(new.deal_id);
  end if;
  return new;
end;
$$;

create trigger notes_touch_deal_activity
  after insert on notes
  for each row execute procedure public.handle_note_touch_deal();

-- Arquivo anexado ao negócio.
create function public.handle_attachment_touch_deal()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.entity_type = 'deal' then
    perform public.touch_deal_last_activity(new.entity_id);
  end if;
  return new;
end;
$$;

create trigger attachments_touch_deal_activity
  after insert on attachments
  for each row execute procedure public.handle_attachment_touch_deal();

-- Defesa em profundidade (mesmo padrão de 0008_harden_function_security.sql):
-- funções de trigger não precisam ser RPC pública; touch_deal_last_activity
-- não deveria ser chamável direto por um cliente autenticado (deixaria
-- qualquer usuário resetar o relógio de estagnação de qualquer negócio).
revoke execute on function public.touch_deal_last_activity_on_deal_write() from public, anon, authenticated;
revoke execute on function public.handle_activity_relevant_change() from public, anon, authenticated;
revoke execute on function public.handle_note_touch_deal() from public, anon, authenticated;
revoke execute on function public.handle_attachment_touch_deal() from public, anon, authenticated;
revoke execute on function public.touch_deal_last_activity(uuid) from public, anon, authenticated;

-- Prazos de estagnação por etapa (docx seção 2/5 — o administrador poderá
-- ajustar depois em Configurações → Pipelines). Etapas terminais/congeladas
-- ficam sem prazo (null = alerta de estagnação desativado nessa etapa).
update pipeline_stages set rotting_days = case name
  when 'Prospecção' then 7
  when 'Apresentação' then 10
  when 'Solicitação' then 7
  when 'Elaboração' then 10
  when 'Concluída' then 5
  when 'Revisão' then 5
  when 'Curto Prazo' then 30
  when 'Médio Prazo' then 60
  when 'Longo Prazo' then 90
  when 'Aceite' then 7
  when 'Entrega' then 15
  when 'Contato Realizado' then 7
  when 'Novo Prospect' then 5
  when 'Entrega de Proposta' then 10
  when 'Solicitação de Proposta' then 7
  when 'Elaboração de Proposta' then 10
  else rotting_days
end
where name in (
  'Prospecção', 'Apresentação', 'Solicitação', 'Elaboração', 'Concluída',
  'Revisão', 'Curto Prazo', 'Médio Prazo', 'Longo Prazo', 'Aceite',
  'Entrega', 'Contato Realizado', 'Novo Prospect', 'Entrega de Proposta',
  'Solicitação de Proposta', 'Elaboração de Proposta'
);
