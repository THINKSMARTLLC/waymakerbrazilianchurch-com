import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Church } from "lucide-react";
import { useState as useImgState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { logActivity } from "@/lib/activityLog";
import { supabase } from "@/integrations/supabase/client";
import wayMakerLogo from "@/assets/waymaker-logo.png";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Login — WAY MAKER FLOW" },
      { name: "description", content: "Sign in to WAY MAKER FLOW" },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [logoError, setLogoError] = useImgState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { error } = await signIn(email, password);
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    // Update last_login_at + log
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("user_profiles").update({ last_login_at: new Date().toISOString() }).eq("user_id", user.id);
      await logActivity("login");
    }
    navigate({ to: "/dashboard" });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex items-center justify-center">
            {logoError ? (
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary">
                <Church className="h-7 w-7 text-primary-foreground" />
              </div>
            ) : (
              <img
                src={wayMakerLogo}
                alt="WAY MAKER FLOW logo"
                className="max-h-20 w-auto object-contain"
                onError={() => setLogoError(true)}
              />
            )}
          </div>
          <h1 className="font-display text-2xl font-semibold text-foreground">WAY MAKER FLOW</h1>
          <p className="mt-1 text-sm text-muted-foreground">Gestão financeira simples para sua igreja</p>
        </div>

        <form onSubmit={handleSubmit} className="card-elevated p-6 space-y-4">
          {error && (
            <div className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>
          )}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="voce@igreja.org"
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-sm font-medium text-foreground">Senha</label>
              <Link to="/forgot-password" className="text-xs text-primary hover:underline">
                Esqueceu a senha?
              </Link>
            </div>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="••••••••"
            />
          </div>
          <button type="submit" disabled={loading} className="btn-google w-full disabled:opacity-50">
            {loading ? "Entrando..." : "Entrar"}
          </button>

          <div className="relative my-2">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
            <div className="relative flex justify-center text-xs"><span className="bg-card px-2 text-muted-foreground">ou</span></div>
          </div>

          <Link
            to="/signup"
            className="flex w-full items-center justify-center rounded-xl border border-input bg-background px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
          >
            Criar Conta
          </Link>
        </form>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Ao entrar, você aceita nossos termos de uso e política de privacidade.
        </p>
      </div>
    </div>
  );
}
