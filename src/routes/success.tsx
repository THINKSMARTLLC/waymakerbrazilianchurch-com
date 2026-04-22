import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { finalizeSubscriptionSession } from "@/lib/stripe-subscriptions.functions";

export const Route = createFileRoute("/success")({
  component: SuccessPage,
});

function SuccessPage() {
  const [state, setState] = useState<"loading" | "success" | "error">("loading");
  const search = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const sessionId = search.get("session_id");

  useEffect(() => {
    async function finalize() {
      try {
        if (!sessionId) throw new Error("Missing Stripe session.");
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) throw new Error("Please sign in again.");

        await finalizeSubscriptionSession({
          data: { sessionId },
          headers: { authorization: `Bearer ${token}` },
        });

        setState("success");
      } catch {
        setState("error");
      }
    }

    finalize();
  }, [sessionId]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="card-elevated max-w-lg p-8 text-center">
        <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-primary" />
        <h1 className="font-display text-2xl font-semibold text-foreground">
          {state === "success" ? "Your weekly contribution has been successfully activated." : state === "error" ? "We could not confirm your contribution." : "Confirming your subscription..."}
        </h1>
      </div>
    </div>
  );
}