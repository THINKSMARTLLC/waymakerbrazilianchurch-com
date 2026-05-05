import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Church, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { logActivity } from "@/lib/activityLog";
import { EmergencyContactFields } from "@/components/EmergencyContactFields";
import { serializeEmergencyContact, type EmergencyContact } from "@/lib/emergencyContact";
import wayMakerLogo from "@/assets/waymaker-logo.png";
import { formatUSPhoneInput } from "@/lib/phone";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Criar Conta — Way Maker Church" },
      { name: "description", content: "Crie sua conta no Way Maker Church" },
    ],
  }),
  component: SignupPage,
});

const ROLES = [
  { value: "member", label: "Membro" },
  { value: "deacon", label: "Diácono" },
  { value: "worker", label: "Obreiro" },
  { value: "intercessor", label: "Intercessor" },
  { value: "treasurer", label: "Tesoureiro" },
  { value: "singer", label: "Cantor" },
  { value: "musician", label: "Músico" },
  { value: "other", label: "Outro" },
] as const;

const DEPARTMENTS = [
  { value: "kids", label: "Kids" },
  { value: "youth", label: "Jovens" },
  { value: "finance", label: "Financeiro" },
  { value: "worship", label: "Louvor" },
  { value: "cleaning", label: "Limpeza" },
  { value: "kitchen", label: "Cozinha" },
  { value: "other", label: "Outro" },
] as const;

const COUNTRIES = [
  { value: "+1", label: "🇺🇸 United States (+1)" },
  { value: "+55", label: "🇧🇷 Brasil (+55)" },
  { value: "other", label: "Outro (código manual)" },
] as const;

// Roles that grant staff/admin access — these still need the existing requested_role mapping
const STAFF_ROLE_REQUEST = "member"; // signup form only creates members; staff are provisioned by admins

function SignupPage() {
  const navigate = useNavigate();
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

  const update = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm({ ...form, [k]: e.target.value });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (form.password.length < 8) {
      setError("A senha deve ter no mínimo 8 caracteres.");
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }

    const code = form.countryCode === "other" ? form.customCountryCode.trim() : form.countryCode;
    if (!code || !/^\+?\d{1,4}$/.test(code.startsWith("+") ? code : `+${code}`)) {
      setError("Código do país inválido.");
      return;
    }
    const normalizedCode = code.startsWith("+") ? code : `+${code}`;
    const fullPhone = `${normalizedCode} ${form.phone.replace(/^\+?\d{1,4}\s*/, "").trim()}`;

    setLoading(true);

    // Block registration only on TRUE duplicates (same email, or same name +
    // phone). Shared-phone matches alone (different name) are allowed —
    // multiple people in a household may legitimately share a phone number.
    const { findDuplicates } = await import("@/lib/duplicates");
    const dupes = await findDuplicates({ email: form.email, phone: fullPhone, name: form.fullName });
    const blocking = dupes.filter((d) => d.severity === "duplicate");
    if (blocking.length > 0) {
      setError("Esta conta já existe. Por favor, faça login ou redefina sua senha.");
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
            Criar conta — comece a gerenciar sua igreja em minutos
          </p>
        </div>

        <form onSubmit={handleSubmit} className="card-elevated p-6 space-y-4">
          {error && (
            <div className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <Field label="Nome Completo">
            <input required value={form.fullName} onChange={update("fullName")} className={fieldCls} />
          </Field>
          <Field label="Email">
            <input type="email" required value={form.email} onChange={update("email")} className={fieldCls} />
          </Field>

          <Field label="Telefone">
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
                placeholder="Código do país (ex: +351)"
                className={`${fieldCls} mt-2`}
              />
            )}
          </Field>

          <Field label="Data de Nascimento">
            <input type="date" required value={form.dateOfBirth} onChange={update("dateOfBirth")} className={fieldCls} />
          </Field>

          <Field label="Endereço">
            <input required value={form.address} onChange={update("address")} className={fieldCls} placeholder="Rua, número, cidade" />
          </Field>

          <div>
            <label className="block text-sm font-semibold text-foreground mb-2">Contato de Emergência <span className="text-destructive">*</span></label>
            <EmergencyContactFields value={emergency} onChange={setEmergency} required />
          </div>

          <Field label="Nome da Igreja">
            <input required value={form.churchName} onChange={update("churchName")} className={fieldCls} />
          </Field>

          <Field label="Cargo">
            <select value={form.role} onChange={update("role")} className={fieldCls}>
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </Field>

          <Field label="Departamento">
            <select value={form.department} onChange={update("department")} className={fieldCls}>
              {DEPARTMENTS.map((d) => (
                <option key={d.value} value={d.value}>{d.label}</option>
              ))}
            </select>
          </Field>

          <Field label="Senha (mín. 8 caracteres)">
            <div className="relative">
              <input type={showPassword ? "text" : "password"} required minLength={8} value={form.password} onChange={update("password")} className={`${fieldCls} pr-11`} />
              <button type="button" onClick={() => setShowPassword((v) => !v)} tabIndex={-1}
                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground">
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </Field>
          <Field label="Confirmar Senha">
            <div className="relative">
              <input type={showConfirm ? "text" : "password"} required minLength={8} value={form.confirmPassword} onChange={update("confirmPassword")} className={`${fieldCls} pr-11`} />
              <button type="button" onClick={() => setShowConfirm((v) => !v)} tabIndex={-1}
                aria-label={showConfirm ? "Ocultar senha" : "Mostrar senha"}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground">
                {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </Field>

          <button type="submit" disabled={loading} className="btn-google w-full disabled:opacity-50">
            {loading ? "Criando conta..." : "Criar Conta"}
          </button>

          <p className="text-center text-sm text-muted-foreground">
            Já tem uma conta?{" "}
            <Link to="/login" className="text-primary font-medium hover:underline">
              Entrar
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
