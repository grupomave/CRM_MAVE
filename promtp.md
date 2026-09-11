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

-- Notas e histórico
notes (id, content, deal_id, contact_id, author_id, created_at)

-- Automações
automation_rules (id, trigger_event, conditions_json, actions_json, active)

-- Usuários e permissões (referenciam auth.users do Supabase)
profiles (id references auth.users, full_name, role, team_id, avatar_url)
teams (id, name, manager_id)

Habilitar Row Level Security (RLS) em todas as tabelas: cada usuário só vê/edita os registros da própria equipe, exceto administradores (papel admin).

5. Identidade visual (substituindo a marca Pipedrive pela do Grupo Mave)

⚠️ Não consegui acessar automaticamente grupomave.com.br para extrair o logo e os códigos de cor exatos. Antes de gerar a interface, informe (ou peça para a ferramenta de IA usar como placeholders até você substituir):

Arquivo do logo (SVG/PNG, fundo transparente, versão colorida e versão monocromática branca)
Cor primária da marca (hex)
Cor secundária/de destaque (hex)
Fonte institucional, se houver (ou usar Inter/Manrope como padrão neutro)

Estrutura de tema sugerida (ajustar hex reais do Grupo Mave):

css
:root {
  --brand-primary: #[[HEX_PRIMARIA_GRUPOMAVE]];
  --brand-primary-hover: #[[HEX_PRIMARIA_ESCURA]];
  --brand-secondary: #[[HEX_SECUNDARIA_GRUPOMAVE]];
  --brand-success: #1FB37A;   /* fechado ganho */
  --brand-danger: #E5484D;    /* fechado perdido */
  --brand-neutral-bg: #F7F8FA;
  --brand-sidebar-bg: #FFFFFF;
  --brand-text: #1C1F23;
  --brand-font: 'Inter', sans-serif;
}

Diretrizes de aplicação:

Sidebar com o logo do Grupo Mave no topo (light/dark mode)
Cor primária da marca nos botões de ação principal, nos indicadores de estágio ativo do pipeline e nos links
Favicon e título da aba do navegador com o nome "Grupo Mave CRM"
Tela de login com o logo centralizado sobre a cor de fundo institucional
6. Autenticação e permissões
Login via Supabase Auth (e-mail corporativo @grupomave.com.br)
Papéis: admin, gestor, vendedor
admin: acesso total, configura pipelines e automações
gestor: vê negócios da própria equipe, gera relatórios
vendedor: vê e edita apenas seus próprios negócios/contatos
Políticas RLS no Supabase refletindo essa hierarquia
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