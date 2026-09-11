# Grupo Mave CRM

CRM web interno do Grupo Mave, inspirado no padrão de navegação do Pipedrive
(pipeline visual em Kanban, contatos/organizações, atividades, automações e
relatórios), com identidade visual própria. Especificação completa em
[`prompt.md`](./prompt.md).

## Stack

- Next.js 16 (App Router) + React 18 + TypeScript + Tailwind CSS v4
- Supabase (Postgres + Auth + Row Level Security + Storage + Realtime)
- dnd-kit (Kanban), recharts (relatórios), react-hook-form + zod (formulários)
- Componentes de UI próprios no estilo shadcn/ui, sobre Radix UI

## 1. Configurar o Supabase

1. Crie um projeto em [supabase.com](https://supabase.com).
2. Rode as migrations em `supabase/migrations/` **na ordem numérica**, pelo
   SQL Editor do painel ou via Supabase CLI:

   ```bash
   supabase link --project-ref <seu-project-ref>
   supabase db push
   ```

   As migrations criam: enums, todas as tabelas do schema (seção 4 do
   `prompt.md`), as políticas de RLS (admin/gestor/vendedor), o motor de
   automações (gatilhos que realmente executam as regras — não é só uma
   tela), a sincronia de `deals.status` com o estágio "Fechado Ganho/Perdido",
   o pipeline padrão com os 6 estágios, e o bucket de Storage `attachments`.

3. **Cadastro de usuários**: não há tela pública de signup — login é
   somente e-mail/senha, sem SSO. Convide usuários
   pelo painel do Supabase (Authentication > Users > Invite) — um `profile`
   é criado automaticamente (papel padrão `vendedor`). Promova o primeiro
   usuário a `admin` rodando no SQL Editor:

   ```sql
   update profiles set role = 'admin' where id = '<uuid-do-usuário>';
   ```

5. Rodar `select public.run_activity_overdue_check();` periodicamente para a
   automação de "atividade atrasada" funcionar — via `pg_cron` (se
   disponível no seu plano) ou uma Edge Function agendada. Ver comentário no
   topo de `supabase/migrations/0004_automation_engine.sql`.

## 2. Rodar localmente

```bash
npm install
cp .env.local.example .env.local
# preencha NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY
npm run dev
```

Acesse `http://localhost:3000` — você será redirecionado para `/login`.

## 3. Deploy (Vercel + Supabase)

1. Conecte o repositório Git a um novo projeto na Vercel.
2. Configure as variáveis de ambiente no projeto Vercel:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (só se/quando alguma rota server-side
     precisar ignorar RLS — nenhuma rota atual usa; não exponha no cliente)
3. Cada push na branch principal faz deploy em produção; branches gerem
   Preview Deployments automaticamente (padrão da Vercel).

## Estrutura do projeto

```
src/app/(dashboard)/   páginas autenticadas (sidebar + header)
src/app/login/         tela de login
src/components/ui/     kit de componentes (botão, card, dialog, tabs...)
src/components/layout/ sidebar, header, busca (Cmd/Ctrl+K), notificações
src/components/forms/  diálogos de criação (negócio, contato, organização...)
src/components/pipeline/ quadro Kanban (dnd-kit) e seus subcomponentes
src/lib/supabase/      clientes Supabase (browser, server, middleware) + tipos
supabase/migrations/   schema SQL completo, RLS, motor de automações, seed
```

## O que está implementado

Todos os módulos da seção 3 do `prompt.md` com dados reais do Supabase:
Dashboard, Pipeline (Kanban com drag-and-drop + Realtime), Leads, Contatos
(Pessoas/Organizações), Atividades, Automações (com motor de execução real
via gatilho Postgres), Relatórios, Configurações (usuários/papéis,
pipelines/estágios, campos customizados), e a ficha de detalhe do negócio
com as 5 abas (Visão geral, Atividades, Notas, Arquivos, Histórico).

Use o checklist da seção 10 do `prompt.md` para validar o comportamento
funcional depois de configurar o Supabase.

## Limitações conhecidas (v1)

- Integração de e-mail (IMAP/SMTP), app mobile nativo e telefonia (VoIP)
  estão fora de escopo (seção 9 do `prompt.md`).
- A visão de calendário em Atividades/Agenda é uma lista, não um calendário
  visual mês/semana.
- `custom_field_values` usa uma política de RLS simplificada (qualquer
  usuário autenticado lê/escreve) — ver comentário em
  `supabase/migrations/0003_rls.sql`.
- Você verá 2 avisos (não erros) do `next lint` sobre o React Compiler não
  conseguir memoizar componentes que usam `watch()` do react-hook-form —
  é uma limitação conhecida da combinação dessas duas bibliotecas, sem
  impacto de corretude.
