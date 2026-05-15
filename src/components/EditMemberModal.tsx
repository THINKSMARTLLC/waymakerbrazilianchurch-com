import { useEffect, useState, type FormEvent } from "react";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { EmergencyContactFields } from "@/components/EmergencyContactFields";
import { parseEmergencyContact, serializeEmergencyContact } from "@/lib/emergencyContact";
import { formatUSPhoneInput } from "@/lib/phone";

type Member = Database["public"]["Tables"]["members"]["Row"];
type FamilyRole = Database["public"]["Enums"]["family_role"];
interface FamilyOption { id: string; name: string }

interface EditMemberModalProps {
  member: Member;
  onClose: () => void;
  onSaved: () => void;
}

export function EditMemberModal({ member, onClose, onSaved }: EditMemberModalProps) {
  const { t } = useTranslation();
  const [name, setName] = useState(member.name ?? "");
  const [email, setEmail] = useState(member.email ?? "");
  const [phone, setPhone] = useState(member.phone ?? "");
  const [dateOfBirth, setDateOfBirth] = useState(member.date_of_birth ?? "");
  const [address, setAddress] = useState(member.address ?? "");
  const [emergency, setEmergency] = useState(() => parseEmergencyContact(member.emergency_contact));
  const [memberRole, setMemberRole] = useState(member.member_role ?? "");
  const [department, setDepartment] = useState(member.department ?? "");
  const [familyId, setFamilyId] = useState<string>(member.family_id ?? "");
  const [familyRole, setFamilyRole] = useState<FamilyRole>((member.family_role ?? "individual") as FamilyRole);
  const [newFamilyName, setNewFamilyName] = useState("");
  const [families, setFamilies] = useState<FamilyOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.from("families").select("id, name").order("name").then(({ data }) => {
      setFamilies((data ?? []) as FamilyOption[]);
    });
  }, []);


  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    let resolvedFamilyId: string | null = familyId || null;

    // Create-on-the-fly family if requested.
    if (familyId === "__new__") {
      const trimmed = newFamilyName.trim();
      if (!trimmed) {
        setSaving(false);
        setError("Family name is required.");
        return;
      }
      const { data: created, error: famErr } = await supabase
        .from("families")
        .insert({ name: trimmed })
        .select("id")
        .single();
      if (famErr || !created) {
        setSaving(false);
        setError(famErr?.message ?? "Could not create family.");
        return;
      }
      resolvedFamilyId = created.id;
    }

    const effectiveFamilyRole: FamilyRole = resolvedFamilyId ? familyRole : "individual";

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
        family_id: resolvedFamilyId,
        family_role: effectiveFamilyRole,
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
          <h3 className="font-display text-lg font-semibold text-foreground">{t("modals.editMember")}</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">{t("modals.basicInfo")}</h4>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">{t("modals.fullNameRequired")}</label>
                <input type="text" required value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">{t("common.email")}</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">{t("common.phone")}</label>
                  <input type="tel" inputMode="numeric" maxLength={14} placeholder="(555) 555-5555" value={phone} onChange={(e) => setPhone(formatUSPhoneInput(e.target.value))} className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm" />
                </div>
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">{t("modals.personalInfo")}</h4>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">{t("auth.dateOfBirth")}</label>
                <input type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">{t("auth.address")}</label>
                <textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={2} className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm" />
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">{t("auth.emergencyContact")}</h4>
            <EmergencyContactFields value={emergency} onChange={setEmergency} />
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">{t("modals.churchInfo")}</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">{t("auth.role")}</label>
                <input type="text" value={memberRole} onChange={(e) => setMemberRole(e.target.value)} className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">{t("auth.department")}</label>
                <input type="text" value={department} onChange={(e) => setDepartment(e.target.value)} className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm" />
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Family</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Family</label>
                <select
                  value={familyId}
                  onChange={(e) => setFamilyId(e.target.value)}
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">— None (individual)</option>
                  {families.map((f) => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                  <option value="__new__">+ Create new family…</option>
                </select>
                {familyId === "__new__" && (
                  <input
                    type="text"
                    placeholder="New family name"
                    value={newFamilyName}
                    onChange={(e) => setNewFamilyName(e.target.value)}
                    className="mt-2 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                  />
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Role in family</label>
                <select
                  value={familyRole}
                  onChange={(e) => setFamilyRole(e.target.value as FamilyRole)}
                  disabled={!familyId}
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm disabled:opacity-50"
                >
                  <option value="individual">Individual</option>
                  <option value="family_owner">Family owner (pays)</option>
                  <option value="family_member">Family member</option>
                  <option value="sponsored">Sponsored</option>
                </select>
              </div>
            </div>
          </div>

          {error && <div className="text-sm text-destructive">{error}</div>}

          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <button type="button" onClick={onClose} className="rounded-xl border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-muted">{t("common.cancel")}</button>
            <button type="submit" disabled={saving} className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
              {saving ? t("auth.saving") : t("common.save")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
