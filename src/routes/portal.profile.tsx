import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Camera, Save, User as UserIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { EmergencyContactFields } from "@/components/EmergencyContactFields";
import { parseEmergencyContact, serializeEmergencyContact, type EmergencyContact } from "@/lib/emergencyContact";
import { createSubscriptionSession } from "@/lib/stripe-subscriptions.functions";

interface MemberData {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  emergency_contact: string | null;
  profile_photo_url: string | null;
  subscription_active: boolean;
  status_payment: string | null;
}

export const Route = createFileRoute("/portal/profile")({
  component: MemberProfile,
});

function MemberProfile() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [member, setMember] = useState<MemberData | null>(null);
  const [address, setAddress] = useState("");
  const [emergency, setEmergency] = useState<EmergencyContact>({ name: "", phone: "", relationship: "" });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function load() {
      if (!user) return;
      const { data } = await supabase
        .from("members")
        .select("id, name, email, phone, address, emergency_contact, profile_photo_url, subscription_active, status_payment")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) {
        setMember(data as MemberData);
        setAddress(data.address ?? "");
        setEmergency(parseEmergencyContact(data.emergency_contact));
      }
    }
    load();
  }, [user]);

  const handleSave = async () => {
    if (!member) return;
    setSaving(true);
    const serialized = serializeEmergencyContact(emergency);
    const { error } = await supabase
      .from("members")
      .update({ address, emergency_contact: serialized })
      .eq("id", member.id);
    setSaving(false);
    if (error) {
      toast.error(t("portal.saveError", { message: error.message }));
    } else {
      toast.success(t("portal.profileUpdated"));
      setMember({ ...member, address, emergency_contact: serialized });
    }
  };

  const handleSubscribe = async () => {
    if (!member || member.subscription_active) return;

    setSubscribing(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Please sign in again.");

      const result = await createSubscriptionSession({
        data: { memberId: member.id },
        headers: { authorization: `Bearer ${token}` },
      });

      if (!result.url) throw new Error("Unable to start checkout.");
      window.location.href = result.url;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to start checkout.");
      setSubscribing(false);
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
      toast.error(t("portal.uploadError", { message: upErr.message }));
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
      toast.error(t("portal.photoSaveError", { message: updErr.message }));
    } else {
      setMember({ ...member, profile_photo_url: url });
      toast.success(t("portal.photoUpdated"));
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
              title={t("portal.changePhoto")}
            >
              <Camera className="h-4 w-4" />
            </button>
            <input ref={fileInput} type="file" accept="image/*" onChange={handlePhoto} className="hidden" />
          </div>
          <div className="flex-1">
            <h2 className="font-display text-xl font-semibold text-foreground">{member.name}</h2>
            <p className="text-sm text-muted-foreground">{member.email}</p>
            {uploading && <p className="text-xs text-primary mt-1">{t("portal.uploadingPhoto")}</p>}
          </div>
        </div>
      </div>

      <div className="card-elevated p-6 space-y-4">
        <h3 className="font-display text-base font-medium text-foreground">{t("portal.fixedInfo")}</h3>
        <div className="grid gap-3 sm:grid-cols-2 text-sm">
          <ReadField label={t("common.name")} value={member.name} />
          <ReadField label={t("common.email")} value={member.email} />
          <ReadField label={t("common.phone")} value={member.phone} />
        </div>
        <p className="text-xs text-muted-foreground">
          {t("portal.fixedInfoNote")}
        </p>
      </div>

      <div className="card-elevated p-6 space-y-4">
        <h3 className="font-display text-base font-medium text-foreground">{t("portal.editableInfo")}</h3>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">{t("memberProfile.address")}</label>
          <textarea
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            rows={2}
            className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder={t("portal.addressPlaceholder")}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">{t("memberProfile.emergencyContact")}</label>
          <EmergencyContactFields value={emergency} onChange={setEmergency} />
        </div>
        <button onClick={handleSave} disabled={saving} className="btn-google flex items-center gap-2 disabled:opacity-50">
          <Save className="h-4 w-4" />
          {saving ? t("portal.savingProfile") : t("portal.saveChanges")}
        </button>
      </div>

      <div className="card-elevated p-6 space-y-4">
        <h3 className="font-display text-base font-medium text-foreground">{t("portal.pastorSalary")}</h3>
        <div className="grid gap-3 sm:grid-cols-2 text-sm">
          <ReadField label={t("portal.subscriptionLabel")} value={member.subscription_active ? t("portal.subscriptionActive") : t("portal.subscriptionPending")} />
          <ReadField label={t("common.status")} value={member.status_payment ?? t("portal.subscriptionPending")} />
        </div>
        <button
          onClick={handleSubscribe}
          disabled={member.subscription_active || subscribing}
          className="flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {member.subscription_active ? t("portal.subscriptionActive") : subscribing ? t("portal.redirecting") : t("portal.subscribeWeekly")}
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
