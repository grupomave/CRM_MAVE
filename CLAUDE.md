@AGENTS.md

# Padrões de UI

Design system do CRM Grupo Mave. Toda tela nova ou alterada segue estas regras.

## Tokens (src/app/globals.css)
- **Nunca** use hex, `rgb()` ou px avulsos em componentes. A paleta padrão do Tailwind foi removida
  (`--color-*: initial`): `bg-red-500`, `text-amber-600` etc. **não geram CSS**. Use só os tokens.
- Cores:
  - **Superfícies:** `background` (off-white), `card`, `muted`, `border`, `border-strong`, `input`, `overlay`.
  - **Texto:** `foreground` e `muted-foreground`.
  - **Marca:** uma cor, `primary` (#255474, azul Mave), com `primary-hover`, `primary-subtle` e
    `primary-foreground`. `brand-yellow` só aparece na tela de login.
  - **Semânticas:** `success`, `warning`, `destructive`, `info` e `stagnant` (negócio estagnado), cada uma
    com `-subtle` (fundo de badge) e `-strong` (texto sobre o subtle, contraste AA).
  - **Gráficos:** `chart-1` a `chart-6`, em ordem fixa de séries.
- Tipografia (Inter): `text-micro` (11px, mínimo absoluto), `text-caption` (12), `text-sm`/`text-body` (14),
  `text-subtitle` (16/600), `text-title` (22/600, título de página) e `text-display` (28/600, KPIs).
- Números e dinheiro sempre com a classe `numeric` (tabular-nums) e alinhados à direita em tabelas.
- Raios: `rounded-sm/md/lg/xl`. Sombras: `shadow-xs` (cards), `shadow-md` (menus), `shadow-lg`
  (modais e toasts).
- Espaçamento em múltiplos de 4px (escala do Tailwind). Largura máxima: `max-w-form` para formulários e
  `max-w-detail` para telas de detalhe.
- Movimento: transições de 150–200ms (padrão do tema). `prefers-reduced-motion` é respeitado globalmente.
- Modo escuro: os mesmos tokens são redefinidos em `[data-theme="dark"]`. O padrão segue o sistema
  operacional; o menu do usuário tem Sistema/Claro/Escuro. Não use `dark:` para cor, use tokens.

## Componentes (src/components/ui, src/components/list)
- `Button`:
  - Variantes: `default` (primário, uma ação principal por área), `secondary`, `ghost`, `destructive`,
    `destructive-outline`, `success` e `link`.
  - Tamanhos: `xs`, `sm`, `default`, `lg` e `icon*`.
  - Use `loading` em vez de trocar o texto do botão.
- Ícones: somente `lucide-react`. Um ícone por conceito: Negócios = `KanbanSquare`, Leads = `Inbox`,
  Pessoas = `Users`, Organizações = `Building2`, Atividades = `CalendarClock`, criar = `Plus`,
  ações de linha = `MoreHorizontal`.
- Estrutura de página: todas as telas começam com `PageHeader` (título, descrição, `breadcrumbs`,
  `actions` à direita). Detalhes usam duas colunas que empilham no mobile.
- Listagens:
  - Componentes: `Table` (`stickyHeader`), `SortableHead`, `ListToolbar` + `SearchInput` + `FilterSelect`
    + `FilterToggle`, `FilterChips`, `Pagination`, `BulkActionBar` + `useRowSelection` e `TableRowActions`
    (menu "⋯").
  - Filtros, busca, ordenação e página ficam **na URL** (`useListParams`).
  - A lógica de filtrar e ordenar mora em `src/lib/filters/<entidade>.ts` (funções puras) e os
    carregadores em `src/lib/data/lists.ts`. A exportação reutiliza os mesmos: nunca duplique filtro no
    componente.
- Formulários:
  - Use `FormField` (label acima, `required` marca com *, `error`/`hint` inline).
  - Campos: `Input`, `MaskedInput` (cpf, cnpj, cpf-cnpj, phone, cep), `CurrencyInput` (R$),
    `DateInput` (dd/mm/aaaa; recebe e devolve ISO), `Combobox` (listas longas) e `Select` (listas curtas).
  - Validações em `src/lib/masks.ts` (CPF, CNPJ, telefone). Formulários de edição têm "Salvar" desabilitado
    sem alterações e "Descartar".
- Feedback:
  - `toast.success/error/warning/info` (`@/lib/toast`), com `friendlyError(error)` na descrição.
    Nunca use `alert()`.
  - Ações destrutivas ou em massa usam `await confirmDialog({ ..., destructive: true })`. Nunca use
    `window.confirm`.
- Estados:
  - Vazio: `EmptyState` com ícone, texto e ação.
  - Carregando: `Skeleton`/`TableSkeleton` em `loading.tsx`; não use spinner genérico.
  - Erro: `error.tsx`/`not-found.tsx` com `StatusPage`.
- Indicadores e gráficos: `KpiCard` (valor, variação e período). Gráficos Recharts usam
  `src/components/charts/chart-theme.tsx` (`AXIS_PROPS`, `GRID_STROKE`, `ChartTooltip` formatado em pt-BR).
- Outros: `Badge` semântico (`success`, `warning`, `destructive`, `info`, `stagnant`, `neutral`) e
  `UserAvatar` (iniciais + tooltip) para responsáveis.

## Regras de conteúdo
- Todo texto de interface em português do Brasil. Moeda com `formatCurrencyBRL`, datas dd/mm/aaaa com
  `formatDate`.
- Datas sem hora (`date` do Postgres, ex.: `expected_close_date`) devem ser formatadas como
  `formatDate(\`${iso}T12:00:00\`)`. Sem isso, o fuso UTC mostra o dia anterior.
- Data/hora digitada pelo usuário deve ser montada no fuso local e enviada com `toISOString()`.
- Acessibilidade:
  - Contraste AA.
  - Foco visível (`focus-visible:ring`).
  - `aria-label` em botões só de ícone.
  - Um `htmlFor`/`id` por campo.
- Toda mutação no Supabase trata `error` (toast) e depois chama `router.refresh()`. Evite
  `window.location.reload()`.
