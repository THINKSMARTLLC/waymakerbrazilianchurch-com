import {
  Body, Container, Head, Heading, Html, Preview, Section, Text,
} from "@react-email/components";
import type { TemplateEntry } from "./registry";

const SITE_NAME = "Way Maker Church";

interface SystemAlertProps {
  title?: string;
  scope?: string;
  message?: string;
  details?: string;
  occurredAt?: string;
}

const SystemAlertEmail = ({
  title,
  scope,
  message,
  details,
  occurredAt,
}: SystemAlertProps) => {
  return (
    <Html lang="pt-BR" dir="ltr">
      <Head />
      <Preview>{title || "Alerta do sistema"} — {SITE_NAME}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>⚠️ {title || "Alerta do sistema"}</Heading>
          <Text style={text}>
            Um problema foi detectado no sistema {SITE_NAME}.
          </Text>

          <Section style={box}>
            {scope && (
              <Text style={line}>
                <strong>Origem:</strong> {scope}
              </Text>
            )}
            {message && (
              <Text style={line}>
                <strong>Mensagem:</strong> {message}
              </Text>
            )}
            {occurredAt && (
              <Text style={line}>
                <strong>Quando:</strong> {occurredAt}
              </Text>
            )}
            {details && (
              <pre style={pre}>{details}</pre>
            )}
          </Section>

          <Text style={text}>
            Verifique o painel administrativo &gt; System Logs para mais detalhes.
          </Text>
          <Text style={footer}>Equipe {SITE_NAME}</Text>
        </Container>
      </Body>
    </Html>
  );
};

export const template = {
  component: SystemAlertEmail,
  subject: (data: Record<string, unknown>) =>
    `[Alerta] ${(data?.title as string) || "Falha no sistema"} — ${SITE_NAME}`,
  displayName: "Alerta do sistema (admin)",
  previewData: {
    title: "Falha no webhook do Stripe",
    scope: "stripe-webhook",
    message: "Erro ao processar evento invoice.payment_failed",
    details: "Error: timeout\n  at handler (...)",
    occurredAt: new Date().toISOString(),
  },
} satisfies TemplateEntry;

const main = {
  backgroundColor: "#ffffff",
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Inter, Arial, sans-serif",
};
const container = { padding: "32px 28px", maxWidth: "640px" };
const h1 = { fontSize: "22px", fontWeight: 700, color: "#b91c1c", margin: "0 0 16px" };
const text = { fontSize: "15px", lineHeight: "1.6", color: "#334155", margin: "0 0 14px" };
const box = {
  backgroundColor: "#fef2f2",
  border: "1px solid #fecaca",
  borderRadius: "12px",
  padding: "14px 16px",
  margin: "16px 0",
};
const line = { fontSize: "14px", color: "#0b1220", margin: "4px 0" };
const pre = {
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
  fontSize: "12px",
  color: "#0b1220",
  backgroundColor: "#fff",
  border: "1px solid #fecaca",
  borderRadius: "8px",
  padding: "10px",
  whiteSpace: "pre-wrap" as const,
  overflow: "auto",
  maxHeight: "260px",
};
const footer = { fontSize: "12px", color: "#94a3b8", marginTop: "24px" };
