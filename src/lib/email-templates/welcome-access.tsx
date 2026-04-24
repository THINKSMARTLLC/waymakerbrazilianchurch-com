import {
  Body, Button, Container, Head, Heading, Html, Preview, Section, Text,
} from "@react-email/components";
import type { TemplateEntry } from "./registry";

const SITE_NAME = "Way Maker Church";

interface WelcomeAccessProps {
  fullName?: string;
  email?: string;
  magicLink?: string;
  tempPassword?: string;
  loginUrl?: string;
  roleLabel?: string;
}

const WelcomeAccessEmail = ({
  fullName,
  email,
  magicLink,
  tempPassword,
  loginUrl,
  roleLabel,
}: WelcomeAccessProps) => {
  const greetingName = fullName?.trim() || "Olá";
  return (
    <Html lang="pt-BR" dir="ltr">
      <Head />
      <Preview>Seu acesso ao {SITE_NAME} está pronto</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Bem-vindo(a) ao {SITE_NAME}</Heading>
          <Text style={text}>
            {greetingName}, uma conta foi criada para você
            {roleLabel ? ` (${roleLabel})` : ""}.
          </Text>

          {magicLink && (
            <Section style={ctaWrap}>
              <Text style={text}>
                Clique no botão abaixo para acessar diretamente — sem precisar de senha.
                O link é pessoal e expira em pouco tempo.
              </Text>
              <Button href={magicLink} style={button}>
                Entrar agora
              </Button>
            </Section>
          )}

          {(email || tempPassword) && (
            <Section style={credBox}>
              <Text style={credTitle}>Ou entre manualmente:</Text>
              {email && (
                <Text style={credLine}>
                  <strong>Email:</strong> {email}
                </Text>
              )}
              {tempPassword && (
                <Text style={credLine}>
                  <strong>Senha temporária:</strong>{" "}
                  <span style={mono}>{tempPassword}</span>
                </Text>
              )}
              {loginUrl && (
                <Text style={credLine}>
                  <strong>Acesso:</strong>{" "}
                  <a href={loginUrl} style={link}>{loginUrl}</a>
                </Text>
              )}
            </Section>
          )}

          <Text style={text}>
            Por segurança, no primeiro acesso você precisará criar uma nova senha.
          </Text>

          <Text style={footer}>
            Se você não esperava esse email, pode ignorar com segurança.
            <br />
            Equipe {SITE_NAME}
          </Text>
        </Container>
      </Body>
    </Html>
  );
};

export const template = {
  component: WelcomeAccessEmail,
  subject: `Seu acesso ao ${SITE_NAME}`,
  displayName: "Acesso ao sistema",
  previewData: {
    fullName: "Maria Silva",
    email: "maria@exemplo.com",
    magicLink: "https://waymakerbrazilianchurch.com/auth/magic?token=preview",
    tempPassword: "Tmp-9X4k!aZ2p7",
    loginUrl: "https://waymakerbrazilianchurch.com/login",
    roleLabel: "Membro",
  },
} satisfies TemplateEntry;

const main = {
  backgroundColor: "#ffffff",
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Inter, Arial, sans-serif",
};
const container = { padding: "32px 28px", maxWidth: "560px" };
const h1 = {
  fontSize: "24px",
  fontWeight: 700,
  color: "#0b1220",
  margin: "0 0 20px",
};
const text = {
  fontSize: "15px",
  lineHeight: "1.6",
  color: "#334155",
  margin: "0 0 16px",
};
const ctaWrap = { margin: "24px 0" };
const button = {
  backgroundColor: "#1a73e8",
  color: "#ffffff",
  borderRadius: "10px",
  padding: "12px 22px",
  fontSize: "15px",
  fontWeight: 600,
  textDecoration: "none",
  display: "inline-block",
};
const credBox = {
  backgroundColor: "#f6f8fb",
  border: "1px solid #e5e9f0",
  borderRadius: "12px",
  padding: "16px 18px",
  margin: "24px 0",
};
const credTitle = {
  fontSize: "13px",
  textTransform: "uppercase" as const,
  letterSpacing: "0.04em",
  color: "#64748b",
  margin: "0 0 10px",
};
const credLine = {
  fontSize: "14px",
  color: "#0b1220",
  margin: "4px 0",
};
const mono = {
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
  backgroundColor: "#eef2f7",
  padding: "2px 6px",
  borderRadius: "6px",
};
const link = { color: "#1a73e8", textDecoration: "underline" };
const footer = {
  fontSize: "12px",
  color: "#94a3b8",
  marginTop: "28px",
};
