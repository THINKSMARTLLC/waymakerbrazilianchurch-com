// Data portability utilities: export (CSV/XLSX/Backup) and import (CSV/XLSX) of members.
// Uses xlsx, papaparse, jszip — all run client-side in the browser.
// Read-only against payments/contributions; only members are written via import.
import * as XLSX from "xlsx";
import Papa from "papaparse";
import JSZip from "jszip";
import { supabase } from "@/integrations/supabase/client";
import { formatPhoneDisplay } from "@/lib/phone";
import { computeMemberStatus, FREQUENCY_LABEL, STATUS_LABEL } from "@/lib/memberStatus";
import { findDuplicates } from "@/lib/duplicates";
import type { Database } from "@/integrations/supabase/types";

type Member = Database["public"]["Tables"]["members"]["Row"];
type Payment = Database["public"]["Tables"]["payments"]["Row"];

// ---------- helpers ----------

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function csvBlob(rows: Record<string, unknown>[]): Blob {
  const csv = Papa.unparse(rows, { quotes: true });
  return new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
}

function xlsxBlob(rows: Record<string, unknown>[], sheetName = "Sheet1"): Blob {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  const arr = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  return new Blob([arr], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

function todayStamp() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// ---------- members export ----------

interface MembersExportRow {
  Name: string;
  Email: string;
  Phone: string;
  "Weekly Contribution (USD)": number;
  "Monthly Contribution (USD)": number;
  Frequency: string;
  Status: string;
  "Payment Status": string;
  "Last Payment": string;
  Role: string;
  Department: string;
  "Created At": string;
}

async function buildMembersRows(): Promise<MembersExportRow[]> {
  const [{ data: members }, { data: payments }] = await Promise.all([
    supabase.from("members").select("*").order("name", { ascending: true }),
    supabase.from("payments").select("member_id, amount, payment_date, reference_month").order("payment_date", { ascending: false }),
  ]);
  const lastByMember = new Map<string, string>();
  const monthsByMember = new Map<string, Set<string>>();
  for (const p of payments ?? []) {
    if (!lastByMember.has(p.member_id)) lastByMember.set(p.member_id, p.payment_date);
    if (p.reference_month) {
      const k = String(p.reference_month).slice(0, 7);
      if (!monthsByMember.has(p.member_id)) monthsByMember.set(p.member_id, new Set());
      monthsByMember.get(p.member_id)!.add(k);
    }
  }
  return (members ?? []).map((m) => {
    const status = computeMemberStatus({
      lastPaymentDate: lastByMember.get(m.id) ?? null,
      frequency: m.contribution_frequency,
      coveredMonths: monthsByMember.get(m.id) ?? null,
    });
    const weekly = Number(m.weekly_contribution_usd ?? 0);
    return {
      Name: m.name,
      Email: m.email ?? "",
      Phone: formatPhoneDisplay(m.phone),
      "Weekly Contribution (USD)": weekly,
      "Monthly Contribution (USD)": Number((weekly * 4.345).toFixed(2)),
      Frequency: FREQUENCY_LABEL[m.contribution_frequency] ?? m.contribution_frequency,
      Status: m.status === "active" ? "Active" : "Inactive",
      "Payment Status": STATUS_LABEL[status],
      "Last Payment": lastByMember.get(m.id) ?? "",
      Role: m.member_role ?? "",
      Department: m.department ?? "",
      "Created At": m.created_at,
    };
  });
}

export async function exportMembersCSV(): Promise<number> {
  const rows = await buildMembersRows();
  downloadBlob(csvBlob(rows as unknown as Record<string, unknown>[]), `members_${todayStamp()}.csv`);
  return rows.length;
}

export async function exportMembersXLSX(): Promise<number> {
  const rows = await buildMembersRows();
  downloadBlob(xlsxBlob(rows as unknown as Record<string, unknown>[], "Members"), `members_${todayStamp()}.xlsx`);
  return rows.length;
}

// ---------- payments export ----------

interface PaymentsExportRow {
  "Member Name": string;
  Email: string;
  Date: string;
  "Reference Month": string;
  "Amount (USD)": number;
  Method: string;
  Type: string;
  Frequency: string;
  Status: string;
  Notes: string;
}

const METHOD_LABEL: Record<string, string> = {
  cash: "Cash", zelle: "Zelle", venmo: "Venmo", card: "Card", stripe: "Card", paypal: "PayPal", other: "Other",
};
const TYPE_LABEL: Record<string, string> = {
  tithe: "Tithe", offering: "Offering", pastor_salary: "Pastor Salary",
  special_donation: "Special Donation", event_contribution: "Event Contribution", other: "Other",
};

async function buildPaymentsRows(): Promise<PaymentsExportRow[]> {
  const { data } = await supabase
    .from("payments")
    .select("*, members(name, email)")
    .order("payment_date", { ascending: false });
  return (data ?? []).map((p) => ({
    "Member Name": (p as Payment & { members: { name: string; email: string | null } | null }).members?.name ?? "",
    Email: (p as Payment & { members: { name: string; email: string | null } | null }).members?.email ?? "",
    Date: p.payment_date,
    "Reference Month": p.reference_month ? String(p.reference_month).slice(0, 7) : "",
    "Amount (USD)": Number(p.amount),
    Method: METHOD_LABEL[p.payment_method] ?? p.payment_method,
    Type: TYPE_LABEL[p.contribution_type] ?? p.contribution_type,
    Frequency: p.payment_frequency,
    Status: p.status,
    Notes: p.notes ?? "",
  }));
}

export async function exportPaymentsCSV(): Promise<number> {
  const rows = await buildPaymentsRows();
  downloadBlob(csvBlob(rows as unknown as Record<string, unknown>[]), `payments_${todayStamp()}.csv`);
  return rows.length;
}

export async function exportPaymentsXLSX(): Promise<number> {
  const rows = await buildPaymentsRows();
  downloadBlob(xlsxBlob(rows as unknown as Record<string, unknown>[], "Payments"), `payments_${todayStamp()}.xlsx`);
  return rows.length;
}

// ---------- full backup ----------

export async function exportFullBackup(): Promise<{
  members: number; payments: number; contributions: number; subscriptions: number; profiles: number;
}> {
  const [membersRes, paymentsRes, contribsRes, subsRes, profilesRes] = await Promise.all([
    supabase.from("members").select("*"),
    supabase.from("payments").select("*"),
    supabase.from("payment_contributions").select("*"),
    supabase.from("subscriptions").select("*"),
    supabase.from("user_profiles").select("id, user_id, full_name, email, phone, church_name, status, last_login_at, created_at"),
  ]);

  const counts = {
    members: membersRes.data?.length ?? 0,
    payments: paymentsRes.data?.length ?? 0,
    contributions: contribsRes.data?.length ?? 0,
    subscriptions: subsRes.data?.length ?? 0,
    profiles: profilesRes.data?.length ?? 0,
  };

  const zip = new JSZip();
  const toCSV = (rows: unknown[]) => "\uFEFF" + Papa.unparse(rows as Record<string, unknown>[], { quotes: true });
  zip.file("members.csv", toCSV(membersRes.data ?? []));
  zip.file("payments.csv", toCSV(paymentsRes.data ?? []));
  zip.file("payment_contributions.csv", toCSV(contribsRes.data ?? []));
  zip.file("subscriptions.csv", toCSV(subsRes.data ?? []));
  zip.file("user_profiles.csv", toCSV(profilesRes.data ?? []));

  const manifest = {
    app: "WAY MAKER FLOW",
    generated_at: new Date().toISOString(),
    version: 1,
    counts,
    files: [
      "members.csv", "payments.csv", "payment_contributions.csv",
      "subscriptions.csv", "user_profiles.csv",
    ],
    notes: "Backup snapshot. Restore manually with care — re-import does not run automatically.",
  };
  zip.file("manifest.json", JSON.stringify(manifest, null, 2));

  const blob = await zip.generateAsync({ type: "blob" });
  downloadBlob(blob, `waymaker_backup_${todayStamp()}.zip`);
  return counts;
}

// ---------- import ----------

export interface ParsedImportRow {
  rowIndex: number; // 1-based, excluding header
  raw: Record<string, string>;
  name: string;
  email: string | null;
  phone: string | null;
  errors: string[];
}

export interface ImportClassification {
  newRows: ParsedImportRow[];
  duplicateRows: Array<ParsedImportRow & { matchedMemberId: string; matchedName: string; matchedBy: ("email" | "phone")[] }>;
  invalidRows: ParsedImportRow[];
}

const NAME_KEYS = ["name", "full name", "fullname", "nome", "nome completo", "first name", "given name"];
const EMAIL_KEYS = ["email", "e-mail", "mail", "email address"];
const PHONE_KEYS = ["phone", "phone number", "telefone", "celular", "mobile", "mobile phone", "tel"];

function pick(raw: Record<string, string>, candidates: string[]): string {
  const lowered: Record<string, string> = {};
  for (const k of Object.keys(raw)) lowered[k.trim().toLowerCase()] = raw[k];
  for (const c of candidates) {
    const v = lowered[c];
    if (v && v.trim()) return v.trim();
  }
  return "";
}

function normalizePhone(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  if (!digits) return null;
  if (input.trim().startsWith("+")) return "+" + digits;
  if (digits.length === 10) return "+1" + digits; // assume US
  if (digits.length === 11 && digits.startsWith("1")) return "+" + digits;
  return "+" + digits;
}

function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

export async function parseImportFile(file: File): Promise<ParsedImportRow[]> {
  const lower = file.name.toLowerCase();
  let rows: Record<string, string>[] = [];
  if (lower.endsWith(".csv")) {
    const text = await file.text();
    const parsed = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true });
    rows = (parsed.data ?? []).map((r) => {
      const o: Record<string, string> = {};
      for (const k of Object.keys(r)) o[k] = String(r[k] ?? "");
      return o;
    });
  } else if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
    rows = json.map((r) => {
      const o: Record<string, string> = {};
      for (const k of Object.keys(r)) o[k] = String(r[k] ?? "");
      return o;
    });
  } else {
    throw new Error("Unsupported file type. Use .csv, .xlsx or .xls");
  }

  return rows.map((raw, idx): ParsedImportRow => {
    const name = pick(raw, NAME_KEYS);
    const emailRaw = pick(raw, EMAIL_KEYS).toLowerCase();
    const phoneRaw = pick(raw, PHONE_KEYS);
    const errors: string[] = [];
    if (!name) errors.push("Missing name");
    let email: string | null = null;
    if (emailRaw) {
      if (!isValidEmail(emailRaw)) errors.push("Invalid email");
      else email = emailRaw;
    }
    let phone: string | null = null;
    if (phoneRaw) {
      const norm = normalizePhone(phoneRaw);
      if (!norm || norm.replace(/\D/g, "").length < 7) errors.push("Invalid phone");
      else phone = norm;
    }
    if (!email && !phone) errors.push("Email or phone required");
    return { rowIndex: idx + 1, raw, name, email, phone, errors };
  });
}

export async function classifyImportRows(rows: ParsedImportRow[]): Promise<ImportClassification> {
  const out: ImportClassification = { newRows: [], duplicateRows: [], invalidRows: [] };
  for (const row of rows) {
    if (row.errors.length > 0) {
      out.invalidRows.push(row);
      continue;
    }
    const matches = await findDuplicates({
      email: row.email,
      phone: row.phone,
      name: row.name,
    });
    const memberMatch = matches.find((m) => m.source === "member" && m.severity === "duplicate");
    if (memberMatch) {
      out.duplicateRows.push({
        ...row,
        matchedMemberId: memberMatch.id,
        matchedName: memberMatch.name,
        matchedBy: memberMatch.matched_by,
      });
    } else {
      out.newRows.push(row);
    }
  }
  return out;
}

export interface ImportDecision {
  row: ParsedImportRow;
  action: "create" | "skip" | "update";
  updateMemberId?: string;
}

export interface ImportResult {
  created: number;
  updated: number;
  skipped: number;
  failed: Array<{ row: ParsedImportRow; error: string }>;
}

export async function executeImport(decisions: ImportDecision[]): Promise<ImportResult> {
  const result: ImportResult = { created: 0, updated: 0, skipped: 0, failed: [] };
  for (const d of decisions) {
    if (d.action === "skip") {
      result.skipped++;
      continue;
    }
    if (d.action === "create") {
      const { error } = await supabase.from("members").insert({
        name: d.row.name,
        email: d.row.email,
        phone: d.row.phone,
        status: "active",
        payment_type: "cash",
        weekly_contribution_usd: 0,
      });
      if (error) result.failed.push({ row: d.row, error: error.message });
      else result.created++;
    } else if (d.action === "update" && d.updateMemberId) {
      const patch: Record<string, string | null> = {};
      if (d.row.email) patch.email = d.row.email;
      if (d.row.phone) patch.phone = d.row.phone;
      if (d.row.name) patch.name = d.row.name;
      const { error } = await supabase.from("members").update(patch).eq("id", d.updateMemberId);
      if (error) result.failed.push({ row: d.row, error: error.message });
      else result.updated++;
    }
  }
  return result;
}
