import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Church } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import wayMakerLogo from "@/assets/waymaker-logo.png";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [{ title: "Recuperar Senha — Way Maker Church" }],
  }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) setError(error.message);
    else setSent(true);
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex items-center justify-center">
            <img
              src={wayMakerLogo}
              alt="Way Maker Church logo"
              className="max-h-20 w-auto object-contain"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
            />
          </div>
          <h1 className="font-display text-2xl font-semibold text-foreground">Recuperar Senha</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Enviaremos um link para redefinir sua senha do Way Maker Church
          </p>
        </div>

        <form onSubmit={handleSubmit} className="card-elevated p-6 space-y-4">
          {error && (
            <div className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>
          )}
          {sent ? (
            <div className="rounded-xl bg-primary/10 px-4 py-3 text-sm text-foreground">
              Se existir uma conta com este email, você receberá um link de recuperação.
              O link expira em 30 minutos.
            </div>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <button type="submit" disabled={loading} className="btn-google w-full disabled:opacity-50">
                {loading ? "Enviando..." : "Enviar link"}
              </button>
            </>
          )}
          <p className="text-center text-sm text-muted-foreground">
            <Link to="/login" className="text-primary font-medium hover:underline">
              Voltar para login
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
