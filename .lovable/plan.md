# Plano: Admin CRM Inteligente

A maior parte da infraestrutura já existe no projeto (busca de membros, detecção de duplicidade, merge atômico, modais de duplicidade, logs de atividade). O trabalho real é (1) **corrigir o reset de senha que está travando em “Gerando link…”**, (2) **expandir a busca global no painel admin**, (3) **unificar o fluxo de duplicidade nas telas certas**, e (4) **fortalecer auditoria**. Sem retrabalho do que já funciona.

## 1. Corrigir reset de senha do Super Admin (URGENTE — bug visível na screenshot)

Hoje `generateRecoveryForEmail` chama `auth.admin.generateLink({ type: "magiclink", ... })`. Quando o email não existe ou o Supabase recusa, retorna `null` silenciosamente e o modal fica eternamente em “Gerando link…”.

Correções:
- Trocar `type: "magiclink"` por `type: "recovery"` (é reset de senha, não login).
- Propagar erro do Supabase em vez de retornar `null` (mostrar mensagem no modal).
- Estado do modal: `loading | success(link) | error(message)`; nunca ficar pendurado.
- Botão **Reenviar** dentro do próprio modal.
- Logar `password_reset_link_generated` em `activity_logs` (já feito para outras ações).

## 2. Busca global de membros no painel admin

Já existe `searchMembers` (server fn) e `useCurrentMember`. Faltam:
- Caixa de busca no topo de `/admin` (debounced 250 ms) cobrindo: `nome`, `email`, `telefone`, `id` exato, e também `user_profiles` (usuários do portal).
- Server fn nova `adminGlobalSearch` que retorna union: `{ id, name, email, phone, status, source: 'member' | 'user_profile', created_at }`.
- Resultado clicável → abre `MemberFinancialDrawer` ou perfil do usuário.

## 3. Modal de duplicidade unificado

`DuplicateResolutionModal` + `MergeMembersModal` já existem e são usados em `/members`. Falta:
- Usar o mesmo modal no fluxo de **criação de usuário** (`CreateUserModal`) — hoje só dispara `alert("Este email já está cadastrado")`.
- Quando `createManagedUser` retornar `reason: "email_exists"`, abrir o modal com as ações: **Ver cadastro**, **Reenviar acesso**, **Mesclar**, **Criar mesmo assim (override)**.
- Mostrar origem (`member` / `user_profile` / `auth.users`) e data de criação em cada linha.

## 4. Merge e auditoria

O RPC `merge_members_by_id` já existe (SECURITY DEFINER) e move pagamentos/assinaturas/atividades/visitas/notas. Apenas:
- Garantir que `mergeMembers()` em `src/lib/duplicates.ts` grava `activity_logs` com `action: "members_merged"` e `metadata: { winner_id, loser_id, performed_by }` (hoje o RPC roda mas não escreve log explícito do lado do app).
- Idem para `archiveMember` (já loga) e para o novo botão de reset de senha.

## 5. Regra central: nunca bloquear, sempre oferecer ação

Auditar os pontos onde hoje usamos `alert(...)` ou `throw` opaco:
- `CreateUserModal` quando email duplica → abrir modal de duplicidade.
- `EditMemberModal` quando salva e bate em conflito → idem.
- `RecoveryLinkModal` em erro → mostrar erro + botão **Tentar de novo**.

## Arquivos afetados (estimativa)

```text
src/lib/adminUsers.functions.ts     # type: "recovery", erros propagados, log
src/routes/admin.tsx                # modal robusto + busca global no header
src/lib/admin-search.functions.ts   # NOVO — busca cross-table
src/components/CreateUserModal.tsx  # integrar DuplicateResolutionModal
src/lib/duplicates.ts               # log explícito em mergeMembers
```

Sem mudanças em schema, RLS, pagamentos ou Stripe.

## Ordem de entrega

1. Bug do reset de senha (item 1) — entrega isolada, testável de imediato.
2. Busca global (item 2).
3. Modal de duplicidade em criação de usuário (item 3).
4. Logs de merge / reset (item 4).
5. Limpeza de `alert()` (item 5).

Posso executar tudo de uma vez ou apenas o item 1 (urgente) primeiro — me diga qual prefere.
