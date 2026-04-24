import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/unsubscribe")({
  head: () => ({ meta: [{ title: "Cancelar inscrição — Way Maker Church" }] }),
  component: UnsubscribePage,
});

type State =
  | { kind: "loading" }
  | { kind: "ready" }
  | { kind: "already" }
  | { kind: "invalid" }
  | { kind: "submitting" }
  | { kind: "done" }
  | { kind: "error"; message: string };

function UnsubscribePage() {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("token");
    if (!t) {
      setState({ kind: "invalid" });
      return;
    }
    setToken(t);
    fetch(`/email/unsubscribe?token=${encodeURIComponent(t)}`)
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) {
          setState({ kind: "invalid" });
          return;
        }
        if (j.valid) setState({ kind: "ready" });
        else if (j.reason === "already_unsubscribed") setState({ kind: "already" });
        else setState({ kind: "invalid" });
      })
      .catch(() => setState({ kind: "invalid" }));
  }, []);

  const confirm = async () => {
    if (!token) return;
    setState({ kind: "submitting" });
    try {
      const r = await fetch("/email/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setState({ kind: "error", message: j.error || "Falha ao processar" });
        return;
      }
      if (j.success || j.reason === "already_unsubscribed") setState({ kind: "done" });
      else setState({ kind: "error", message: "Falha ao processar" });
    } catch (e) {
      setState({ kind: "error", message: e instanceof Error ? e.message : "Erro" });
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-sm text-center">
        <h1 className="font-display text-2xl font-semibold mb-3">Cancelar inscrição</h1>
        {state.kind === "loading" && (
          <p className="text-muted-foreground">Validando link...</p>
        )}
        {state.kind === "ready" && (
          <>
            <p className="text-muted-foreground mb-6">
              Confirma que deseja parar de receber emails do Way Maker Church?
            </p>
            <button onClick={confirm} className="btn-google w-full">
              Confirmar cancelamento
            </button>
          </>
        )}
        {state.kind === "submitting" && (
          <p className="text-muted-foreground">Processando...</p>
        )}
        {state.kind === "done" && (
          <p className="text-foreground">
            Pronto. Você não receberá mais emails deste tipo.
          </p>
        )}
        {state.kind === "already" && (
          <p className="text-muted-foreground">
            Este endereço já está cancelado.
          </p>
        )}
        {state.kind === "invalid" && (
          <p className="text-destructive">Link inválido ou expirado.</p>
        )}
        {state.kind === "error" && (
          <p className="text-destructive">{state.message}</p>
        )}
      </div>
    </div>
  );
}
