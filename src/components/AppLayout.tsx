import { Link, useLocation, Outlet } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Users,
  FileBarChart,
  Menu,
  X,
  LogOut,
  Shield,
  Database,
  Activity,
  Settings,
  Heart,
  Sprout,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { logActivity } from "@/lib/activityLog";
import { LanguageSelector } from "@/components/LanguageSelector";
import { supabase } from "@/integrations/supabase/client";
import wayMakerLogo from "@/assets/waymaker-logo.png";

export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { isSuperAdmin } = useUserRole();
  const { t } = useTranslation();
  const [pendingCount, setPendingCount] = useState(0);

  // Pending review count (social + activities) with realtime updates
  useEffect(() => {
    let mounted = true;

    const refresh = async () => {
      const [s, a] = await Promise.all([
        supabase.from("social_engagements").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("member_activities").select("id", { count: "exact", head: true }).eq("status", "pending"),
      ]);
      if (!mounted) return;
      setPendingCount((s.count ?? 0) + (a.count ?? 0));
    };

    refresh();

    const onInsert = (payload: { new: { status?: string } }) => {
      if (payload.new?.status === "pending") {
        toast("New activity awaiting approval");
      }
      refresh();
    };

    const channel = supabase
      .channel("pending-review-counts")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "social_engagements" }, onInsert)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "social_engagements" }, refresh)
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "social_engagements" }, refresh)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "member_activities" }, onInsert)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "member_activities" }, refresh)
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "member_activities" }, refresh)
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, []);

  const baseNavItems = [
    { label: t("nav.dashboard"), to: "/dashboard" as const, icon: LayoutDashboard },
    { label: t("nav.pastoral"), to: "/pastoral" as const, icon: Heart },
    { label: t("nav.discipleship"), to: "/discipleship" as const, icon: Sprout },
    { label: t("nav.members"), to: "/members" as const, icon: Users },
    { label: t("nav.engagement"), to: "/engagement" as const, icon: Activity },
    { label: t("nav.engagementReview"), to: "/engagement/review" as const, icon: Shield },
    { label: t("nav.reports"), to: "/reports" as const, icon: FileBarChart },
  ];

  const navItems = isSuperAdmin
    ? [
        ...baseNavItems,
        { label: t("nav.importExport"), to: "/import-export" as const, icon: Database },
        { label: t("nav.churchSettings"), to: "/settings/church" as const, icon: Settings },
        { label: t("nav.admin"), to: "/admin" as const, icon: Shield },
      ]
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
            Way Maker Church
          </span>
          <button className="ml-auto md:hidden text-muted-foreground" onClick={() => setSidebarOpen(false)}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          {navItems.map((item) => {
            const isActive = location.pathname === item.to || location.pathname.startsWith(item.to + "/");
            const showBadge = item.to === "/engagement/review" && pendingCount > 0;

            return (
              <Link
                key={item.to}
                to={item.to}
                className={`sidebar-link ${isActive ? "sidebar-link-active" : ""}`}
                onClick={() => setSidebarOpen(false)}
              >
                <item.icon className="h-5 w-5" />
                <span className="flex-1">{item.label}</span>
                {showBadge && (
                  <span className="ml-auto inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-warning px-1.5 py-0.5 text-[10px] font-semibold text-warning-foreground">
                    {pendingCount > 99 ? "99+" : pendingCount}
                  </span>
                )}
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
              title={t("common.signOut")}
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
            {navItems.find(
              (item) => location.pathname === item.to || location.pathname.startsWith(item.to + "/")
            )?.label || "Way Maker Church"}
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
