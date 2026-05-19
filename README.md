# Way Maker Church

Plataforma de gestão administrativa e financeira para a **Way Maker Brazilian Church** — membros, check-ins, contribuições, assinaturas recorrentes (Stripe), relatórios e portal do membro.

🌐 **Produção:** [waymakerbrazilianchurch.com](https://waymakerbrazilianchurch.com)

---

## 📌 Visão geral

O sistema cobre toda a operação da igreja:

- **Membros** — cadastro, status (ativo / pendente / arquivado), histórico ministerial, check-ins, aniversários, engajamento social.
- **Financeiro** — pagamentos individuais, assinaturas Stripe, ledger automático, retries e invoices.
- **Dashboard & Relatórios** — números financeiros unificados em todos os módulos (`src/lib/financialSummary.ts`).
- **Portal do membro** — devocional, contribuições, perfil, bíblia.
- **Pastoral / Discipulado / Engajamento** — acompanhamento ministerial.
- **Importação / Exportação** de dados.
- **Auth** — Supabase Auth + Google OAuth + roles (`admin`, `pastor`, `member`).

---

## 🧱 Stack

| Camada | Tecnologia |
|---|---|
| Framework | [TanStack Start v1](https://tanstack.com/start) (React 19 + Vite 7) |
| Linguagem | TypeScript (strict) |
| Estilo | Tailwind CSS v4 + shadcn/ui |
| Roteamento | TanStack Router (file-based — `src/routes/`) |
| Backend (BaaS) | **Lovable Cloud** (Supabase) — Postgres + RLS + Auth + Storage |
| Server functions | `createServerFn` (TanStack) — `src/lib/*.functions.ts` |
| Pagamentos | Stripe (Checkout, Subscriptions, Webhooks) |
| Email | React Email + Lovable email gateway |
| Runtime de deploy | Cloudflare Workers (via `@cloudflare/vite-plugin` + `wrangler`) |
| Package manager | `bun` |
| Testes | Vitest |

---

## 🏗️ Arquitetura

```
src/
├── routes/                  # File-based routing (TanStack)
│   ├── __root.tsx           # Root layout (html shell)
│   ├── index.tsx            # Landing
│   ├── dashboard.tsx        # Admin dashboard
│   ├── members.*.tsx        # Membros
│   ├── reports.tsx          # Relatórios financeiros
│   ├── portal.*.tsx         # Portal do membro
│   ├── api/public/          # Webhooks (Stripe, etc.)
│   └── lovable/email/       # Integrações de email
├── components/              # Componentes React + shadcn/ui
├── hooks/                   # useAuth, useUserRole, useCurrentMember, useLanguage
├── lib/                     # Domínio + server functions
│   ├── financialSummary.ts  # ⚠️ Fonte única dos números financeiros
│   ├── stripe-*.functions.ts
│   └── email-templates/
├── integrations/supabase/   # Clients (browser, admin, middleware) — AUTO-GERADOS
├── i18n/                    # pt / en / es
└── styles.css               # Tokens do design system (oklch)
supabase/
└── migrations/              # Migrations versionadas
tests/                       # Vitest
```

### Princípios
- **Server-side logic** vive em `createServerFn`, **não** em Supabase Edge Functions.
- **Webhooks públicos** ficam em `src/routes/api/public/*` com verificação de assinatura.
- **RLS sempre habilitado** — roles em tabela separada (`user_roles`) via função `has_role()`.
- **Design tokens semânticos** em `src/styles.css` — nunca cores hardcoded em componentes.

---

## 🚀 Setup local

```bash
# 1. Clonar
git clone https://github.com/THINKSMARTLLC/waymakerbrazilianchurch-com.git
cd waymakerbrazilianchurch-com

# 2. Instalar dependências
bun install

# 3. Configurar variáveis
cp .env.example .env
# (edite .env com as credenciais reais)

# 4. Dev server
bun run dev

# 5. Build de produção
bun run build

# 6. Testes
bunx vitest run
```

---

## 🔐 Variáveis de ambiente

Veja [`.env.example`](./.env.example) para a lista completa.

| Variável | Tipo | Onde usar |
|---|---|---|
| `VITE_SUPABASE_URL` | Pública | Browser + SSR |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Pública | Browser + SSR |
| `VITE_SUPABASE_PROJECT_ID` | Pública | Browser |
| `SUPABASE_URL` | Pública | Server functions |
| `SUPABASE_PUBLISHABLE_KEY` | Pública | Server functions |
| `SUPABASE_SERVICE_ROLE_KEY` | 🔒 Secret | Server-only (bypass RLS) |
| `STRIPE_SECRET_KEY` | 🔒 Secret | Server (Checkout / Subscriptions) |
| `STRIPE_WEBHOOK_SECRET` | 🔒 Secret | Verificação de webhook |
| `LOVABLE_API_KEY` | 🔒 Managed | Gerenciado pela Lovable |

> 🔒 Secrets de produção são configurados em **Lovable Cloud → Project → Secrets** — nunca no `.env` versionado.

---

## 💳 Stripe

- **Checkout / Subscriptions:** `src/lib/stripe-subscriptions.functions.ts`
- **Resync:** `src/lib/stripe-resync.functions.ts` + `src/routes/resync-stripe.ts`
- **Webhook:** `src/routes/api/public/stripe-webhook.ts` (assinatura verificada via `STRIPE_WEBHOOK_SECRET`)
- **Eventos cobertos:** `checkout.session.completed`, `invoice.paid`, `customer.subscription.updated`

Configurar o endpoint do webhook no Stripe Dashboard apontando para:
```
https://waymakerbrazilianchurch.com/api/public/stripe-webhook
```

---

## 🗄️ Supabase (Lovable Cloud)

- **Migrations:** `supabase/migrations/` — versionadas, aplicadas via tooling do Lovable.
- **RLS:** habilitado em todas as tabelas. Roles via tabela `user_roles` + função `has_role()`.
- **Ledger financeiro:** alimentado por triggers em `payments` / `subscription_invoices`.
- **Clients gerados automaticamente** em `src/integrations/supabase/` — **não editar manualmente.**

Tabelas principais: `members`, `payments`, `subscriptions`, `subscription_invoices`, `check_ins`, `ministry_history`, `user_roles`, `email_send_log`.

---

## 🚢 Deploy

- **Runtime:** Cloudflare Workers (não Vercel).
- **Build automático:** ao fazer merge na `main`, o Lovable publica.
- **Frontend:** mudanças visuais exigem clicar **Publish** no Lovable.
- **Backend (server functions, migrations):** publicam imediatamente.
- **Domínios:** `waymakerbrazilianchurch.com` + `www.waymakerbrazilianchurch.com` (SSL gerenciado).

---

## 🌿 Estrutura de branches

- **`main`** — produção. Deploy automático.
- **`edit/edt-*`** — branches efêmeras criadas pelo Lovable durante edições (mescladas em `main` após aprovação).

Recomendações futuras:
- Habilitar **Branch Protection** em `main` (require PR review).
- Adotar **Conventional Commits** (`feat:`, `fix:`, `chore:`, `docs:`).
- Criar tags de release (`v1.0.0`, `v1.1.0`, ...) a cada milestone significativo.

---

## 🧪 Testes

```bash
bunx vitest run               # roda toda a suite
bunx vitest run tests/phone   # arquivo específico
```

Cobertura atual: fluxos críticos (`tests/critical-flows.test.ts`) + utilitários (`tests/phone.test.ts`).

---

## 📄 Licença

Proprietário — Way Maker Brazilian Church / THINKSMARTLLC.
