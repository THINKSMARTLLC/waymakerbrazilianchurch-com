import { Link, useLocation, Outlet } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Users,
  FileBarChart,
  Menu,
  X,
  LogOut,
  Shield,
} from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { logActivity } from "@/lib/activityLog";
import wayMakerLogo from "@/assets/waymaker-logo.png";

const baseNavItems = [
  { label: "Dashboard", to: "/" as const, icon: LayoutDashboard },
  { label: "Membros", to: "/members" as const, icon: Users },
  { label: "Relatórios", to: "/reports" as const, icon: FileBarChart },
];

export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { isSuperAdmin } = useUserRole();

  const navItems = isSuperAdmin
    ? [...baseNavItems, { label: "Admin", to: "/admin" as const, icon: Shield }]
    : baseNavItems;

  const handleSignOut = async () => {
    await logActivity("logout");
    await signOut();
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-sidebar-border bg-sidebar transition-transform md:static md:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-foreground overflow-hidden">
            <img src={wayMakerLogo} alt="Way Maker logo" className="h-9 w-9 object-contain" />
          </div>
          <span className="font-display text-lg font-semibold text-foreground tracking-tight">
            WAY MAKER FLOW
          </span>
          <button className="ml-auto md:hidden text-muted-foreground" onClick={() => setSidebarOpen(false)}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          {navItems.map((item) => {
            const isActive =
              item.to === "/"
                ? location.pathname === "/"
                : location.pathname.startsWith(item.to);

            return (
              <Link
                key={item.to}
                to={item.to}
                className={`sidebar-link ${isActive ? "sidebar-link-active" : ""}`}
                onClick={() => setSidebarOpen(false)}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-sidebar-border p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
              {user?.email?.charAt(0).toUpperCase() || "A"}
            </div>
            <div className="flex-1 min-w-0 text-sm">
              <p className="font-medium text-foreground truncate">{user?.email || "Admin"}</p>
            </div>
            <button
              onClick={handleSignOut}
              className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-destructive transition-colors"
              title="Sair"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-16 shrink-0 items-center border-b border-border bg-card px-4 md:px-6">
          <button
            className="mr-4 rounded-lg p-2 text-muted-foreground hover:bg-muted md:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </button>
          <h1 className="page-header">
            {navItems.find((item) =>
              item.to === "/" ? location.pathname === "/" : location.pathname.startsWith(item.to)
            )?.label || "WAY MAKER FLOW"}
          </h1>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
