import { createFileRoute, Link } from "@tanstack/react-router";
import { UserPlus, Search, Eye, Edit, CreditCard } from "lucide-react";
import { useState, useEffect, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export const Route = createFileRoute("/members/")({
  head: () => ({
    meta: [
      { title: "Membros — ChurchFlow" },
      { name: "description", content: "Gerenciar membros da igreja" },
    ],
  }),
  component: MembersPage,
});

type Member = Database["public"]["Tables"]["members"]["Row"];

function MembersPage() {
  const [search, setSearch] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMembers = async () => {
    const { data } = await supabase
      .from("members")
      .select("*")
      .order("created_at", { ascending: false });
    setMembers(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchMembers();
  }, []);

  const filtered = members.filter(
    (m) =>
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      (m.email || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar membros..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-input bg-card py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <button onClick={() => setShowAddModal(true)} className="btn-google inline-flex items-center gap-2">
          <UserPlus className="h-4 w-4" />
          Novo Membro
        </button>
      </div>

      <div className="card-elevated overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            {members.length === 0 ? "Nenhum membro cadastrado ainda." : "Nenhum resultado encontrado."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="table-header px-5 py-3 text-left">Nome</th>
                  <th className="table-header px-5 py-3 text-left hidden sm:table-cell">Email</th>
                  <th className="table-header px-5 py-3 text-left hidden md:table-cell">Telefone</th>
                  <th className="table-header px-5 py-3 text-left">Pagamento</th>
                  <th className="table-header px-5 py-3 text-left">Status</th>
                  <th className="table-header px-5 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((member) => (
                  <tr key={member.id} className="border-b border-border last:border-0 hover:bg-muted/50 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-primary">
                          {member.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                        </div>
                        <span className="text-sm font-medium text-foreground">{member.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-muted-foreground hidden sm:table-cell">{member.email}</td>
                    <td className="px-5 py-3.5 text-sm text-muted-foreground hidden md:table-cell">{member.phone}</td>
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground capitalize">
                        {member.payment_type === "card" ? <CreditCard className="h-3.5 w-3.5" /> : <span className="text-xs">💵</span>}
                        {member.payment_type === "card" ? "Cartão" : "Dinheiro"}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`status-badge ${member.status === "active" ? "status-active" : "status-inactive"}`}>
                        {member.status === "active" ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          to="/members/$memberId"
                          params={{ memberId: member.id }}
                          className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                        >
                          <Eye className="h-4 w-4" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showAddModal && <AddMemberModal onClose={() => setShowAddModal(false)} onSaved={fetchMembers} />}
    </div>
  );
}

function AddMemberModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    const form = new FormData(e.currentTarget);
    const { error } = await supabase.from("members").insert({
      name: form.get("name") as string,
      email: (form.get("email") as string) || null,
      phone: (form.get("phone") as string) || null,
      payment_type: form.get("payment_type") as "card" | "cash",
    });

    if (error) {
      setError(error.message);
      setSaving(false);
    } else {
      onSaved();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20 backdrop-blur-sm p-4">
      <div className="card-elevated w-full max-w-md p-6">
        <h2 className="font-display text-lg font-semibold text-foreground mb-5">Novo Membro</h2>
        <form className="space-y-4" onSubmit={handleSubmit}>
          {error && <div className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Nome</label>
            <input name="name" type="text" required className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring" placeholder="Nome completo" />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Email</label>
            <input name="email" type="email" className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring" placeholder="email@exemplo.com" />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Telefone</label>
            <input name="phone" type="tel" className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring" placeholder="(11) 99999-0000" />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Método de Pagamento</label>
            <select name="payment_type" className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
              <option value="card">Cartão</option>
              <option value="cash">Dinheiro</option>
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-input bg-background px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={saving} className="btn-google flex-1 disabled:opacity-50">
              {saving ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
