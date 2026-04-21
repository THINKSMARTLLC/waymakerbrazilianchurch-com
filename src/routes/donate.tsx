import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

const PAYMENT_URL =
  "https://shop.beacons.ai/waymakerflow/421d52ec-7b1a-4301-bcc0-5c14511fd612";

const IFRAME_LOAD_TIMEOUT = 3500;

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
  const [status, setStatus] = useState<"loading" | "embedded" | "redirecting">("loading");
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const loadedRef = useRef(false);

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
      if (!loadedRef.current) {
        setStatus("redirecting");
        window.location.replace(PAYMENT_URL);
      }
    }, IFRAME_LOAD_TIMEOUT);

    return () => window.clearTimeout(timer);
  }, []);

  const handleIframeLoad = () => {
    loadedRef.current = true;
    setStatus("embedded");
  };

  const handleIframeError = () => {
    setStatus("redirecting");
    window.location.replace(PAYMENT_URL);
  };

  return (
    <div className="min-h-screen bg-[oklch(0.99_0.003_85)]">
      {status !== "embedded" && (
        <div className="flex min-h-screen items-center justify-center px-6 text-center">
          <div>
            <div className="mx-auto mb-6 h-10 w-10 animate-spin rounded-full border-2 border-[oklch(0.5_0.12_110)] border-t-transparent" />
            <p className="font-display text-lg text-[oklch(0.25_0.02_60)]">
              {status === "redirecting"
                ? "Redirecionando para o ambiente seguro de doação…"
                : "Carregando ambiente seguro de doação…"}
            </p>
          </div>
        </div>
      )}

      <iframe
        ref={iframeRef}
        src={PAYMENT_URL}
        title="Doar — Way Maker Church"
        onLoad={handleIframeLoad}
        onError={handleIframeError}
        className={
          status === "embedded"
            ? "h-screen w-full border-0"
            : "pointer-events-none absolute h-0 w-0 border-0 opacity-0"
        }
        allow="payment *; clipboard-write"
        referrerPolicy="no-referrer-when-downgrade"
      />
    </div>
  );
}
