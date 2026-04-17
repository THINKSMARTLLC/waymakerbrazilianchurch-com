import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Camera, Save, User as UserIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface MemberData {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  emergency_contact: string | null;
  profile_photo_url: string | null;
}

export const Route = createFileRoute("/portal/profile")({
  component: MemberProfile,
});

function MemberProfile() {
  const { user } = useAuth();
  const [member, setMember] = useState<MemberData | null>(null);
  const [address, setAddress] = useState("");
  const [emergency, setEmergency] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function load() {
      if (!user) return;
      const { data } = await supabase
        .from("members")
        .select("id, name, email, phone, address, emergency_contact, profile_photo_url")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) {
        setMember(data as MemberData);
        setAddress(data.address ?? "");
        setEmergency(data.emergency_contact ?? "");
      }
    }
    load();
  }, [user]);

  const handleSave = async () => {
    if (!member) return;
    setSaving(true);
    const { error } = await supabase
      .from("members")
      .update({ address, emergency_contact: emergency })
      .eq("id", member.id);
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar: " + error.message);
    } else {
      toast.success("Perfil atualizado");
      setMember({ ...member, address, emergency_contact: emergency });
    }
  };

  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !member) return;
    setUploading(true);
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${user.id}/avatar-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (upErr) {
      toast.error("Erro no upload: " + upErr.message);
      setUploading(false);
      return;
    }
    const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
    const url = pub.publicUrl;
    const { error: updErr } = await supabase
      .from("members")
      .update({ profile_photo_url: url })
      .eq("id", member.id);
    setUploading(false);
    if (updErr) {
      toast.error("Erro ao salvar foto: " + updErr.message);
    } else {
      setMember({ ...member, profile_photo_url: url });
      toast.success("Foto atualizada");
    }
  };

  if (!member) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="card-elevated p-6">
        <div className="flex items-start gap-5">
          <div className="relative">
            <div className="h-24 w-24 rounded-full bg-muted flex items-center justify-center overflow-hidden border-2 border-border">
              {member.profile_photo_url ? (
                <img src={member.profile_photo_url} alt={member.name} className="h-full w-full object-cover" />
              ) : (
                <UserIcon className="h-10 w-10 text-muted-foreground" />
              )}
            </div>
            <button
              onClick={() => fileInput.current?.click()}
              disabled={uploading}
              className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow hover:opacity-90 disabled:opacity-50"
              title="Trocar foto"
            >
              <Camera className="h-4 w-4" />
            </button>
            <input ref={fileInput} type="file" accept="image/*" onChange={handlePhoto} className="hidden" />
          </div>
          <div className="flex-1">
            <h2 className="font-display text-xl font-semibold text-foreground">{member.name}</h2>
            <p className="text-sm text-muted-foreground">{member.email}</p>
            {uploading && <p className="text-xs text-primary mt-1">Enviando foto...</p>}
          </div>
        </div>
      </div>

      <div className="card-elevated p-6 space-y-4">
        <h3 className="font-display text-base font-medium text-foreground">Informações fixas</h3>
        <div className="grid gap-3 sm:grid-cols-2 text-sm">
          <ReadField label="Nome" value={member.name} />
          <ReadField label="Email" value={member.email} />
          <ReadField label="Telefone" value={member.phone} />
        </div>
        <p className="text-xs text-muted-foreground">
          Para alterar nome, email ou telefone, entre em contato com o administrador.
        </p>
      </div>

      <div className="card-elevated p-6 space-y-4">
        <h3 className="font-display text-base font-medium text-foreground">Informações editáveis</h3>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">Endereço</label>
          <textarea
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            rows={2}
            className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="Rua, número, cidade..."
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">Contato de emergência</label>
          <input
            type="text"
            value={emergency}
            onChange={(e) => setEmergency(e.target.value)}
            className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="Nome e telefone"
          />
        </div>
        <button onClick={handleSave} disabled={saving} className="btn-google flex items-center gap-2 disabled:opacity-50">
          <Save className="h-4 w-4" />
          {saving ? "Salvando..." : "Salvar alterações"}
        </button>
      </div>
    </div>
  );
}

function ReadField({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-foreground mt-0.5">{value || "—"}</p>
    </div>
  );
}
