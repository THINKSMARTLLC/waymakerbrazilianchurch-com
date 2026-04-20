import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Shield, UserCheck, UserX, Trash2, ArrowLeft, UserPlus, KeyRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { logActivity } from "@/lib/activityLog";
import { CreateUserModal } from "@/components/CreateUserModal";
import { useServerFn } from "@tanstack/react-start";
import { generateRecoveryForEmail } from "@/lib/adminUsers.functions";
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
  head: () => ({ meta: [{ title: "Admin — WAY MAKER FLOW" }] }),
  component: AdminPage,
});

const ROLE_OPTIONS: AppRole[] = ["super_admin", "church_admin", "admin", "finance_manager", "member"];

function AdminPage() {
  const { isSuperAdmin, loading: roleLoading } = useUserRole();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);

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
    return <div className="p-8 text-muted-foreground">Carregando...</div>;
  }

  if (!isSuperAdmin) {
    return (
      <div className="p-8 text-center">
        <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
        <h2 className="text-xl font-semibold mb-2">Acesso restrito</h2>
        <p className="text-muted-foreground mb-4">Apenas Super Admins podem acessar este painel.</p>
        <Link to="/" className="btn-google inline-flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" /> Voltar
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
    if (!confirm("Excluir esta conta? Esta ação remove o perfil e as funções, mas o login no auth permanece. Confirme apenas se tiver certeza.")) return;
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
        <div>
          <h1 className="text-2xl font-semibold font-display">Painel Super Admin</h1>
          <p className="text-sm text-muted-foreground">Gerencie usuários, funções e status do sistema</p>
        </div>
      </div>

      <div className="card-elevated overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="font-semibold">Usuários ({users.length})</h2>
        </div>
        {loading ? (
          <div className="p-8 text-center text-muted-foreground">Carregando usuários...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-3">Nome</th>
                  <th className="text-left px-4 py-3">Email</th>
                  <th className="text-left px-4 py-3">Função</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-left px-4 py-3">Cadastro</th>
                  <th className="text-left px-4 py-3">Último login</th>
                  <th className="text-right px-4 py-3">Ações</th>
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
                          <option key={r} value={r}>{roleLabel(r)}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={u.status} /></td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {new Date(u.created_at).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {u.last_login_at ? new Date(u.last_login_at).toLocaleString("pt-BR") : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {u.status !== "active" && (
                          <button onClick={() => updateStatus(u.user_id, "active")} title="Aprovar"
                            className="p-1.5 rounded-md hover:bg-primary/10 text-primary">
                            <UserCheck className="h-4 w-4" />
                          </button>
                        )}
                        {u.status !== "suspended" && (
                          <button onClick={() => updateStatus(u.user_id, "suspended")} title="Suspender"
                            className="p-1.5 rounded-md hover:bg-muted text-muted-foreground">
                            <UserX className="h-4 w-4" />
                          </button>
                        )}
                        <button onClick={() => deleteUser(u.user_id)} title="Excluir"
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
    </div>
  );
}

function ActivityLogSection() {
  const [logs, setLogs] = useState<Array<{ id: string; action: string; user_email: string | null; page_accessed: string | null; created_at: string }>>([]);
  useEffect(() => {
    supabase.from("activity_logs").select("id, action, user_email, page_accessed, created_at")
      .order("created_at", { ascending: false }).limit(50)
      .then(({ data }) => setLogs(data ?? []));
  }, []);
  return (
    <div className="card-elevated overflow-hidden">
      <div className="px-5 py-4 border-b border-border">
        <h2 className="font-semibold">Logs de Atividade (últimos 50)</h2>
      </div>
      <div className="divide-y divide-border max-h-96 overflow-y-auto">
        {logs.length === 0 && <div className="p-6 text-center text-sm text-muted-foreground">Nenhuma atividade registrada ainda.</div>}
        {logs.map((l) => (
          <div key={l.id} className="px-5 py-3 flex items-center justify-between text-sm">
            <div>
              <span className="font-medium">{actionLabel(l.action)}</span>
              <span className="text-muted-foreground"> · {l.user_email ?? "—"}</span>
              {l.page_accessed && <span className="text-xs text-muted-foreground"> · {l.page_accessed}</span>}
            </div>
            <span className="text-xs text-muted-foreground">{new Date(l.created_at).toLocaleString("pt-BR")}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: AccountStatus }) {
  const cls = status === "active"
    ? "bg-primary/10 text-primary"
    : status === "pending"
    ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
    : "bg-destructive/10 text-destructive";
  const label = status === "active" ? "Ativo" : status === "pending" ? "Pendente" : "Suspenso";
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>{label}</span>;
}

function roleLabel(r: AppRole) {
  return {
    super_admin: "Super Admin",
    church_admin: "Admin Igreja",
    admin: "Admin",
    finance_manager: "Financeiro",
    member: "Membro",
  }[r];
}

function actionLabel(a: string) {
  const map: Record<string, string> = {
    login: "Login",
    logout: "Logout",
    signup: "Cadastro",
    member_created: "Membro criado",
    member_updated: "Membro atualizado",
    member_status_changed: "Status do membro alterado",
    payment_added: "Pagamento adicionado",
    subscription_created: "Assinatura criada",
    cash_donation_added: "Doação em dinheiro",
    user_role_changed: "Função alterada",
    user_status_changed: "Status do usuário alterado",
    user_deleted: "Usuário excluído",
  };
  return map[a] ?? a;
}
