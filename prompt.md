Prompt de Desenvolvimento — CRM Grupo Mave (inspirado no Pipedrive)

Cole este prompt inteiro em uma ferramenta de desenvolvimento assistido por IA (Claude Code, Cursor, v0, Lovable, Bolt etc.) para gerar o projeto. Ajuste os trechos marcados com [[ ... ]] antes de usar.

1. Objetivo

Desenvolver um CRM web (SaaS interno) para o Grupo Mave, replicando a estrutura funcional, fluxo de navegação e lógica de UX do Pipedrive (pipeline visual de negócios em Kanban, gestão de contatos/organizações, atividades, automações e relatórios), mas com identidade visual própria do Grupo Mave (logo, cores, tipografia da marca) no lugar da marca Pipedrive.

Não copiar textos, ícones proprietários, ilustrações ou código-fonte do Pipedrive — replicar apenas o padrão de layout e comportamento (estrutura de telas, tipos de componentes, fluxo de uso), que são padrões comuns de UX em ferramentas de CRM.

Referências de uso (apenas para entender o padrão de navegação, não para copiar visualmente):

https://www.pipedrive.com/pt/
https://pipedigital.com.br/tutoriais-pipedrive
2. Stack técnica obrigatória
Frontend: Next.js 14+ (App Router) + React + TypeScript + Tailwind CSS
Componentes: shadcn/ui como base, customizado com o design system do Grupo Mave (seção 5)
Backend / Banco de dados: Supabase (Postgres + Auth + Row Level Security + Storage + Realtime)
Hospedagem: Vercel (deploy contínuo via Git)
Autenticação: Supabase Auth (e-mail/senha + opção de login corporativo via Microsoft 365, já que o Grupo Mave usa M365)
Drag-and-drop do Kanban: @dnd-kit ou react-beautiful-dnd
Gráficos/relatórios: recharts
Formulários: react-hook-form + zod
Notificações em tempo real: Supabase Realtime (mudanças de pipeline, novas atividades, menções)
3. Estrutura de módulos (replicando a navegação do Pipedrive)
3.1 Barra lateral (sidebar fixa, ícones + labels)
Dashboard — visão geral (metas, atividades do dia, negócios parados, funil resumido)
Negócios (Pipeline) — visão Kanban por estágio, arrastar e soltar cards entre colunas
Leads (Caixa de entrada de leads) — leads não qualificados antes de virarem negócio
Contatos
Pessoas
Organizações/Empresas
Atividades / Agenda — lista + visão de calendário (reuniões, ligações, tarefas, e-mails)
Automações — regras "quando X acontece, faça Y" (ex.: negócio muda de estágio → cria tarefa)
Relatórios / Insights — funil de conversão, previsão de receita, desempenho por vendedor
Configurações
Usuários e permissões
Pipelines e estágios customizáveis
Campos customizados
Integrações (e-mail, WhatsApp, calendário)
Identidade visual (logo, cores — ver seção 5)
3.2 Topo da tela (header global)
Logo do Grupo Mave à esquerda (clicável → Dashboard)
Busca global (atalho tipo Cmd/Ctrl+K)
Botão "+" de criação rápida (novo negócio, contato, atividade)
Sino de notificações
Avatar do usuário com menu (perfil, tema claro/escuro, sair)
3.3 Tela de Pipeline (núcleo do sistema, estilo Kanban do Pipedrive)
Colunas = estágios do funil (ex.: Novo Lead → Qualificação → Proposta Enviada → Negociação → Fechado Ganho / Fechado Perdido)
Cada card mostra: nome do negócio, valor (R$), organização, próxima atividade agendada, avatar do responsável
Drag-and-drop entre colunas atualiza o estágio no banco em tempo real
Barra de progresso/valor total por coluna no topo de cada estágio
Filtros: por responsável, por período, por valor, por origem do lead
Alternância de visão: Kanban ↔ Lista ↔ Fluxo (forecast)
3.4 Ficha de detalhe (negócio / contato / organização)
Painel lateral ou tela dedicada com abas: Visão geral, Atividades, E-mails, Notas, Arquivos, Histórico
Timeline cronológica de interações
Campos customizáveis por tipo de registro
4. Modelo de dados sugerido (Supabase / Postgres)
sql
-- Empresas/Organizações
organizations (id, name, cnpj, address, sector, owner_id, created_at)

-- Pessoas de contato
contacts (id, name, email, phone, organization_id, owner_id, created_at)

-- Pipelines customizáveis
pipelines (id, name, is_default)
pipeline_stages (id, pipeline_id, name, order_index, rotting_days)

-- Negócios (o coração do CRM)
deals (id, title, value, currency, pipeline_id, stage_id, contact_id,
       organization_id, owner_id, status, expected_close_date,
       source, created_at, updated_at)

-- Leads não qualificados
leads (id, name, contact_info, source, status, converted_deal_id, created_at)

-- Atividades (tarefas, ligações, reuniões, e-mails)
activities (id, type, subject, due_date, done, deal_id, contact_id,
            owner_id, created_at)

-- Notas (conteúdo escrito pelo usuário; mentioned_user_ids alimenta notificações de menção)
notes (id, content, deal_id, contact_id, mentioned_user_ids, author_id, created_at)

-- Campos customizados por tipo de registro (deal | contact | organization)
custom_fields (id, entity_type, label, field_type, options_json, required, order_index)
custom_field_values (id, custom_field_id, entity_type, entity_id, value)

-- Arquivos anexados (metadados; o binário fica no Supabase Storage)
attachments (id, entity_type, entity_id, file_name, storage_path, size_bytes, uploaded_by, created_at)

-- Log de auditoria (timeline automática de mudanças — alimenta a aba "Histórico", distinta das notas manuais)
deal_stage_history (id, deal_id, from_stage_id, to_stage_id, changed_by, changed_at)

-- Notificações (sino de notificações no header; realtime via Supabase)
notifications (id, user_id, type, entity_type, entity_id, message, read, created_at)

-- Automações
automation_rules (id, trigger_event, conditions_json, actions_json, active)

-- Usuários e permissões (referenciam auth.users do Supabase)
profiles (id references auth.users, full_name, role, team_id, avatar_url)
teams (id, name, manager_id)

profiles.role deve ser um enum Postgres restrito aos 3 papéis (evita valores inconsistentes):
create type user_role as enum ('admin', 'gestor', 'vendedor');

entity_type (em custom_field_values, attachments e notifications) deve ser um enum restrito: 'deal' | 'contact' | 'organization'.

Exemplo de shape para automation_rules — sem isso a IA tende a montar só a tela, sem lógica real por trás:

json
// conditions_json — exemplo: negócio muda para o estágio "Fechado Ganho"
{ "to_stage_id": "uuid-do-estagio-fechado-ganho" }

// actions_json — lista de ações executadas em sequência
[
  { "type": "create_activity", "activity_type": "task", "subject": "Enviar contrato", "due_in_days": 1 },
  { "type": "notify_user", "user_id": "owner", "message": "Negócio {{deal.title}} fechado!" }
]

trigger_event (valores fixos na v1): "deal_stage_changed" | "deal_created" | "activity_overdue"
actions_json[].type (valores fixos na v1): "create_activity" | "notify_user" | "assign_owner"

Habilitar Row Level Security (RLS) em todas as tabelas: cada usuário só vê/edita os registros da própria equipe, exceto administradores (papel admin).

5. Identidade visual (substituindo a marca Pipedrive pela do Grupo Mave)

Arquivos do logo já disponíveis em /LOGOS (versões colorida e P&B, orientações faixa-acima/direita/esquerda). Cores extraídas por amostragem de pixel do arquivo logo_faixa-direita_(PNG).png (2542x686px):

Cor primária da marca: #255474 (azul-marinho — cor dominante do logo, usada no texto "GRUPO MAVE" e na faixa de fundo)
Cor secundária/de destaque: #F3D929 (amarelo — usada no emblema circular "Segurança e Serviços")
Cor terciária opcional (degradê do emblema): de #0492D5 a #2A5CAB (azul mais vibrante, usar com moderação — ex. gráficos/relatórios)
Fonte institucional: não identificada nos arquivos de logo — usar Inter como padrão neutro

Estrutura de tema (hex reais do Grupo Mave):

css
:root {
  --brand-primary: #255474;
  --brand-primary-hover: #1E455F;
  --brand-secondary: #F3D929;
  --brand-accent: #0492D5;   /* opcional: gráficos, links secundários */
  --brand-success: #1FB37A;   /* fechado ganho */
  --brand-danger: #E5484D;    /* fechado perdido */
  --brand-neutral-bg: #F7F8FA;
  --brand-sidebar-bg: #FFFFFF;
  --brand-text: #1C1F23;
  --brand-font: 'Inter', sans-serif;
}

/* Tema escuro (o menu do avatar promete alternância claro/escuro — precisa destes tokens) */
[data-theme="dark"] {
  --brand-primary: #4A8CB0;
  --brand-primary-hover: #5FA0C4;
  --brand-secondary: #F3D929;
  --brand-accent: #4FB4E8;
  --brand-success: #2ECC8F;
  --brand-danger: #F0616A;
  --brand-neutral-bg: #12161C;
  --brand-sidebar-bg: #1A1F27;
  --brand-text: #E8EAED;
}

⚠️ Pendência de asset: nenhum arquivo em /LOGOS é um ícone quadrado isolado (todos são lockups horizontais — faixa-acima/direita/esquerda). Para favicon e ícone de app, recortar apenas o emblema circular ("Segurança e Serviços") de um dos PNGs em proporção 1:1, ou solicitar ao Grupo Mave um arquivo de marca isolada.

Diretrizes de aplicação:

Sidebar com o logo do Grupo Mave no topo (light/dark mode)
Cor primária (--brand-primary, azul-marinho) nos botões de ação principal, nos indicadores de estágio ativo do pipeline e nos links
Cor secundária (--brand-secondary, amarelo) usar apenas como destaque pontual (badges, ícone ativo, hover sutil) — nunca como fundo de texto por questão de contraste/acessibilidade (usar --brand-text ou preto sobre o amarelo, nunca branco)
Favicon e título da aba do navegador com o nome "Grupo Mave CRM"
Tela de login com o logo centralizado sobre a cor de fundo institucional
6. Autenticação e permissões
Login via Supabase Auth (e-mail corporativo @grupomave.com.br)
Cadastro fechado: não há tela pública de signup — apenas admin convida novos usuários (Supabase Auth admin invite / magic link), já criando o registro correspondente em profiles
Login corporativo via M365 requer pré-requisito externo ao código: registro do app no Azure AD (client ID, client secret, tenant ID) configurado antes de habilitar o provider "azure" no Supabase Auth — sem isso, implementar apenas o botão desabilitado/placeholder
Papéis: admin, gestor, vendedor
admin: acesso total, configura pipelines e automações
gestor: vê negócios da própria equipe, gera relatórios
vendedor: vê e edita apenas seus próprios negócios/contatos
Políticas RLS no Supabase refletindo essa hierarquia. Exemplos de policy para a tabela deals (aplicar padrão análogo em contacts, organizations, activities, notes):

sql
-- Vendedor vê e edita apenas os próprios negócios
create policy "vendedor_own_deals" on deals
  for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- Gestor vê os negócios de toda a equipe (via profiles.team_id)
create policy "gestor_team_deals" on deals
  for select
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.role = 'gestor'
        and p.team_id = (select team_id from profiles where id = deals.owner_id)
    )
  );

-- Admin tem acesso total
create policy "admin_all_deals" on deals
  for all
  using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));
7. Requisitos de deploy (Vercel + Supabase)
Repositório Git conectado à Vercel com deploy automático a cada push na branch principal
Variáveis de ambiente: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY (apenas em rotas server-side/edge functions)
Ambientes separados: Preview (branches) e Production (main)
Supabase Storage para armazenar arquivos anexados a negócios/contatos e o logo institucional
8. Entregáveis esperados da ferramenta de IA
Estrutura de pastas do projeto Next.js
Schema SQL completo com RLS para Supabase (migrations)
Telas: Login, Dashboard, Pipeline (Kanban), Contatos, Leads, Atividades/Agenda, Relatórios, Configurações
Componentes reutilizáveis de card de negócio, modal de criação rápida, timeline de atividades
Tema visual aplicando a identidade do Grupo Mave (seção 5)
Instruções de deploy na Vercel conectado ao Supabase
9. Fora de escopo nesta primeira versão
Integração completa de e-mail (IMAP/SMTP) — deixar estrutura pronta, mas não implementar nesta fase
App mobile nativo
Telefonia integrada (VoIP)
10. Critérios de aceite (paridade de padrão de UX, não visual, com o Pipedrive)

Checklist de comportamento funcional a validar após a implementação. O objetivo é confirmar que o CRM segue o mesmo padrão de fluxo/UX descrito na seção 3 — não comparar aparência com o Pipedrive.

Navegação global
[ ] Sidebar fixa com os 8 módulos da seção 3.1, ícone + label, item ativo destacado com --brand-primary
[ ] Header: logo (→ Dashboard), busca global (Cmd/Ctrl+K), botão "+" de criação rápida, sino de notificações, avatar com menu (perfil, tema, sair)
[ ] Alternância claro/escuro funcional em toda a interface (usando os tokens da seção 5)

Pipeline (Kanban)
[ ] Colunas = estágios do pipeline ativo; card mostra nome, valor (R$), organização, próxima atividade, avatar do responsável
[ ] Arrastar um card para outra coluna atualiza stage_id no banco e reflete via Realtime em outra sessão aberta, sem reload
[ ] Topo de cada coluna mostra valor total somado dos cards nela
[ ] Filtros por responsável, período, valor e origem alteram os cards exibidos
[ ] Alternância de visão Kanban / Lista / Fluxo (forecast) preserva os mesmos filtros ativos

Ficha de detalhe (negócio / contato / organização)
[ ] Abas Visão geral, Atividades, E-mails, Notas, Arquivos, Histórico presentes e navegáveis
[ ] Aba Histórico mostra mudanças de estágio automaticamente (via deal_stage_history), não apenas notas manuais
[ ] Aba Arquivos permite upload e exibe anexos vinculados ao registro (via attachments + Supabase Storage)
[ ] Campos customizados configurados em Configurações aparecem e são editáveis na ficha do tipo de registro correspondente

Automações e notificações
[ ] Criar uma regra com trigger_event = deal_stage_changed e testá-la: mudar o estágio de um negócio dispara de fato a ação configurada (ex: cria activity ou gera notification) — não é só uma tela sem efeito
[ ] Sino de notificações recebe evento em tempo real (Realtime) ao ocorrer o trigger, sem precisar recarregar a página

Permissões (RLS)
[ ] Logado como vendedor: só vê/edita negócios/contatos onde owner_id é o próprio usuário
[ ] Logado como gestor: vê (mas não necessariamente edita) os negócios de toda a equipe (mesmo team_id)
[ ] Logado como admin: acesso total, incluindo telas de Configurações (pipelines, campos customizados, usuários)
[ ] Tentar acessar via API/URL direta um registro fora da própria equipe retorna vazio/negado, não erro 500