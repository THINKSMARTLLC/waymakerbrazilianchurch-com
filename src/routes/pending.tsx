import { createFileRoute } from "@tanstack/react-router";
import { Clock, LogOut } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/pending")({
  head: () => ({ meta: [{ title: "Awaiting Approval — Way Maker Church" }] }),
  component: PendingPage,
});

function PendingPage() {
  const { signOut, user } = useAuth();
  const { t } = useTranslation();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
          <Clock className="h-8 w-8 text-primary" />
        </div>
        <h1 className="font-display text-2xl font-semibold text-foreground mb-2">
          {t("pending.title")}
        </h1>
        <p className="text-muted-foreground mb-2">
          {t("pending.hello")}, <strong>{user?.email}</strong>
        </p>
        <p className="text-sm text-muted-foreground mb-8">
          {t("pending.body")}
        </p>
        <button onClick={signOut} className="btn-google inline-flex items-center gap-2">
          <LogOut className="h-4 w-4" />
          {t("common.signOut")}
        </button>
      </div>
    </div>
  );
}
