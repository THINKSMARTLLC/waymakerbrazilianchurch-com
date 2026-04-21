import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";

const PAYMENT_URL =
  "https://shop.beacons.ai/waymakerflow/421d52ec-7b1a-4301-bcc0-5c14511fd612";

export const Route = createFileRoute("/oferta")({
  head: () => ({
    meta: [
      { title: "Contribuir — Way Maker Church" },
      { name: "description", content: "Faça sua oferta para a Way Maker Church." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OfertaRedirect,
});

function OfertaRedirect() {
  useEffect(() => {
    try {
      // Lightweight conversion tracking hook
      (window as unknown as { dataLayer?: unknown[] }).dataLayer?.push?.({
        event: "offering_click",
        destination: "payment",
      });
    } catch {
      // ignore
    }
    window.location.replace(PAYMENT_URL);
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[oklch(0.99_0.003_85)] px-6 text-center">
      <div>
        <div className="mx-auto mb-6 h-10 w-10 animate-spin rounded-full border-2 border-[oklch(0.5_0.12_110)] border-t-transparent" />
        <p className="font-display text-lg text-[oklch(0.25_0.02_60)]">
          Redirecionando para o ambiente seguro de contribuição…
        </p>
      </div>
    </div>
  );
}
