import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PortalLayout } from "@/components/PortalLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AlertTriangle, LogOut } from "lucide-react";

export const Route = createFileRoute("/portal")({
  head: () => ({
    meta: [
      { title: "Portal do Membro — Way Maker Church" },
      { name: "description", content: "Seu portal pessoal de contribuições" },
    ],
  }),
  component: PortalGate,
});

function PortalGate() {
  const { user, signOut, loading } = useAuth();
  const [memberStatus, setMemberStatus] = useState<"active" | "inactive" | "unknown" | "loading">("loading");

  useEffect(() => {
    if (loading) return;
    if (!user) {
      setMemberStatus("unknown");
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("members")
        .select("status")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      if (!data) setMemberStatus("unknown");
      else setMemberStatus(data.status === "inactive" ? "inactive" : "active");
    })();
    return () => {
      cancelled = true;
    };
  }, [user, loading]);

  if (memberStatus === "loading" || loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (memberStatus === "inactive") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="card-elevated w-full max-w-md p-6 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <h1 className="font-display text-xl font-semibold text-foreground">
            Conta inativa
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sua conta de membro foi desativada e o acesso ao portal está bloqueado.
            Entre em contato com a administração da igreja para mais informações.
          </p>
          <div className="mt-5 flex flex-col gap-2">
            <button
              onClick={() => signOut()}
              className="btn-google inline-flex items-center justify-center gap-2"
            >
              <LogOut className="h-4 w-4" />
              Sair
            </button>
            <Link
              to="/login"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Voltar para o login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <PortalLayout />;
}
