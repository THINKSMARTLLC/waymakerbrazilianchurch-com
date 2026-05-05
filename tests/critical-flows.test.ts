import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

const read = (p: string) => readFileSync(path.resolve(p), "utf8");

describe("Member navigation regression", () => {
  it("member profile route file exists", () => {
    expect(existsSync("src/routes/members.$memberId.tsx")).toBe(true);
  });

  it("member list links to /members/$memberId with member.id", () => {
    const src = read("src/routes/members.index.tsx");
    expect(src).toMatch(/to=["']\/members\/\$memberId["']/);
    expect(src).toMatch(/params=\{\{\s*memberId:\s*member\.id\s*\}\}/);
  });

  it("member profile fetches by id safely (maybeSingle)", () => {
    const src = read("src/routes/members.$memberId.tsx");
    expect(src).toMatch(/from\(["']members["']\)/);
    expect(src).toMatch(/maybeSingle\(\)/);
  });
});

describe("Contributions on member profile", () => {
  it("member profile loads payments list", () => {
    const src = read("src/routes/members.$memberId.tsx");
    expect(src).toMatch(/from\(["']payments["']\)/);
  });
});

describe("Stripe webhook — single payment per invoice.paid", () => {
  const src = read("src/routes/api/public/stripe-webhook.ts");

  it("handles invoice.paid event", () => {
    expect(src).toMatch(/invoice\.paid/);
  });

  it("guards against duplicate payments by stripe payment id", () => {
    expect(src).toMatch(/paymentAlreadyRegistered/);
    expect(src).toMatch(/stripe_payment_duplicate_ignored/);
  });

  it("inserts a single payment row per matched invoice", () => {
    // exactly one .from("payments").insert(...) call inside the matched flow
    const matches = src.match(/from\(["']payments["']\)\s*\.\s*insert\(/g) ?? [];
    expect(matches.length).toBe(1);
  });
});

describe("Stripe webhook — duplicate event prevention", () => {
  const src = read("src/routes/api/public/stripe-webhook.ts");

  it("records each stripe event id for idempotency", () => {
    expect(src).toMatch(/stripe_processed_events/);
    expect(src).toMatch(/stripe_event_id:\s*event\.id/);
  });

  it("ignores duplicate events on unique-violation (23505)", () => {
    expect(src).toMatch(/23505/);
    expect(src).toMatch(/log duplicate ignored/);
    expect(src).toMatch(/duplicate:\s*true/);
  });
});
