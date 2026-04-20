import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];
type AccountStatus = Database["public"]["Enums"]["account_status"];

interface UserRoleData {
  roles: AppRole[];
  status: AccountStatus | null;
  mustChangePassword: boolean;
  loading: boolean;
  isSuperAdmin: boolean;
  isStaff: boolean;
  refresh: () => Promise<void>;
}

export function useUserRole(): UserRoleData {
  const { user } = useAuth();
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [status, setStatus] = useState<AccountStatus | null>(null);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user) {
      setRoles([]);
      setStatus(null);
      setMustChangePassword(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    const [rolesRes, profileRes] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", user.id),
      supabase.from("user_profiles").select("status, must_change_password").eq("user_id", user.id).maybeSingle(),
    ]);
    setRoles((rolesRes.data ?? []).map((r) => r.role));
    setStatus(profileRes.data?.status ?? null);
    setMustChangePassword(Boolean(profileRes.data?.must_change_password));
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const isSuperAdmin = roles.includes("super_admin");
  const isStaff = roles.some((r) =>
    ["super_admin", "admin", "church_admin", "finance_manager"].includes(r),
  );

  return { roles, status, mustChangePassword, loading, isSuperAdmin, isStaff, refresh: load };
}
