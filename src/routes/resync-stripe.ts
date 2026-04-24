import { createFileRoute } from "@tanstack/react-router";
import { resyncStripeData } from "@/lib/stripe-resync.functions";

export const Route = createFileRoute("/resync-stripe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authHeader = request.headers.get("authorization");
        try {
          const result = await resyncStripeData({
            headers: authHeader ? { authorization: authHeader } : undefined,
          });
          return Response.json(result);
        } catch (error) {
          return Response.json(
            { error: error instanceof Error ? error.message : "Resync failed." },
            { status: 400 },
          );
        }
      },
    },
  },
});
