# Plano — Relações Financeiras e Sponsor/Dependentes

## Resumo do que muda

Hoje a relação financeira existe via `family_role` (`family_owner`, `family_member`, `sponsored`, `individual`) e via `payment_relationships`. O usuário quer transformar isso numa hierarquia clara **Sponsor → Dependentes → Individual**, com:

- a seção "Relações Financeiras" **expandida inline** no perfil do membro (sem modal/drawer "Manage");
- **badges claras** (Sponsor / Dependent / Individual);
- **Total Paid consolidado** do sponsor (próprio + dependentes);
- distribuição automática de pagamento do sponsor entre ele e dependentes;
- histórico individual preservado, com tag "Paid by Sponsor".

## Escopo

### 1. Banco (migration única)

**Aproveitar `family_role` existente** + adicionar enum `'sponsor'` e `'dependent'` (mantendo compat). Mapping:
- `family_owner` / `sponsor` → **Sponsor**
- `family_member` / `sponsored` / `dependent` → **Dependente**
- `individual` → **Individual**

**Nova função `apply_payment_to_sponsor_family(_payment_id)`:**
- Se o pagamento é de um sponsor (family_owner) e `amount > weekly_due próprio`, distribui o excedente entre dependentes da mesma família em ordem cronológica do ledger (semanas mais antigas primeiro).
- Registra em `ledger_payment_applications` com `applied_to_member_id` para rastrear que foi "Paid by Sponsor".
- Acrescentar coluna `applied_to_member_id uuid` em `ledger_payment_applications` (nullable) — quando NULL é o próprio member do pagamento, quando preenchido é dependente.
- Trigger `trg_payments_to_ledger` passa a chamar a nova função no lugar de `apply_payment_to_ledger` para pagamentos de sponsor.

**View `member_financial_summary`:**
- `member_id, role (sponsor/dependent/individual), sponsor_id, total_paid_personal, total_paid_by_sponsor, total_paid_sponsor_family, balance, weeks_overdue, stripe_status`.

### 2. Frontend — perfil do membro (`src/routes/members.$memberId.tsx`)

- Substituir o card "Relações Financeiras" com o link **Manage →** por uma seção **inline expandida**:
  - **Cabeçalho**: nome do membro + badge (Sponsor / Dependent / Individual).
  - **Se Sponsor**: lista expandida de dependentes com status Stripe, total pago, balance, overdue. Mostra "Total Família: $X".
  - **Se Dependent**: mostra "Paid by: [Nome do Sponsor]" + próprio balance/histórico.
  - **Se Individual**: mostra apenas próprio status.
- Manter o componente `FinancialRelationshipsDrawer` só para edição (botão "Edit relationships" pequeno), já que ele tem busca/add/remove/role-change.

### 3. Histórico de pagamentos do dependente

- Em `members.$memberId.tsx`, na tabela "Activity History"/pagamentos, quando `applied_to_member_id = current member` e pagamento original pertence a sponsor, exibir badge **"Paid by Sponsor"** + nome do sponsor.

### 4. Lista de membros (`src/routes/members.index.tsx`)

- Coluna **Monthly** vira **Total Paid (consolidado)** para sponsors: soma próprio + dependentes.
- No modo "Group by Family" já existente: cabeçalho mostra **Sponsor** primeiro, depois **Dependentes**, depois **Individual** (se houver). Badges visuais por linha.
- Substituir o ícone rosa "coração" por badge text `Sponsor` (dourado) e `Dependent` (azul).

### 5. Distribuição automática de pagamento

Quando sponsor paga $60 e family weekly = $20:
- Aplica $20 ao ledger do próprio sponsor (semana atual em aberto).
- Aplica $20 ao ledger de cada dependente da família com semana em aberto, ordenado por overdue mais antigo primeiro.
- Resto sobra como crédito no próprio sponsor (semana futura).

Configurável por flag — começa **ativo por padrão** para sponsors.

### 6. Cálculo Total Paid Sponsor/Família

Nova helper `getSponsorFinancials(memberId)` em `src/lib/financialLedger.ts`:
- retorna `{ personalPaid, dependentsPaid, familyTotal, dependents: [...] }`.

### 7. Exportações (`src/lib/dataExportImport.ts`)

Adicionar 3 modos no export financeiro:
- `individual` (já existe — manter)
- `sponsor_summary` (uma linha por sponsor com totais agregados)
- `family_summary` (uma linha por família)

## Fora do escopo

- Não alterar auth, RLS de pagamentos individuais, Stripe webhook.
- Não criar nova tabela `family_financial_relationships` — reutilizar `family_id` + `family_role` em `members` (mais simples e já populado).
- Não alterar lógica de inadimplência/overdue.

## Arquivos

1. **Migration**: enum extension + coluna `applied_to_member_id` + função `apply_payment_to_sponsor_family` + trigger update + view `member_financial_summary`.
2. **`src/lib/financialLedger.ts`** — `getSponsorFinancials`, `getFamilyHierarchy`.
3. **`src/routes/members.$memberId.tsx`** — nova seção inline de Relações Financeiras + badge "Paid by Sponsor" no histórico.
4. **`src/routes/members.index.tsx`** — badges visuais Sponsor/Dependent + Total Paid consolidado no grupo.
5. **`src/components/FinancialRelationshipsDrawer.tsx`** — manter, mas reduzir uso a "Edit" apenas.
6. **`src/lib/dataExportImport.ts`** — adicionar exports Sponsor Summary + Family Summary.
7. **i18n** (en/pt/es) — novas chaves: `sponsor`, `dependent`, `paidBySponsor`, `familyTotal`, `sponsoredAccount`, etc.

## Risco / observações

- A mudança na trigger de pagamentos afeta TODOS os pagamentos de sponsors daqui pra frente. Backfill: aplicar a nova distribuição apenas para pagamentos **novos** (não reprocessar histórico) para evitar mexer em ledger já fechado.
- Pagamentos existentes continuam com `applied_to_member_id = NULL` (interpretado como "próprio member" no histórico).
- A view substitui várias queries ad-hoc; vou manter as queries antigas funcionando até a view ser usada pelo front.

Confirma que posso seguir? Posso também já implementar tudo de uma vez se preferir.
