import { createFileRoute } from "@tanstack/react-router";
import { createSubscriptionSession } from "@/lib/stripe-subscriptions.functions";

export const Route = createFileRoute("/create-subscription-session")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authHeader = request.headers.get("authorization");
        const body = (await request.json()) as { memberId?: string };

        try {
          const result = await createSubscriptionSession({
            data: { memberId: body.memberId ?? "" },
            headers: authHeader ? { authorization: authHeader } : undefined,
          });

          return Response.json(result);
        } catch (error) {
          return Response.json(
            { error: error instanceof Error ? error.message : "Unable to create session." },
            { status: 400 },
          );
        }
      },
    },
  },
});