import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

const ALLOWED_ROLES: AppRole[] = ["member", "finance_manager", "admin", "church_admin"];

interface CreateUserInput {
  full_name: string;
  email: string;
  phone?: string | null;
  role: AppRole;
  // Member-specific (used when role === 'member')
  date_of_birth?: string | null;
  address?: string | null;
  emergency_contact?: string | null;
  member_role?: string | null;
  department?: string | null;
}

function sanitize(input: CreateUserInput): CreateUserInput {
  const role = ALLOWED_ROLES.includes(input.role) ? input.role : "member";
  const email = String(input.email ?? "").trim().toLowerCase();
  const full_name = String(input.full_name ?? "").trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Email inválido");
  }
  if (full_name.length < 2 || full_name.length > 120) {
    throw new Error("Nome inválido");
  }
  return {
    ...input,
    role,
    email,
    full_name,
    phone: input.phone?.toString().trim() || null,
  };
}

function generateTempPassword(): string {
  // 14 chars, mixed: e.g. "Wm7-Kd9q2!nXrA"
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnpqrstuvwxyz";
  const digits = "23456789";
  const symbols = "!@#$%&*-_+=?";
  const all = upper + lower + digits + symbols;
  const pick = (set: string) => set[Math.floor(Math.random() * set.length)];
  let pwd = pick(upper) + pick(lower) + pick(digits) + pick(symbols);
  for (let i = 0; i < 10; i++) pwd += pick(all);
  return pwd.split("").sort(() => Math.random() - 0.5).join("");
}

/**
 * Create a new authenticated user (admin-only).
 * - Generates a temporary password
 * - Creates auth user (email confirmed)
 * - Sets profile with must_change_password = true
 * - Assigns the requested role
 * - If role === 'member', upserts a corresponding members row
 * - Generates a recovery link the admin can copy
 *
 * Returns { tempPassword, recoveryLink, userId } so the admin can deliver it manually
 * (email automation not configured yet).
 */
export const createManagedUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: CreateUserInput) => sanitize(input))
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context;

    // Authorization: only super_admin can create staff/admin; super_admin or active staff can create members
    const { data: callerRoles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const roles = (callerRoles ?? []).map((r) => r.role) as AppRole[];
    const isSuper = roles.includes("super_admin");
    const isStaff = roles.some((r) =>
      ["admin", "church_admin", "finance_manager"].includes(r),
    );

    if (!isSuper && data.role !== "member") {
      throw new Error("Apenas Super Admin pode criar contas de Staff ou Admin");
    }
    if (!isSuper && !isStaff) {
      throw new Error("Sem permissão para criar contas");
    }

    // Check if email already exists in auth
    const { data: existing, error: listErr } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    if (listErr) throw new Error(`Erro ao verificar email: ${listErr.message}`);
    const dup = existing?.users?.find(
      (u) => (u.email ?? "").toLowerCase() === data.email,
    );
    if (dup) {
      // Generate a recovery link so admin can offer "send reset" workflow
      const { data: recoveryData } = await supabaseAdmin.auth.admin.generateLink({
        type: "recovery",
        email: data.email,
      });
      return {
        ok: false as const,
        reason: "email_exists" as const,
        message: "Este email já está cadastrado.",
        recoveryLink: recoveryData?.properties?.action_link ?? null,
        existingUserId: dup.id,
      };
    }

    const tempPassword = generateTempPassword();

    // Create auth user (email confirmed so they can login immediately with temp password)
    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        full_name: data.full_name,
        phone: data.phone,
        requested_role: data.role,
        address: data.address,
        emergency_contact: data.emergency_contact,
        date_of_birth: data.date_of_birth,
        member_role: data.member_role,
        department: data.department,
      },
    });
    if (createErr || !created?.user) {
      throw new Error(`Falha ao criar usuário: ${createErr?.message ?? "desconhecido"}`);
    }

    const newUserId = created.user.id;

    // The handle_new_user trigger creates user_profiles + user_roles.
    // We override role + flag must_change_password and record created_by.
    await supabaseAdmin
      .from("user_profiles")
      .update({
        must_change_password: true,
        created_by: userId,
        status: "active",
        full_name: data.full_name,
        phone: data.phone,
      })
      .eq("user_id", newUserId);

    // Force exact role (delete any default role inserted by trigger, then insert requested)
    await supabaseAdmin.from("user_roles").delete().eq("user_id", newUserId);
    await supabaseAdmin
      .from("user_roles")
      .insert([{ user_id: newUserId, role: data.role }]);

    // Generate recovery link so user can reset on first login
    const { data: recoveryData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email: data.email,
    });
    if (linkErr) {
      // Non-fatal — temp password still works
      console.error("Recovery link generation failed:", linkErr.message);
    }

    // Activity log
    await supabaseAdmin.from("activity_logs").insert({
      user_id: userId,
      action: "user_created_by_admin",
      metadata: {
        target_user_id: newUserId,
        target_email: data.email,
        role: data.role,
      },
    });

    return {
      ok: true as const,
      userId: newUserId,
      email: data.email,
      tempPassword,
      recoveryLink: recoveryData?.properties?.action_link ?? null,
    };
  });

/**
 * Generate a recovery link for an existing user (admin-only).
 * Used for "Send password reset instructions" workflow.
 */
export const generateRecoveryForEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { email: string }) => ({
    email: String(input.email ?? "").trim().toLowerCase(),
  }))
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context;
    const { data: callerRoles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const roles = (callerRoles ?? []).map((r) => r.role) as AppRole[];
    const isStaff = roles.some((r) =>
      ["super_admin", "admin", "church_admin", "finance_manager"].includes(r),
    );
    if (!isStaff) throw new Error("Sem permissão");

    const { data: recoveryData, error } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email: data.email,
    });
    if (error) throw new Error(error.message);
    return { recoveryLink: recoveryData?.properties?.action_link ?? null };
  });
