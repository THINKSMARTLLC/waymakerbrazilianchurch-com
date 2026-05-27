import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Shield, UserCheck, UserX, Trash2, ArrowLeft, UserPlus, KeyRound, Mail, Search, Loader2, X, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { logActivity } from "@/lib/activityLog";
import { CreateUserModal } from "@/components/CreateUserModal";
import { useServerFn } from "@tanstack/react-start";
import { generateRecoveryForEmail, sendAccessEmail } from "@/lib/adminUsers.functions";
import { adminGlobalSearch, type AdminSearchResult } from "@/lib/admin-search.functions";
import { formatDate, formatDateTime } from "@/lib/datetime";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];
type AccountStatus = Database["public"]["Enums"]["account_status"];

interface UserRow {
  user_id: string;
  full_name: string;
  email: string;
  phone: string | null;
  church_name: string | null;
  status: AccountStatus;
  last_login_at: string | null;
  created_at: string;
  roles: AppRole[];
}

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin — Way Maker Church" }] }),
  component: AdminPage,
});

const ROLE_OPTIONS: AppRole[] = ["super_admin", "church_admin", "admin", "finance_manager", "member"];

function AdminPage() {
  const { t } = useTranslation();
  const { isSuperAdmin, loading: roleLoading } = useUserRole();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [recoveryFor, setRecoveryFor] = useState<{
    email: string;
    state: "loading" | "success" | "error";
    link: string | null;
    error: string | null;
  } | null>(null);
  const sendRecovery = useServerFn(generateRecoveryForEmail);
  const sendAccess = useServerFn(sendAccessEmail);
  const runGlobalSearch = useServerFn(adminGlobalSearch);
  const [sendingAccessFor, setSendingAccessFor] = useState<string | null>(null);

  // Global search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<AdminSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const requestRecovery = async (email: string) => {
    setRecoveryFor({ email, state: "loading", link: null, error: null });
    try {
      const res = await sendRecovery({ data: { email } });
      setRecoveryFor({ email, state: "success", link: res.recoveryLink, error: null });
    } catch (err) {
      setRecoveryFor({
        email,
        state: "error",
        link: null,
        error: err instanceof Error ? err.message : t("admin.generateLinkFailed"),
      });
    }
  };

  const resendAccess = async (email: string) => {
    setSendingAccessFor(email);
    try {
      await sendAccess({ data: { email } });
      alert(t("admin.accessEmailResent", { email }));
    } catch (err) {
      alert(err instanceof Error ? err.message : t("admin.sendEmailFailed"));
    } finally {
      setSendingAccessFor(null);
    }
  };

  // Debounced global search
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    const q = searchQuery.trim();
    if (q.length < 2) {
      setSearchResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    searchTimer.current = setTimeout(async () => {
      try {
        const res = await runGlobalSearch({ data: { query: q, limit: 20 } });
        setSearchResults(res.results);
      } catch (err) {
        console.error("Global search failed", err);
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [searchQuery, runGlobalSearch]);


  const load = async () => {
    setLoading(true);
    const [{ data: profiles }, { data: roles }] = await Promise.all([
      supabase.from("user_profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("user_roles").select("user_id, role"),
    ]);
    const rolesByUser: Record<string, AppRole[]> = {};
    (roles ?? []).forEach((r) => {
      rolesByUser[r.user_id] = [...(rolesByUser[r.user_id] ?? []), r.role];
    });
    setUsers(
      (profiles ?? []).map((p) => ({
        user_id: p.user_id,
        full_name: p.full_name,
        email: p.email,
        phone: p.phone,
        church_name: p.church_name,
        status: p.status,
        last_login_at: p.last_login_at,
        created_at: p.created_at,
        roles: rolesByUser[p.user_id] ?? [],
      })),
    );
    setLoading(false);
  };

  useEffect(() => {
    if (isSuperAdmin) load();
  }, [isSuperAdmin]);

  if (roleLoading) {
    return <div className="p-8 text-muted-foreground">{t("common.loading")}</div>;
  }

  if (!isSuperAdmin) {
    return (
      <div className="p-8 text-center">
        <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
        <h2 className="text-xl font-semibold mb-2">{t("admin.restrictedTitle")}</h2>
        <p className="text-muted-foreground mb-4">{t("admin.restrictedBody")}</p>
        <Link to="/" className="btn-google inline-flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" /> {t("common.back")}
        </Link>
      </div>
    );
  }

  const updateStatus = async (userId: string, status: AccountStatus) => {
    await supabase.from("user_profiles").update({ status }).eq("user_id", userId);
    await logActivity("user_status_changed", { target_user: userId, status });
    load();
  };

  const changeRole = async (userId: string, newRole: AppRole) => {
    // Replace all roles with the selected one (single-role model)
    await supabase.from("user_roles").delete().eq("user_id", userId);
    await supabase.from("user_roles").insert([{ user_id: userId, role: newRole }]);
    await logActivity("user_role_changed", { target_user: userId, role: newRole });
    load();
  };

  const deleteUser = async (userId: string) => {
    if (!confirm(t("admin.confirmDelete"))) return;
    await supabase.from("user_roles").delete().eq("user_id", userId);
    await supabase.from("user_profiles").delete().eq("user_id", userId);
    await logActivity("user_deleted", { target_user: userId });
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
          <Shield className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold font-display">{t("admin.panelTitle")}</h1>
          <p className="text-sm text-muted-foreground">{t("admin.panelSubtitle")}</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="btn-google inline-flex items-center gap-2"
        >
          <UserPlus className="h-4 w-4" />
          {t("admin.createUser")}
        </button>
      </div>

      {/* Global search */}
      <div className="card-elevated p-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("admin.searchPlaceholder", {
              defaultValue: "Buscar por nome, email, telefone ou ID…",
            })}
            className="w-full rounded-xl border border-input bg-background pl-9 pr-9 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Limpar busca"
            >
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
            </button>
          )}
        </div>
        {searchQuery.trim().length >= 2 && (
          <div className="rounded-xl border border-border divide-y divide-border max-h-80 overflow-y-auto">
            {searching && searchResults.length === 0 && (
              <div className="p-4 text-sm text-muted-foreground">{t("common.loading")}</div>
            )}
            {!searching && searchResults.length === 0 && (
              <div className="p-4 text-sm text-muted-foreground">
                {t("admin.noResults", { defaultValue: "Nenhum registro encontrado." })}
              </div>
            )}
            {searchResults.map((r) => (
              <div
                key={`${r.source}-${r.id}`}
                className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm hover:bg-muted/40"
              >
                <div className="min-w-0">
                  <div className="font-medium truncate">{r.name}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {r.email ?? "—"}
                    {r.phone ? ` · ${r.phone}` : ""}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs rounded-md bg-muted px-2 py-0.5 text-muted-foreground">
                    {r.source === "member" ? "Membro" : "Conta"}
                  </span>
                  {r.status && (
                    <span className="text-xs rounded-md bg-primary/10 text-primary px-2 py-0.5">
                      {r.status}
                    </span>
                  )}
                  {r.email && (
                    <button
                      onClick={() => requestRecovery(r.email!)}
                      title={t("admin.generateRecoveryLink")}
                      className="p-1.5 rounded-md hover:bg-primary/10 text-primary"
                    >
                      <KeyRound className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>



      <div className="card-elevated overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="font-semibold">{t("admin.users")} ({users.length})</h2>
        </div>
        {loading ? (
          <div className="p-8 text-center text-muted-foreground">{t("admin.loadingUsers")}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-3">{t("common.name")}</th>
                  <th className="text-left px-4 py-3">{t("common.email")}</th>
                  <th className="text-left px-4 py-3">{t("modals.role") || "Role"}</th>
                  <th className="text-left px-4 py-3">{t("common.status")}</th>
                  <th className="text-left px-4 py-3">{t("admin.registered")}</th>
                  <th className="text-left px-4 py-3">{t("admin.lastLogin")}</th>
                  <th className="text-right px-4 py-3">{t("common.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.user_id} className="border-t border-border hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">{u.full_name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                    <td className="px-4 py-3">
                      <select
                        value={u.roles[0] ?? "member"}
                        onChange={(e) => changeRole(u.user_id, e.target.value as AppRole)}
                        className="rounded-md border border-input bg-background px-2 py-1 text-xs"
                      >
                        {ROLE_OPTIONS.map((r) => (
                          <option key={r} value={r}>{t(`admin.roles.${r}`)}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={u.status} /></td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {formatDate(u.created_at)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {u.last_login_at ? formatDateTime(u.last_login_at) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {u.status !== "active" && (
                          <button onClick={() => updateStatus(u.user_id, "active")} title={t("admin.approve")}
                            className="p-1.5 rounded-md hover:bg-primary/10 text-primary">
                            <UserCheck className="h-4 w-4" />
                          </button>
                        )}
                        {u.status !== "suspended" && (
                          <button onClick={() => updateStatus(u.user_id, "suspended")} title={t("admin.suspend")}
                            className="p-1.5 rounded-md hover:bg-muted text-muted-foreground">
                            <UserX className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          onClick={() => resendAccess(u.email)}
                          disabled={sendingAccessFor === u.email}
                          title={t("admin.sendAccessEmail")}
                          className="p-1.5 rounded-md hover:bg-primary/10 text-primary disabled:opacity-50"
                        >
                          <Mail className="h-4 w-4" />
                        </button>
                        <button onClick={() => requestRecovery(u.email)} title={t("admin.generateRecoveryLink")}
                          className="p-1.5 rounded-md hover:bg-primary/10 text-primary">
                          <KeyRound className="h-4 w-4" />
                        </button>
                        <button onClick={() => deleteUser(u.user_id)} title={t("admin.deleteAccount")}
                          className="p-1.5 rounded-md hover:bg-destructive/10 text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ActivityLogSection />

      <CreateUserModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={load}
        canAssignStaff={true}
      />

      {recoveryFor && (
        <RecoveryLinkModal
          email={recoveryFor.email}
          state={recoveryFor.state}
          link={recoveryFor.link}
          error={recoveryFor.error}
          onRetry={() => requestRecovery(recoveryFor.email)}
          onClose={() => setRecoveryFor(null)}
        />
      )}
    </div>
  );
}

function RecoveryLinkModal({
  email,
  state,
  link,
  error,
  onRetry,
  onClose,
}: {
  email: string;
  state: "loading" | "success" | "error";
  link: string | null;
  error: string | null;
  onRetry: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-card rounded-2xl shadow-xl border border-border">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="font-display text-lg font-semibold">{t("admin.recoveryTitle")}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-sm text-muted-foreground">
            {t("admin.recoveryBody", { email })}
          </p>

          {state === "loading" && (
            <div className="flex items-center gap-2 rounded-xl bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t("admin.generatingLink")}
            </div>
          )}

          {state === "error" && (
            <div className="space-y-3">
              <div className="flex items-start gap-3 rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
                <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
                <div className="min-w-0 break-words">{error ?? t("admin.generateLinkFailed")}</div>
              </div>
              <button onClick={onRetry} className="btn-google w-full">
                {t("modals.tryAgain", { defaultValue: "Tentar novamente" })}
              </button>
            </div>
          )}

          {state === "success" && link && (
            <div className="flex items-stretch gap-2">
              <input
                readOnly
                value={link}
                className="flex-1 rounded-xl border border-input bg-muted/30 px-3 py-2 text-xs font-mono"
              />
              <button
                onClick={copy}
                className="px-3 rounded-xl border border-input bg-background hover:bg-muted text-sm"
              >
                {copied ? t("admin.copied") : t("admin.copy")}
              </button>
            </div>
          )}

          {state === "success" && (
            <button onClick={onRetry} className="w-full text-sm text-muted-foreground hover:text-foreground">
              {t("modals.resend", { defaultValue: "Gerar novo link" })}
            </button>
          )}

          <button onClick={onClose} className="btn-google w-full">{t("admin.close")}</button>
        </div>
      </div>
    </div>
  );
}

type LogRow = {
  id: string;
  action: string;
  user_email: string | null;
  page_accessed: string | null;
  created_at: string;
  metadata: Record<string, unknown> | null;
};

function ActivityLogSection() {
  const { t } = useTranslation();
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [filter, setFilter] = useState<"all" | "errors" | "stripe" | "members">("all");
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = async () => {
    let query = supabase
      .from("activity_logs")
      .select("id, action, user_email, page_accessed, created_at, metadata")
      .order("created_at", { ascending: false })
      .limit(200);
    if (filter === "errors") query = query.eq("action", "error");
    else if (filter === "stripe") query = query.like("action", "stripe_%");
    else if (filter === "members") query = query.in("action", ["member_created", "member_updated", "member_deleted", "member_status_changed"]);
    const { data } = await query;
    setLogs((data ?? []) as LogRow[]);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  return (
    <div className="card-elevated overflow-hidden">
      <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-3 flex-wrap">
        <h2 className="font-semibold">{t("admin.systemLogs")}</h2>
        <div className="flex items-center gap-2 text-xs">
          {(["all", "errors", "stripe", "members"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-2.5 py-1 rounded-md border ${
                filter === f ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"
              }`}
            >
              {t(`admin.filter${f.charAt(0).toUpperCase() + f.slice(1)}`)}
            </button>
          ))}
          <button onClick={load} className="px-2.5 py-1 rounded-md border border-border hover:bg-muted">
            {t("admin.refresh")}
          </button>
        </div>
      </div>
      <div className="divide-y divide-border max-h-[32rem] overflow-y-auto">
        {logs.length === 0 && <div className="p-6 text-center text-sm text-muted-foreground">{t("admin.noLogs")}</div>}
        {logs.map((l) => {
          const isError = l.action === "error";
          const isOpen = expanded === l.id;
          return (
            <div key={l.id} className={`px-5 py-3 text-sm ${isError ? "bg-destructive/5" : ""}`}>
              <button
                onClick={() => setExpanded(isOpen ? null : l.id)}
                className="w-full flex items-center justify-between gap-3 text-left"
              >
                <div className="min-w-0">
                  <span className={`font-medium ${isError ? "text-destructive" : ""}`}>{t(`admin.actions.${l.action}`, { defaultValue: l.action })}</span>
                  <span className="text-muted-foreground"> · {l.user_email ?? "system"}</span>
                  {l.page_accessed && <span className="text-xs text-muted-foreground"> · {l.page_accessed}</span>}
                </div>
                <span className="text-xs text-muted-foreground shrink-0">{formatDateTime(l.created_at)}</span>
              </button>
              {isOpen && l.metadata && (
                <pre className="mt-2 max-h-64 overflow-auto rounded-md bg-muted/50 p-3 text-xs font-mono whitespace-pre-wrap break-words">
                  {JSON.stringify(l.metadata, null, 2)}
                </pre>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: AccountStatus }) {
  const { t } = useTranslation();
  const cls = status === "active"
    ? "bg-primary/10 text-primary"
    : status === "pending"
    ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
    : "bg-destructive/10 text-destructive";
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>{t(`admin.status.${status}`)}</span>;
}

function roleLabel(r: AppRole) {
  // Kept for type safety; actual labels render via i18n in <select> options.
  return r;
}
