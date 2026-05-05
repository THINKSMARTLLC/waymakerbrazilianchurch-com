import { useState, type FormEvent } from "react";
import { X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { EmergencyContactFields } from "@/components/EmergencyContactFields";
import { parseEmergencyContact, serializeEmergencyContact } from "@/lib/emergencyContact";

type Member = Database["public"]["Tables"]["members"]["Row"];

interface EditMemberModalProps {
  member: Member;
  onClose: () => void;
  onSaved: () => void;
}

export function EditMemberModal({ member, onClose, onSaved }: EditMemberModalProps) {
  const [name, setName] = useState(member.name ?? "");
  const [email, setEmail] = useState(member.email ?? "");
  const [phone, setPhone] = useState(member.phone ?? "");
  const [dateOfBirth, setDateOfBirth] = useState(member.date_of_birth ?? "");
  const [address, setAddress] = useState(member.address ?? "");
  const [emergency, setEmergency] = useState(() => parseEmergencyContact(member.emergency_contact));
  const [memberRole, setMemberRole] = useState(member.member_role ?? "");
  const [department, setDepartment] = useState(member.department ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const { error: updateError } = await supabase
      .from("members")
      .update({
        name: name.trim(),
        email: email.trim() || null,
        phone: phone.trim() || null,
        date_of_birth: dateOfBirth || null,
        address: address.trim() || null,
        emergency_contact: serializeEmergencyContact(emergency),
        member_role: memberRole.trim() || null,
        department: department.trim() || null,
      })
      .eq("id", member.id);

    setSaving(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    onSaved();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="card-elevated w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-border p-5 sticky top-0 bg-card">
          <h3 className="font-display text-lg font-semibold text-foreground">Editar Membro</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Informações Básicas</h4>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Nome Completo *</label>
                <input type="text" required value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Email</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Telefone</label>
                  <input type="tel" inputMode="numeric" maxLength={14} placeholder="(555) 555-5555" value={phone} onChange={(e) => setPhone(formatUSPhoneInput(e.target.value))} className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm" />
                </div>
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Informações Pessoais</h4>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Data de Nascimento</label>
                <input type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Endereço</label>
                <textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={2} className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm" />
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Contato de Emergência</h4>
            <EmergencyContactFields value={emergency} onChange={setEmergency} />
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Informações da Igreja</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Cargo</label>
                <input type="text" value={memberRole} onChange={(e) => setMemberRole(e.target.value)} placeholder="Ex: Diácono, Líder" className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Departamento</label>
                <input type="text" value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="Ex: Louvor, Infantil" className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm" />
              </div>
            </div>
          </div>

          {error && <div className="text-sm text-destructive">{error}</div>}

          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <button type="button" onClick={onClose} className="rounded-xl border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-muted">Cancelar</button>
            <button type="submit" disabled={saving} className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
              {saving ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
