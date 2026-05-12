import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { markSubscriptionCanceled } from "@/lib/stripe-subscriptions.functions";

export const Route = createFileRoute("/cancel")({
  component: CancelPage,
});

function CancelPage() {
  const { t } = useTranslation();
  const search = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const memberId = search.get("member_id");

  useEffect(() => {
    async function markCanceled() {
      if (!memberId) return;
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return;

      await markSubscriptionCanceled({
        data: { memberId },
        headers: { authorization: `Bearer ${token}` },
      });
    }

    markCanceled();
  }, [memberId]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="card-elevated max-w-lg p-8 text-center">
        <XCircle className="mx-auto mb-4 h-12 w-12 text-destructive" />
        <h1 className="font-display text-2xl font-semibold text-foreground">{t("subscriptionStatus.canceledTitle")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("subscriptionStatus.canceledSubtitle")}</p>
      </div>
    </div>
  );
}
