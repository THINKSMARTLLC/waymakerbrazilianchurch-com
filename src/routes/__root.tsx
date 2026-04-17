import { Outlet, Link, createRootRoute, HeadContent, Scripts, useLocation } from "@tanstack/react-router";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { AppLayout } from "@/components/AppLayout";

import appCss from "../styles.css?url";

const PUBLIC_ROUTES = ["/login", "/signup", "/forgot-password", "/reset-password"];

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
      { title: "ChurchFlow — Church Financial Management" },
      { name: "description", content: "Simple church financial management for recurring donations, member management, and payment tracking." },
      { property: "og:title", content: "ChurchFlow" },
      { property: "og:description", content: "Church financial management made simple." },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
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
      <AuthGate />
    </AuthProvider>
  );
}

function AuthGate() {
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
          <p className="text-muted-foreground mb-4">Você precisa fazer login para acessar o sistema.</p>
          <Link to="/login" className="btn-google inline-block">Ir para Login</Link>
        </div>
      </div>
    );
  }

  return <StatusGate />;
}

function StatusGate() {
  const { status, loading } = useUserRole();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
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
