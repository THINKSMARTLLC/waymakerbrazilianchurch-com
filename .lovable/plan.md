## Family Grouping — Financial Module

Add an explicit "family" concept on top of the existing payer/beneficiary system, so members can be grouped, and totals can be rolled up per family on the Members page and dashboard.

### 1. Database (migration)

New table `families`:
- `name` (text, required) — e.g. "Família Santos"
- `created_by` (uuid, optional)
- standard `id`, `created_at`, `updated_at`

Add to `members`:
- `family_id` (uuid, nullable, references `families.id`, on delete set null)
- `family_role` (enum: `individual` | `family_owner` | `family_member` | `sponsored`, default `individual`)

RLS:
- `families`: active staff full access; members can SELECT their own family (`id IN (SELECT family_id FROM members WHERE user_id = auth.uid())`).
- New `members.family_id` / `family_role` columns inherit existing members RLS.

No changes to `payments`, `payment_relationships`, or any Stripe field.

### 2. Members page (`src/routes/members.index.tsx`)

Fetch families alongside members, build a `familyById` map.

New per-row badge:
- Family owner → `👑 Família X`
- Family member → `👨‍👩‍👧 Família X`
- Sponsored → `💝 Patrocinado`
- Individual → no badge

New toggle above the table: **"Group by Family"**.

When ON, render the table grouped:
- One header row per family with: name, member count, expected, paid, pending, expand/collapse chevron.
- Children rows = the existing member rows, indented, hidden when collapsed.
- Members with no `family_id` go under a "Individual Members" group (always expanded).

Family totals are derived from the per-member fields already computed last turn:
- `family.expected = Σ monthly_expected`
- `family.paid     = Σ monthly_paid`
- `family.pending  = Σ monthly_pending`
- `family.count    = members in family`

### 3. Top financial cards

Replace the current 3 secondary cards on the dashboard (and add equivalents on `/members`) with real data computed from `members.family_role` + existing `payment_relationships`:
- **Famílias Ativas** = count of distinct `family_id` with at least one active member.
- **Pagando pela Família** = members with `family_role = family_owner`.
- **Patrocinados** = members with `family_role = sponsored` (or appearing as `beneficiary_member_id` with a different payer — keep current logic as fallback).
- **Pagamentos Familiares (mês)** = sum of `monthly_paid` for all members in any family.

Existing 5 Stripe-aligned status cards (paid / past_due / failed / unpaid / cancelled) remain unchanged.

### 4. Family management UI (minimal)

In the Edit Member modal, add:
- "Family" select (existing families + "Create new…" inline input)
- "Role in family" select (individual / owner / member / sponsored)

This is the only write surface in this iteration — no separate "Families" page yet.

### 5. Out of scope (explicit)

- No changes to Stripe sync, webhooks, or payment recording flow.
- No automatic creation of `payment_relationships` from `family_id` (the two systems coexist; we can reconcile later if needed).
- No bulk family assignment / drag-drop UI.
- The `Group by Family` toggle does not change export behavior in this iteration.

### Files touched

- New migration (families table + members columns + RLS)
- `src/routes/members.index.tsx` — fetch families, badge, toggle, grouped rendering, derived family totals
- `src/components/EditMemberModal.tsx` — family picker + role
- `src/routes/dashboard.tsx` — wire the 3 family cards to real `family_role` counts
- `src/i18n/locales/{en,pt,es}.json` — labels (Family, Owner, Sponsored, Group by Family, etc.)

### Verification

- Console table from last turn already prints per-member `monthly_expected/paid/pending`. Family rollups must equal the sum of their children rows in that table.
- Toggling "Group by Family" off must restore the exact same list as today (no row gained or lost).