import { Link, useLocation, Outlet } from "@tanstack/react-router";
import { LayoutDashboard, User, History, LogOut, Menu, X, BookOpen } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/useAuth";
import { useCurrentMember } from "@/hooks/useCurrentMember";
import { logActivity } from "@/lib/activityLog";
import { LanguageSelector } from "@/components/LanguageSelector";
import wayMakerLogo from "@/assets/waymaker-logo.png";

export function PortalLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const { user, signOut } = useAuth();
  const member = useCurrentMember();
  const { t } = useTranslation();
  const initial = (member?.name || user?.email || "M").charAt(0).toUpperCase();

  const navItems = [
    { label: t("nav.dashboard"), to: "/portal" as const, icon: LayoutDashboard },
    { label: "Bíblia", to: "/portal/bible" as const, icon: BookOpen },
    { label: t("nav.contributions"), to: "/portal/contributions" as const, icon: History },
    { label: t("nav.profile"), to: "/portal/profile" as const, icon: User },
  ];

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
            Way Maker Church
          </span>
          <button className="ml-auto md:hidden text-muted-foreground" onClick={() => setSidebarOpen(false)}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          {navItems.map((item) => {
            const isActive =
              item.to === "/portal"
                ? location.pathname === "/portal"
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
          <Link
            to="/portal/profile"
            className="flex items-center gap-3 rounded-lg p-2 hover:bg-muted transition-colors"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground overflow-hidden">
              {member?.profile_photo_url ? (
                <img src={member.profile_photo_url} alt={member.name} className="h-full w-full object-cover" />
              ) : (
                initial
              )}
            </div>
            <div className="flex-1 min-w-0 text-sm">
              <p className="font-medium text-foreground truncate">{member?.name || user?.email || "Member"}</p>
              <p className="text-xs text-muted-foreground">{t("nav.viewProfile")}</p>
            </div>
          </Link>
          <button
            onClick={handleSignOut}
            className="mt-2 flex w-full items-center gap-2 rounded-lg p-2 text-sm text-muted-foreground hover:bg-muted hover:text-destructive transition-colors"
          >
            <LogOut className="h-4 w-4" />
            {t("common.signOut")}
          </button>
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
              item.to === "/portal" ? location.pathname === "/portal" : location.pathname.startsWith(item.to)
            )?.label || t("nav.memberPortal")}
          </h1>
          <div className="ml-auto">
            <LanguageSelector />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
