-- Motor de automações (prompt.md seção 4 — "sem isso a IA tende a montar só
-- a tela, sem lógica real por trás"). Roda como gatilho no Postgres, já que
-- a stack não tem um worker/servidor Node separado: o Supabase É o backend.
--
-- actions_json[].type suportados na v1: create_activity | notify_user | assign_owner

create function public.apply_automation_actions(
  actions jsonb,
  p_deal_id uuid,
  p_deal_title text,
  p_owner_id uuid,
  executed_by uuid
)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  action jsonb;
  target_user uuid;
  rendered_message text;
begin
  for action in select * from jsonb_array_elements(actions)
  loop
    if action ->> 'type' = 'create_activity' then
      insert into activities (type, subject, due_date, deal_id, owner_id)
      values (
        coalesce((action ->> 'activity_type')::activity_type, 'task'),
        coalesce(action ->> 'subject', 'Tarefa gerada por automação'),
        now() + make_interval(days => coalesce((action ->> 'due_in_days')::int, 1)),
        p_deal_id,
        p_owner_id
      );

    elsif action ->> 'type' = 'notify_user' then
      target_user := case
        when action ->> 'user_id' = 'owner' then p_owner_id
        else nullif(action ->> 'user_id', '')::uuid
      end;

      rendered_message := replace(coalesce(action ->> 'message', ''), '{{deal.title}}', p_deal_title);

      if target_user is not null then
        insert into notifications (user_id, type, entity_type, entity_id, message)
        values (target_user, 'automation', 'deal', p_deal_id, rendered_message);
      end if;

    elsif action ->> 'type' = 'assign_owner' then
      target_user := nullif(action ->> 'user_id', '')::uuid;
      if target_user is not null and target_user <> p_owner_id then
        -- update por owner_id não reaciona o gatilho de mudança de estágio
        -- (esse gatilho só dispara em "update of stage_id").
        update deals set owner_id = target_user where id = p_deal_id;
      end if;
    end if;
  end loop;
end;
$$;

-- Trigger: negócio muda de estágio ------------------------------------------

create function public.handle_deal_stage_changed()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  rule record;
begin
  for rule in
    select * from automation_rules
    where active
      and trigger_event = 'deal_stage_changed'
      and (conditions_json ->> 'to_stage_id') = new.stage_id::text
  loop
    perform public.apply_automation_actions(
      rule.actions_json, new.id, new.title, new.owner_id, auth.uid()
    );
  end loop;
  return new;
end;
$$;

create trigger deals_automation_stage_changed
  after update of stage_id on deals
  for each row execute procedure public.handle_deal_stage_changed();

-- Trigger: negócio criado ----------------------------------------------------

create function public.handle_deal_created()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  rule record;
begin
  for rule in
    select * from automation_rules
    where active and trigger_event = 'deal_created'
  loop
    perform public.apply_automation_actions(
      rule.actions_json, new.id, new.title, new.owner_id, auth.uid()
    );
  end loop;
  return new;
end;
$$;

create trigger deals_automation_created
  after insert on deals
  for each row execute procedure public.handle_deal_created();

-- Atividade atrasada: não é disparada por uma mudança de linha específica,
-- então não dá pra ser um trigger comum — precisa rodar periodicamente.
-- Chame esta função via pg_cron (se disponível no projeto) ou por uma
-- Supabase Edge Function agendada (cron job no painel do Supabase):
--
--   select cron.schedule('activity-overdue-check', '*/15 * * * *',
--     $$select public.run_activity_overdue_check()$$);

create function public.run_activity_overdue_check()
returns void
language plpgsql security definer set search_path = public
as $$
declare
  rule record;
  activity record;
begin
  for rule in
    select * from automation_rules
    where active and trigger_event = 'activity_overdue'
  loop
    for activity in
      select a.*, d.title as deal_title, d.owner_id as deal_owner_id
      from activities a
      left join deals d on d.id = a.deal_id
      where a.done = false
        and a.due_date is not null
        and a.due_date < now()
    loop
      perform public.apply_automation_actions(
        rule.actions_json,
        activity.deal_id,
        coalesce(activity.deal_title, activity.subject),
        coalesce(activity.deal_owner_id, activity.owner_id),
        null
      );
    end loop;
  end loop;
end;
$$;
