# Correção Estrutural do Módulo Financeiro

## Problema

Os cards (Paid / Past Due / Failed / Unpaid) hoje somam tentativas Stripe e retries, inflando valores. Precisamos separar **dívida do membro** (semanal fixa de $20) de **eventos Stripe** (tentativas/falhas).

## Solução: Ledger semanal por membro

### 1. Nova tabela `member_financial_ledger`

Uma linha por membro × semana (segunda-feira como `week_reference`):

| Campo | Tipo |
|---|---|
| id | uuid |
| member_id | uuid |
| week_reference | date (segunda da semana) |
| amount_due | numeric (default 20) |
| amount_paid | numeric (default 0) |
| balance | numeric generated (`amount_paid - amount_due`) |
| payment_status | enum: `paid`, `partial`, `pending`, `overdue`, `failed` |
| stripe_payment_intent | text nullable |
| created_at, updated_at | timestamptz |

Unique `(member_id, week_reference)`. RLS: staff manage all; member SELECT próprio.

### 2. Geração automática semanal

- Função `generate_weekly_ledger_entries()`: para cada membro `active` (não arquivado), garante 1 entrada para a semana atual com `amount_due = weekly_contribution_usd OR 20`, status `pending`.
- Função `backfill_member_ledger(member_id)`: cria entradas desde `created_at` (ou ativação) do membro até hoje.
- Aplicação de pagamentos: função `apply_payment_to_ledger(payment_id)` que distribui `amount` em ordem cronológica nas semanas em débito, atualizando `amount_paid` e `payment_status`.
- Trigger em `payments` (INSERT/UPDATE para status `paid`) chama `apply_payment_to_ledger`.
- Trigger em `members` (INSERT active) chama backfill.
- Backfill inicial via migration para todos os membros ativos atuais.

Stripe retries **não** criam entradas no ledger — apenas atualizam `stripe_payment_intent` da última semana em aberto e marcam `failed` se a tentativa falhou definitivamente.

### 3. Status calculado

Por membro, agregando ledger:
- `weeks_overdue` = count de linhas com `balance < 0`
- `balance_total` = sum(amount_paid) − sum(amount_due)
- `status_financeiro`:
  - `paid` se balance ≥ 0
  - `overdue` se −20 ≥ balance > −60 (1–2 semanas)
  - `late` se −60 ≥ balance > −120 (3–5 semanas)
  - `critical` se balance ≤ −120 (6+ semanas)

### 4. Cards do dashboard/members

Recalcular usando agregações do ledger (membros únicos, nunca tentativas Stripe):

- **Paid**: count de membros com balance ≥ 0; sum de `amount_paid` confirmado.
- **Past Due**: count membros com balance < 0; sum de `weeks_overdue`; valor real devido (`−sum(balance<0)`).
- **Failed**: count membros únicos com pelo menos 1 ledger `failed`; count tentativas Stripe (de `payments` com status failed); count semanas vencidas com falha; valor devido real. Clicável → abre tabela detalhada (Nome | Tentativas | Semanas | Devido).
- **Unpaid**: membros com `amount_paid` total = 0 e pelo menos 1 semana acumulada.

### 5. Tabela de membros

Substituir colunas `Weekly`/`Monthly` por:

| Nome | Weekly Due | Balance | Status | Last Payment |

Status colorido conforme regras acima (verde/amarelo/vermelho/vermelho-escuro).

### 6. Drawer "Failed" detalhado

Ao clicar no card Failed, abrir modal com tabela de membros afetados e suas métricas reais (separa retries de dívida real).

## Arquivos a alterar/criar

1. **Migration** — `member_financial_ledger` + enum + RLS + funções `generate_weekly_ledger_entries`, `backfill_member_ledger`, `apply_payment_to_ledger` + triggers + backfill inicial.
2. **`src/lib/financialLedger.ts`** (novo) — helpers de leitura: `getMemberBalance`, `getFinancialCardStats`, `getFailedMembersDetail`, classificador de status.
3. **`src/routes/dashboard.tsx`** — cards Paid/Past Due/Failed/Unpaid usando novos stats; cards clicáveis com navegação.
4. **`src/routes/members.index.tsx`** — colunas Weekly Due / Balance / Status / Last Payment; modal detalhado quando filtro `fin=failed`.
5. **`src/components/FailedPaymentsDrawer.tsx`** (novo) — tabela detalhada por membro.
6. **i18n** (en/pt/es) — novas chaves: `weeklyDue`, `balance`, `weeksOverdue`, `stripeAttempts`, `membersAffected`, status labels.

## Fora do escopo (não tocar)

- Autenticação / login
- Arquitetura Stripe / webhook / checkout
- Relações familiares / `payment_relationships`
- Outras rotas (portal, reports, engagement, etc.)

## Observações técnicas

- Triggers usam `SECURITY DEFINER` + `SET search_path = public`.
- `week_reference` é sempre a segunda-feira (`date_trunc('week', current_date)::date`).
- `apply_payment_to_ledger` é idempotente (usa `payment_id` para evitar dupla aplicação — coluna `applied_payment_ids uuid[]` no ledger ou tabela `ledger_payment_applications`).
