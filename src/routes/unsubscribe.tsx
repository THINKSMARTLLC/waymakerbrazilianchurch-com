import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/unsubscribe")({
  head: () => ({ meta: [{ title: "Unsubscribe — Way Maker Church" }] }),
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
  const { t } = useTranslation();
  const [state, setState] = useState<State>({ kind: "loading" });
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tk = params.get("token");
    if (!tk) {
      setState({ kind: "invalid" });
      return;
    }
    setToken(tk);
    fetch(`/email/unsubscribe?token=${encodeURIComponent(tk)}`)
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
        setState({ kind: "error", message: j.error || t("unsubscribe.failed") });
        return;
      }
      if (j.success || j.reason === "already_unsubscribed") setState({ kind: "done" });
      else setState({ kind: "error", message: t("unsubscribe.failed") });
    } catch (e) {
      setState({ kind: "error", message: e instanceof Error ? e.message : t("unsubscribe.error") });
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-sm text-center">
        <h1 className="font-display text-2xl font-semibold mb-3">{t("unsubscribe.title")}</h1>
        {state.kind === "loading" && (
          <p className="text-muted-foreground">{t("unsubscribe.validating")}</p>
        )}
        {state.kind === "ready" && (
          <>
            <p className="text-muted-foreground mb-6">
              {t("unsubscribe.prompt")}
            </p>
            <button onClick={confirm} className="btn-google w-full">
              {t("unsubscribe.confirmCancel")}
            </button>
          </>
        )}
        {state.kind === "submitting" && (
          <p className="text-muted-foreground">{t("unsubscribe.processing")}</p>
        )}
        {state.kind === "done" && (
          <p className="text-foreground">
            {t("unsubscribe.done")}
          </p>
        )}
        {state.kind === "already" && (
          <p className="text-muted-foreground">
            {t("unsubscribe.alreadyDone")}
          </p>
        )}
        {state.kind === "invalid" && (
          <p className="text-destructive">{t("unsubscribe.invalid")}</p>
        )}
        {state.kind === "error" && (
          <p className="text-destructive">{state.message}</p>
        )}
      </div>
    </div>
  );
}
