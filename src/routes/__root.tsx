import { Outlet, Link, createRootRoute, HeadContent, Scripts, useLocation } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { AppLayout } from "@/components/AppLayout";
import { LanguageProvider } from "@/hooks/useLanguage";
import "@/i18n";


import appCss from "../styles.css?url";

const PUBLIC_ROUTES = ["/", "/login", "/signup", "/forgot-password", "/reset-password"];

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">The page you're looking for doesn't exist.</p>
        <div className="mt-6">
          <Link to="/" className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "WAY MAKER CHURCH" },
      { name: "description", content: "Um lugar para quem não quer apenas ir à igreja… mas viver o Evangelho de verdade." },
      { property: "og:title", content: "WAY MAKER CHURCH" },
      { property: "og:description", content: "Um lugar para quem não quer apenas ir à igreja… mas viver o Evangelho de verdade." },
      { property: "og:type", content: "website" },
      { name: "twitter:title", content: "WAY MAKER CHURCH" },
      { name: "twitter:description", content: "Um lugar para quem não quer apenas ir à igreja… mas viver o Evangelho de verdade." },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/1d5855ce-94ba-4502-b111-6bbb661fa295" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/1d5855ce-94ba-4502-b111-6bbb661fa295" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Inter:wght@300;400;500;600;700;800&display=swap" },
      { rel: "stylesheet", href: appCss },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return (
    <AuthProvider>
      <LanguageProvider>
        <AuthGate />
      </LanguageProvider>
    </AuthProvider>
  );
}

function AuthGate() {
  const { t } = useTranslation();
  const { user, loading } = useAuth();
  const location = useLocation();
  const isPublic = PUBLIC_ROUTES.includes(location.pathname);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (isPublic) return <Outlet />;

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">{t("rootApp.loginRequired")}</p>
          <Link to="/login" className="btn-google inline-block">{t("auth.login", { defaultValue: "Sign In" })}</Link>
        </div>
      </div>
    );
  }

  return <StatusGate />;
}

function StatusGate() {
  const { status, loading, isSuperAdmin, isStaff, roles } = useUserRole();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  // Super admins always bypass status gating
  if (isSuperAdmin) {
    if (location.pathname === "/pending" && typeof window !== "undefined") {
      window.location.replace("/admin");
      return null;
    }
    return <AppLayout />;
  }

  if (status === "suspended") {
    return <BlockedScreen reason="Sua conta foi suspensa. Entre em contato com o administrador." />;
  }

  if (status === "pending") {
    if (location.pathname === "/pending") return <Outlet />;
    if (typeof window !== "undefined" && location.pathname !== "/pending") {
      window.location.replace("/pending");
    }
    return null;
  }

  // Members (non-staff) get the personal portal — keep them out of admin pages
  const isMemberOnly = !isStaff && roles.includes("member");
  if (isMemberOnly) {
    if (!location.pathname.startsWith("/portal")) {
      if (typeof window !== "undefined") window.location.replace("/portal");
      return null;
    }
    return <Outlet />;
  }

  return <AppLayout />;
}

function BlockedScreen({ reason }: { reason: string }) {
  const { signOut } = useAuth();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-2xl font-semibold text-destructive mb-3">Acesso bloqueado</h1>
        <p className="text-muted-foreground mb-6">{reason}</p>
        <button onClick={signOut} className="btn-google">Sair</button>
      </div>
    </div>
  );
}
