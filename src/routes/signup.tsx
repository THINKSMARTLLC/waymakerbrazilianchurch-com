import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Church } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { logActivity } from "@/lib/activityLog";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Criar Conta — ChurchFlow" },
      { name: "description", content: "Crie sua conta no ChurchFlow" },
    ],
  }),
  component: SignupPage,
});

const ROLES = [
  { value: "church_admin", label: "Pastor / Admin da Igreja" },
  { value: "finance_manager", label: "Financeiro" },
  { value: "member", label: "Membro" },
] as const;

function SignupPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    churchName: "",
    role: "member",
    password: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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

    setLoading(true);
    const { data, error: signupError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: {
          full_name: form.fullName,
          phone: form.phone,
          church_name: form.churchName,
          requested_role: form.role,
        },
      },
    });

    if (signupError) {
      setError(signupError.message);
      setLoading(false);
      return;
    }

    if (data.user) {
      await logActivity("signup", { role: form.role });
    }

    setLoading(false);
    // For staff roles, profile is "pending" — show notice; member is active.
    if (form.role === "member") {
      navigate({ to: "/" });
    } else {
      navigate({ to: "/pending" });
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary">
            <Church className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="font-display text-2xl font-semibold text-foreground">Criar Conta</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Comece a gerenciar sua igreja em minutos
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
            <input type="tel" required value={form.phone} onChange={update("phone")} className={fieldCls} />
          </Field>
          <Field label="Nome da Igreja">
            <input required value={form.churchName} onChange={update("churchName")} className={fieldCls} />
          </Field>
          <Field label="Função">
            <select value={form.role} onChange={update("role")} className={fieldCls}>
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Senha (mín. 8 caracteres)">
            <input type="password" required minLength={8} value={form.password} onChange={update("password")} className={fieldCls} />
          </Field>
          <Field label="Confirmar Senha">
            <input type="password" required minLength={8} value={form.confirmPassword} onChange={update("confirmPassword")} className={fieldCls} />
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
