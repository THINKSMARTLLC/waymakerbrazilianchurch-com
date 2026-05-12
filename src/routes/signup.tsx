import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Church, Eye, EyeOff } from "lucide-react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { logActivity } from "@/lib/activityLog";
import { EmergencyContactFields } from "@/components/EmergencyContactFields";
import { serializeEmergencyContact, type EmergencyContact } from "@/lib/emergencyContact";
import wayMakerLogo from "@/assets/waymaker-logo.png";
import { formatUSPhoneInput } from "@/lib/phone";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Create Account — Way Maker Church" },
      { name: "description", content: "Create your Way Maker Church account" },
    ],
  }),
  component: SignupPage,
});

const ROLE_KEYS = ["member", "deacon", "worker", "intercessor", "treasurer", "singer", "musician", "other"] as const;
const DEPT_KEYS = ["kids", "youth", "finance", "worship", "cleaning", "kitchen", "other"] as const;

const STAFF_ROLE_REQUEST = "member";

function SignupPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    countryCode: "+1",
    customCountryCode: "",
    phone: "",
    churchName: "",
    dateOfBirth: "",
    address: "",
    emergencyContact: "",
    role: "member",
    department: "kids",
    password: "",
    confirmPassword: "",
  });
  const [emergency, setEmergency] = useState<EmergencyContact>({ name: "", phone: "", relationship: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const COUNTRIES = [
    { value: "+1", label: "🇺🇸 United States (+1)" },
    { value: "+55", label: "🇧🇷 Brasil (+55)" },
    { value: "other", label: t("auth.countryOther") },
  ];

  const update = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm({ ...form, [k]: e.target.value });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (form.password.length < 8) {
      setError(t("auth.errors.passwordMin"));
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError(t("auth.errors.passwordMismatch"));
      return;
    }

    const phoneDigits = form.phone.replace(/\D/g, "");
    if (phoneDigits.length !== 10) {
      setError(t("auth.errors.phoneInvalid"));
      return;
    }
    const fullPhone = formatUSPhoneInput(form.phone);

    setLoading(true);

    const { findDuplicates } = await import("@/lib/duplicates");
    const dupes = await findDuplicates({ email: form.email, phone: fullPhone, name: form.fullName });
    const blocking = dupes.filter((d) => d.severity === "duplicate");
    if (blocking.length > 0) {
      setError(t("auth.errors.accountExists"));
      setLoading(false);
      return;
    }

    const { data, error: signupError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: {
          full_name: form.fullName,
          phone: fullPhone,
          church_name: form.churchName,
          requested_role: STAFF_ROLE_REQUEST,
          date_of_birth: form.dateOfBirth || null,
          address: form.address,
          emergency_contact: serializeEmergencyContact(emergency),
          member_role: form.role,
          department: form.department,
        },
      },
    });

    if (signupError) {
      setError(signupError.message);
      setLoading(false);
      return;
    }

    if (data.user) {
      await logActivity("signup", { role: form.role, department: form.department });
    }

    setLoading(false);
    navigate({ to: "/dashboard" });
  };

  const [logoError, setLogoError] = useState(false);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex items-center justify-center">
            {logoError ? (
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary">
                <Church className="h-7 w-7 text-primary-foreground" />
              </div>
            ) : (
              <img
                src={wayMakerLogo}
                alt="Way Maker Church logo"
                className="max-h-20 w-auto object-contain"
                onError={() => setLogoError(true)}
              />
            )}
          </div>
          <h1 className="font-display text-2xl font-semibold text-foreground">Way Maker Church</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("auth.signupSubtitle")}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="card-elevated p-6 space-y-4">
          {error && (
            <div className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <Field label={t("auth.fullName")}>
            <input required value={form.fullName} onChange={update("fullName")} className={fieldCls} />
          </Field>
          <Field label={t("common.email")}>
            <input type="email" required value={form.email} onChange={update("email")} className={fieldCls} />
          </Field>

          <Field label={t("auth.phone")}>
            <div className="flex gap-2">
              <select
                value={form.countryCode}
                onChange={update("countryCode")}
                className={`${fieldCls} max-w-[42%]`}
              >
                {COUNTRIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
              <input
                type="tel"
                required
                inputMode="numeric"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: formatUSPhoneInput(e.target.value) })}
                placeholder="(555) 555-5555"
                maxLength={14}
                className={`${fieldCls} flex-1`}
              />
            </div>
            {form.countryCode === "other" && (
              <input
                required
                value={form.customCountryCode}
                onChange={update("customCountryCode")}
                placeholder={t("auth.countryCodePlaceholder")}
                className={`${fieldCls} mt-2`}
              />
            )}
          </Field>

          <Field label={t("auth.dateOfBirth")}>
            <input type="date" required value={form.dateOfBirth} onChange={update("dateOfBirth")} className={fieldCls} />
          </Field>

          <Field label={t("auth.address")}>
            <input required value={form.address} onChange={update("address")} className={fieldCls} placeholder={t("auth.addressPlaceholder")} />
          </Field>

          <div>
            <label className="block text-sm font-semibold text-foreground mb-2">{t("auth.emergencyContact")} <span className="text-destructive">*</span></label>
            <EmergencyContactFields value={emergency} onChange={setEmergency} required />
          </div>

          <Field label={t("auth.churchName")}>
            <input required value={form.churchName} onChange={update("churchName")} className={fieldCls} />
          </Field>

          <Field label={t("auth.role")}>
            <select value={form.role} onChange={update("role")} className={fieldCls}>
              {ROLE_KEYS.map((r) => (
                <option key={r} value={r}>{t(`roles.${r}`)}</option>
              ))}
            </select>
          </Field>

          <Field label={t("auth.department")}>
            <select value={form.department} onChange={update("department")} className={fieldCls}>
              {DEPT_KEYS.map((d) => (
                <option key={d} value={d}>{t(`departments.${d}`)}</option>
              ))}
            </select>
          </Field>

          <Field label={t("auth.passwordHint")}>
            <div className="relative">
              <input type={showPassword ? "text" : "password"} required minLength={8} value={form.password} onChange={update("password")} className={`${fieldCls} pr-11`} />
              <button type="button" onClick={() => setShowPassword((v) => !v)} tabIndex={-1}
                aria-label={showPassword ? t("auth.hidePassword") : t("auth.showPassword")}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground">
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </Field>
          <Field label={t("auth.confirmPassword")}>
            <div className="relative">
              <input type={showConfirm ? "text" : "password"} required minLength={8} value={form.confirmPassword} onChange={update("confirmPassword")} className={`${fieldCls} pr-11`} />
              <button type="button" onClick={() => setShowConfirm((v) => !v)} tabIndex={-1}
                aria-label={showConfirm ? t("auth.hidePassword") : t("auth.showPassword")}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground">
                {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </Field>

          <button type="submit" disabled={loading} className="btn-google w-full disabled:opacity-50">
            {loading ? t("auth.creatingAccount") : t("auth.signUp")}
          </button>

          <p className="text-center text-sm text-muted-foreground">
            {t("auth.alreadyHaveAccount")}{" "}
            <Link to="/login" className="text-primary font-medium hover:underline">
              {t("auth.signIn")}
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}

const fieldCls =
  "w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-foreground mb-1.5">{label}</label>
      {children}
    </div>
  );
}
