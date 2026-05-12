import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import wayMakerLogo from "@/assets/waymaker-logo.png";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "New Password — Way Maker Church" }] }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (password.length < 8) return setError(t("auth.errors.passwordMin"));
    if (!/[A-Za-z]/.test(password)) return setError(t("auth.errors.passwordLetter"));
    if (!/[0-9]/.test(password)) return setError(t("auth.errors.passwordDigit"));
    if (password !== confirm) return setError(t("auth.errors.passwordMismatch"));
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      const msg = error.message?.toLowerCase() ?? "";
      if (msg.includes("pwned") || msg.includes("compromised") || msg.includes("weak")) {
        setError(t("auth.errors.passwordPwned"));
      } else if (msg.includes("same") || msg.includes("different")) {
        setError(t("auth.errors.passwordSame"));
      } else {
        setError(error.message);
      }
      return;
    }
    navigate({ to: "/dashboard" });
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
          <h1 className="font-display text-2xl font-semibold">{t("auth.resetTitle")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("auth.resetSubtitle")}</p>
        </div>
        <form onSubmit={handleSubmit} className="card-elevated p-6 space-y-4">
          {!ready && (
            <div className="rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">
              {t("auth.resetValidating")}
            </div>
          )}
          {error && <div className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>}
          <div>
            <label className="block text-sm font-medium mb-1.5">{t("auth.newPassword")}</label>
            <div className="relative">
              <input type={showPassword ? "text" : "password"} required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-input bg-background px-4 py-2.5 pr-11 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
              <button type="button" onClick={() => setShowPassword((v) => !v)} tabIndex={-1}
                aria-label={showPassword ? t("auth.hidePassword") : t("auth.showPassword")}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground">
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">{t("auth.confirmPassword")}</label>
            <div className="relative">
              <input type={showConfirm ? "text" : "password"} required minLength={8} value={confirm} onChange={(e) => setConfirm(e.target.value)}
                className="w-full rounded-xl border border-input bg-background px-4 py-2.5 pr-11 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
              <button type="button" onClick={() => setShowConfirm((v) => !v)} tabIndex={-1}
                aria-label={showConfirm ? t("auth.hidePassword") : t("auth.showPassword")}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground">
                {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <button type="submit" disabled={loading || !ready} className="btn-google w-full disabled:opacity-50">
            {loading ? t("auth.saving") : t("auth.saveNewPassword")}
          </button>
        </form>
      </div>
    </div>
  );
}
