import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Church } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import wayMakerLogo from "@/assets/waymaker-logo.png";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "Nova Senha — WAY MAKER FLOW" }] }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Supabase fires a PASSWORD_RECOVERY event when the recovery link is opened.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    // Also accept if there's already a session (user clicked link, hash processed).
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (password.length < 8) return setError("A senha deve ter no mínimo 8 caracteres.");
    if (!/[A-Za-z]/.test(password)) return setError("A senha deve conter pelo menos uma letra.");
    if (!/[0-9]/.test(password)) return setError("A senha deve conter pelo menos um número.");
    if (password !== confirm) return setError("As senhas não coincidem.");
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      // Surface clearer message for common Supabase rejections
      const msg = error.message?.toLowerCase() ?? "";
      if (msg.includes("pwned") || msg.includes("compromised") || msg.includes("weak")) {
        setError("Esta senha foi encontrada em vazamentos de dados. Escolha outra senha.");
      } else if (msg.includes("same") || msg.includes("different")) {
        setError("A nova senha deve ser diferente da senha atual.");
      } else {
        setError(error.message);
      }
      return;
    }
    navigate({ to: "/" });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex items-center justify-center">
            <img
              src={wayMakerLogo}
              alt="WAY MAKER FLOW logo"
              className="max-h-20 w-auto object-contain"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
            />
          </div>
          <h1 className="font-display text-2xl font-semibold">Nova Senha</h1>
          <p className="mt-1 text-sm text-muted-foreground">Defina uma nova senha para a sua conta WAY MAKER FLOW</p>
        </div>
        <form onSubmit={handleSubmit} className="card-elevated p-6 space-y-4">
          {!ready && (
            <div className="rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">
              Validando link de recuperação...
            </div>
          )}
          {error && <div className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>}
          <div>
            <label className="block text-sm font-medium mb-1.5">Nova Senha</label>
            <input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Confirmar Senha</label>
            <input type="password" required minLength={8} value={confirm} onChange={(e) => setConfirm(e.target.value)}
              className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <button type="submit" disabled={loading || !ready} className="btn-google w-full disabled:opacity-50">
            {loading ? "Salvando..." : "Salvar nova senha"}
          </button>
        </form>
      </div>
    </div>
  );
}
