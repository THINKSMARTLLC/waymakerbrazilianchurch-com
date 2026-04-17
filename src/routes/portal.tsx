import { createFileRoute } from "@tanstack/react-router";
import { PortalLayout } from "@/components/PortalLayout";

export const Route = createFileRoute("/portal")({
  head: () => ({
    meta: [
      { title: "Portal do Membro — WAY MAKER FLOW" },
      { name: "description", content: "Seu portal pessoal de contribuições" },
    ],
  }),
  component: PortalLayout,
});
