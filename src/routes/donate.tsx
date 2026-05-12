import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

const PAYMENT_URL =
  "https://shop.beacons.ai/waymakerflow/421d52ec-7b1a-4301-bcc0-5c14511fd612";

export const Route = createFileRoute("/donate")({
  head: () => ({
    meta: [
      { title: "Doar — Way Maker Church" },
      { name: "description", content: "Faça sua doação para a Way Maker Church." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DonatePage,
});

function DonatePage() {
  const { t } = useTranslation();
  useEffect(() => {
    try {
      (window as unknown as { dataLayer?: unknown[] }).dataLayer?.push?.({
        event: "donate_clicked",
        destination: "payment",
        timestamp: new Date().toISOString(),
        page_origin: document.referrer || null,
      });
    } catch {
      // ignore
    }

    const timer = window.setTimeout(() => {
      window.location.replace(PAYMENT_URL);
    }, 300);

    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[oklch(0.99_0.003_85)] px-6 text-center">
      <div>
        <div className="mx-auto mb-6 h-10 w-10 animate-spin rounded-full border-2 border-[oklch(0.5_0.12_110)] border-t-transparent" />
        <p className="font-display text-lg text-[oklch(0.25_0.02_60)]">
          {t("donate.redirectingDonation")}
        </p>
      </div>
    </div>
  );
}
