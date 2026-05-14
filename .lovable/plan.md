## Goal
Add payer/beneficiary separation so one member can contribute on behalf of others (family, spouse, kids, sponsorship) without changing any layout.

## 1. Database (migration)

Add columns to `payments`:
- `payer_member_id uuid` — who actually paid (defaults to `member_id` for back-compat)
- `beneficiary_member_id uuid` — who the contribution counts toward (defaults to `member_id`)

Backfill: `payer_member_id = member_id`, `beneficiary_member_id = member_id` for all existing rows.

Create `payment_relationships` table (reusable saved links):
- `id uuid pk`
- `payer_member_id uuid not null`
- `beneficiary_member_id uuid not null`
- `stripe_customer_id text`
- `stripe_subscription_id text`
- `contribution_type contribution_type`
- `relationship_label text` (optional: spouse, child, sponsored…)
- `created_at`, `updated_at`
- unique(payer_member_id, beneficiary_member_id, contribution_type)

RLS:
- Active staff: full access
- Members: SELECT/INSERT/UPDATE/DELETE rows where `payer_member_id` belongs to them (via `members.user_id = auth.uid()`)
- Beneficiary can view rows where they are the beneficiary

Indexes on payer_member_id, beneficiary_member_id on both tables.

## 2. Server functions

Update `src/lib/stripe-subscriptions.functions.ts`:
- `createSubscriptionSession` accepts `{ payerMemberId, beneficiaryMemberId, contributionType? }`
- Validates payer.user_id === auth user
- Allows beneficiary to be any member (search-driven)
- Stripe metadata: `payer_member_id`, `beneficiary_member_id`, `contribution_type`
- On finalize, upsert `payment_relationships` row and set beneficiary's subscription state (not payer's)

Add `src/lib/member-search.functions.ts`:
- `searchMembers({ query })` — staff or any authenticated member can search by name/email/phone (returns minimal `{id, name, email, phone}`); members get a small result list (no PII beyond minimum needed to identify).

## 3. Stripe webhook

`src/routes/api/public/stripe-webhook.ts`:
- Read `payer_member_id` + `beneficiary_member_id` from metadata
- Resolve beneficiary first (fallback to legacy single member resolution)
- Insert `payments` with `payer_member_id`, `beneficiary_member_id`, and `member_id = beneficiary_member_id` (legacy field stays = beneficiary so totals remain correct)
- Update beneficiary's subscription/last-payment state, not payer's

## 4. Checkout flow UI (no layout change)

`src/components/RecordPaymentModal.tsx` — add a compact selector inside the existing form (no layout shift):
- "Who is this contribution for?" → Myself / Another member / Family member
- When "Another/Family": inline search input (name/email/phone) hitting `searchMembers`, pick beneficiary
- Sets `payer_member_id` (current member) + `beneficiary_member_id`

Portal `src/routes/portal.index.tsx`:
- Subscribe button passes `{ payerMemberId, beneficiaryMemberId }` (defaults both to current member)
- New small inline action under the Pastor Salary card: "Pay for someone else" → opens a lightweight beneficiary picker that calls the same `createSubscriptionSession`

## 5. Dashboard / history display

`src/routes/portal.contributions.tsx` and `src/components/ContributionsModal.tsx`:
- Add columns "Paid by" and "Benefiting" — show member names by joining payer/beneficiary
- For member portal show all rows where they're payer OR beneficiary, with badges

## 6. Reports

`src/routes/reports.tsx`: add a toggle "Group by: Beneficiary | Payer" that aggregates totals from the new columns.

## 7. i18n

Add keys for: relationship labels, "Paid by", "Benefiting", "Pay for someone else", "Search by name, email or phone", "Who is this contribution for?".

## Out of scope
- No layout/styling changes anywhere
- No changes to auth, roles, or admin pages beyond the report toggle
- No new Stripe products/prices

## Files to touch
- migration (new)
- `src/lib/stripe-subscriptions.functions.ts`
- `src/lib/member-search.functions.ts` (new)
- `src/routes/api/public/stripe-webhook.ts`
- `src/components/RecordPaymentModal.tsx`
- `src/components/ContributionsModal.tsx`
- `src/routes/portal.index.tsx`
- `src/routes/portal.contributions.tsx`
- `src/routes/reports.tsx`
- `src/i18n/locales/{en,pt}.json`